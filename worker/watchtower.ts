/**
 * Vexor Watchtower — Telegram-native per-token alerting (V2)
 *
 * Telegram bot @VexorAeonWatchtowerbot. The bot is the UI: there is no
 * /watch web page. Users subscribe via Telegram commands; an hourly
 * Cloudflare Cron Trigger compares the live DexScreener snapshot for each
 * watched token against the previous snapshot stored in KV and pushes a
 * Telegram alert to every subscriber when a threshold trips.
 *
 * Bindings (wrangler.jsonc):
 * - `WATCHTOWER` (KV namespace) — subscription + snapshot storage
 * - `TELEGRAM_BOT_TOKEN` (secret) — bot API token from BotFather
 * - `TELEGRAM_WEBHOOK_SECRET` (secret, optional) — opaque shared secret
 *   validated against the `X-Telegram-Bot-Api-Secret-Token` header on
 *   incoming webhook requests
 *
 * KV schema:
 * - `chat:<chat_id>` → ChatRecord
 *      { tokens: string[],
 *        thresholds?: Record<slug, pct>,        // custom /alert override
 *        whale_thresholds?: Record<slug, usd>,  // /whale opt-in
 *        created_at, last_seen }
 * - `snapshot:<slug>` → { price_usd, liquidity_usd, volume_24h_usd,
 *                         fetched_at, last_alert_at, last_alert_dir }
 * - `cd:<chat_id>:<slug>:<dir>` → per-chat price-alert cooldown timestamp
 *   (TTL = ALERT_COOLDOWN_MS)
 * - `whale-block:<slug>` → last Base block scanned for whale transfers
 * - `whale-dedupe:<slug>:<tx>:<idx>` → seen-whale-log de-dupe (TTL 2h)
 * - `vol-alert:<slug>` → volatility-spike cooldown timestamp (TTL 24h)
 * - `dec:<ca>` → cached ERC-20 decimals() return (one-time on-chain read)
 *
 * Routes (registered in worker/index.ts):
 * - `POST /api/watchtower/webhook` — Telegram webhook target. Always
 *   responds 200 quickly; long-running work (KV writes, sendMessage) is
 *   spawned via `ctx.waitUntil` to keep webhook latency low.
 *
 * Cron entrypoint:
 * - `scheduled()` in worker/index.ts dispatches to `runWatchtowerCron()`
 *   here. Cron cadence is set in wrangler.jsonc (hourly).
 *
 * Alert pipelines (each cron tick):
 * 1. Price + liquidity check (per-chat custom threshold via /alert)
 *    - Default: ±10% / 1h price, ≥25% / 1h liquidity drop
 *    - Per-user override: /alert <slug> <pct> (range 1–50%)
 *    - Cooldown: one alert per (chat, slug, direction) per hour
 * 2. Whale transfer scan (per-chat opt-in via /whale)
 *    - Scans ERC-20 Transfer logs since last seen block
 *    - Alerts when transfer USD value ≥ user's /whale threshold
 * 3. Volatility spike (broadcast, no per-user config)
 *    - 24h DexScreener volume ≥ 3× median of 30d daily volume
 *    - Requires ≥14 days of GeckoTerminal OHLC history
 *    - Cooldown: one alert per token per 24h
 */

import type { Env } from "./index";
import { INTEL_TOKENS, isIntelTokenSlug, getIntelToken } from "../src/lib/intel-tokens";
import { parseResearchInput, produceResearchBrief, ResearchError } from "./researcher";
import { rpcCall, padAddress, hexToBigInt, SEL } from "./rpc";

const TELEGRAM_API_BASE = "https://api.telegram.org";

const PRICE_THRESHOLD_PCT = 10; // default ±% / 1h move (overridable via /alert)
const MIN_PRICE_THRESHOLD_PCT = 1;
const MAX_PRICE_THRESHOLD_PCT = 50;
const LIQ_DROP_THRESHOLD_PCT = -25; // alert on ≤-25% / 1h
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1h per direction per token per chat
const SNAPSHOT_FRESH_WINDOW_MS = 2 * 60 * 60 * 1000; // ignore baselines older than 2h
const MAX_TOKENS_PER_USER = 5; // free-tier ceiling
const RESEARCH_DAILY_LIMIT = 3; // free-tier `/research` quota per chat per UTC day
const RESEARCH_KEY_TTL_SECONDS = 60 * 60 * 36; // 36h so the counter is around long enough to span the day

// Whale-transfer scanner (Feature 2)
const DEFAULT_WHALE_USD = 50_000;
const MIN_WHALE_USD = 1_000;
const MAX_WHALE_USD = 10_000_000;
const WHALE_MAX_BLOCK_RANGE = 1500; // per cron tick; Base ~2s blocks ⇒ ~50min window
const WHALE_RECENT_FALLBACK_BLOCKS = 1800; // first-time scan: last ~1h
const WHALE_COOLDOWN_TTL_SECONDS = 60 * 60 * 2; // de-dupe key TTL
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Volatility-spike scanner (Feature 3)
const VOLATILITY_SPIKE_FACTOR = 3; // fire when 24h vol ≥ 3× 30d median
const VOLATILITY_MIN_DAYS = 14; // need ≥ N daily candles before triggering
const VOLATILITY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 alert/token/24h
const VOLATILITY_MIN_USD = 5_000; // ignore tokens with negligible volume

interface ChatRecord {
  tokens: string[];
  /** Per-token custom price-move threshold (percent). Missing = use default. */
  thresholds?: Record<string, number>;
  /** Per-token whale-transfer USD threshold. Missing = no whale alerts for that token. */
  whale_thresholds?: Record<string, number>;
  /**
   * Group-mode opt-in for passive cashtag detection. When true the bot
   * scans every group message for `$VT` / `$AERO` / etc. and replies
   * with the matching chart card (deduplicated per slug, 10 min TTL).
   * Default false: groups must run `/enable_cashtags` explicitly. Always
   * false / ignored for DMs.
   */
  cashtags_enabled?: boolean;
  created_at: string;
  last_seen: string;
}

interface SnapshotRecord {
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  fetched_at: string;
  last_alert_at?: string;
  last_alert_dir?: "up" | "down" | "liq_drop";
}

// Subset of the Pulse Premium per-token feed schema we read inside
// `cmdChart`. Full schema lives in `worker/intel-token.ts`; we redefine
// only the fields we need so this file does not depend on the larger
// `TokenPayload` type.
interface PulsePremiumSnapshot {
  price_usd?: number | null;
  volume_24h_usd?: number | null;
  liquidity_usd?: number | null;
  fdv_usd?: number | null;
  price_change_24h_pct?: number | null;
}

interface PulsePremiumPayload {
  generated_at?: string;
  market_snapshot?: PulsePremiumSnapshot;
}

// Per-token AI sentiment JSON written by `vexor-aeon`'s
// `generate-sentiment.py` (cron 12:45 UTC). Fields mirror the
// vexor-sentiment.yml workflow's output schema exactly — keep in sync.
type SentimentLabel = "bullish" | "bearish" | "neutral";
type SentimentConfidence = "high" | "med" | "low";

interface SentimentPayload {
  schema_version?: string;
  slug?: string;
  symbol?: string;
  generated_at?: string;
  source_snapshot_at?: string;
  label?: SentimentLabel | string;
  confidence?: SentimentConfidence | string;
  rationale?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  inline_query?: TelegramInlineQuery;
}

// Subset of Telegram's `InlineQuery` payload. Inline mode lets users
// invoke @VexorAeonWatchtowerbot from any chat (not just DMs) by typing
// `@VexorAeonWatchtowerbot <query>` in the message composer. Telegram
// forwards a `inline_query` update; we answer with up to 50 photo
// results that the user can tap to share into the current chat.
interface TelegramInlineQuery {
  id: string;
  from: { id: number; username?: string; first_name?: string };
  query: string;
  offset: string;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string; first_name?: string };
  chat: { id: number; type: string; title?: string };
  date: number;
  text?: string;
  entities?: Array<{ type: string; offset: number; length: number }>;
  // Telegram lifecycle event: present when one or more members were added
  // to a chat (including the bot itself being added to a group).
  new_chat_members?: Array<{
    id: number;
    is_bot?: boolean;
    username?: string;
    first_name?: string;
  }>;
  // Telegram lifecycle event: present when a member left or was removed.
  // We use it to drop group records when the bot itself is kicked.
  left_chat_member?: {
    id: number;
    is_bot?: boolean;
    username?: string;
    first_name?: string;
  };
}

interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h1?: number; h24?: number };
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[] | null;
}

// -----------------------------------------------------------------------------
// Public entry points (called from worker/index.ts)
// -----------------------------------------------------------------------------

export async function handleWatchtowerWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  // Telegram lets you set a `secret_token` when you call setWebhook; it
  // echoes it back in this header on every request. Reject anything
  // without it (or with the wrong value) when the binding is set.
  const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = request.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expectedSecret) {
      return new Response("forbidden", { status: 403 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Process the message in the background; Telegram only needs a 200
  // ACK to mark the update as delivered.
  ctx.waitUntil(handleUpdate(update, env));

  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

/**
 * Scheduled handler — invoked by Cloudflare Cron Triggers from
 * worker/index.ts. Walks every subscribed token, fetches its live
 * DexScreener snapshot, and pushes alerts when thresholds trip.
 */
export async function runWatchtowerCron(env: Env): Promise<void> {
  // 1. Gather the union set of watched tokens across all chats and the
  //    per-chat ChatRecord (so each pipeline can read /alert and /whale
  //    overrides without a second listAllChats pass).
  const chats = await listAllChats(env);
  const tokenWatchers = new Map<string, ChatRecord[]>(); // slug -> [record, ...]
  const tokenWatcherIds = new Map<string, number[]>(); // slug -> [chat_id, ...]
  for (const { chat_id, record } of chats) {
    const withId: ChatRecord = { ...record, last_seen: record.last_seen };
    // Stash chat_id on the record under a private field so downstream
    // helpers can map back. Using a Symbol-ish key keeps it off the
    // serialized KV payload.
    (withId as ChatRecord & { __chat_id?: number }).__chat_id = chat_id;
    for (const slug of record.tokens) {
      if (!isIntelTokenSlug(slug)) continue;
      const recArr = tokenWatchers.get(slug) ?? [];
      recArr.push(withId);
      tokenWatchers.set(slug, recArr);
      const idArr = tokenWatcherIds.get(slug) ?? [];
      idArr.push(chat_id);
      tokenWatcherIds.set(slug, idArr);
    }
  }

  if (tokenWatchers.size === 0) {
    console.log("watchtower cron: no active subscriptions; skipping");
    return;
  }

  // 2. For each token: run price-refresh FIRST so it writes a fresh
  //    snapshot, then run whale + volatility scans in parallel against
  //    that fresh snapshot. Tokens are processed in parallel; the
  //    pipelines within each token are serialized to avoid races on the
  //    `snapshot:<slug>` KV key.
  const slugs = [...tokenWatchers.keys()];
  await Promise.all(
    slugs.map(async (slug) => {
      const records = tokenWatchers.get(slug)!;
      await refreshAndAlertToken(slug, records, env);
      await Promise.all([
        scanWhaleTransfers(slug, records, env),
        checkVolatilitySpike(slug, tokenWatcherIds.get(slug)!, env),
      ]);
    }),
  );

  // 3. Daily leaderboard broadcast — fires only on the 12:00 UTC cron
  //    tick. Because the cron runs hourly the hour-of-day check is the
  //    schedule gate; `broadcastDailyLeaderboard` carries its own
  //    per-day dedupe so a manual cron replay never double-sends.
  if (new Date().getUTCHours() === LEADERBOARD_BROADCAST_UTC_HOUR) {
    await broadcastDailyLeaderboard(env).catch((err) => {
      console.warn(`watchtower cron: leaderboard broadcast failed: ${err}`);
    });
  }
}

// -----------------------------------------------------------------------------
// Telegram update dispatch
// -----------------------------------------------------------------------------

async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env);
    return;
  }

  const msg = update.message ?? update.edited_message;
  if (!msg) return;

  const chatType = msg.chat.type;
  const isGroup = chatType === "group" || chatType === "supergroup";

  // Lifecycle: bot added to a group → welcome onboarding message.
  // We also bootstrap an empty ChatRecord for the group so /watch /alert
  // etc. behave identically to the private-chat path on first use.
  if (msg.new_chat_members && msg.new_chat_members.length > 0) {
    if (isGroup && msg.new_chat_members.some((m) => m.is_bot && isOwnBot(m, env))) {
      await onBotJoinedGroup(env, msg);
    }
    return;
  }

  // Lifecycle: bot kicked from a group → drop the chat record so we
  // stop firing alerts to a chat we can no longer reach. We do NOT
  // delete `portfolio:<chat>` because that's user-private data; portfolio
  // is gated to DMs anyway.
  if (
    msg.left_chat_member &&
    isGroup &&
    msg.left_chat_member.is_bot &&
    isOwnBot(msg.left_chat_member, env)
  ) {
    await env.WATCHTOWER.delete(`chat:${msg.chat.id}`);
    return;
  }

  if (!msg.text) return;

  const text = msg.text.trim();
  const [rawCmd, ...rawArgs] = text.split(/\s+/);
  const cmd = rawCmd.toLowerCase().replace(/@.*/, "");

  // In groups, non-command messages either trigger passive cashtag
  // detection (if the group opted in via `/enable_cashtags`) or are
  // dropped silently. We branch on this BEFORE the rate-limit check so
  // ambient chat ("gm", "wen moon", …) in an active group does NOT
  // burn the 30/min command budget — only real bot work consumes a
  // slot. `maybeHandleCashtag` carries its own per-(group, slug) 10-min
  // dedupe TTL so cashtag bursts are naturally bounded.
  if (isGroup && !cmd.startsWith("/")) {
    await maybeHandleCashtag(env, msg);
    return;
  }

  // Per-group rate limit for actual commands. DMs are not rate-limited
  // (one user, one chat → self-policing).
  if (isGroup) {
    const allowed = await checkGroupRateLimit(env, msg.chat.id);
    if (!allowed) return; // drop silently to avoid spamming the group
  }

  switch (cmd) {
    case "/start":
      await cmdStart(env, msg);
      break;
    case "/help":
      await cmdHelp(env, msg.chat.id);
      break;
    case "/list":
      await cmdList(env, msg.chat.id);
      break;
    case "/watch":
      await cmdWatch(env, msg.chat.id, rawArgs);
      break;
    case "/unwatch":
      await cmdUnwatch(env, msg.chat.id, rawArgs);
      break;
    case "/tokens":
      await cmdTokens(env, msg.chat.id);
      break;
    case "/research":
      await cmdResearch(env, msg.chat.id, rawArgs);
      break;
    case "/chart":
      await cmdChart(env, msg.chat.id, rawArgs);
      break;
    case "/portfolio":
      await cmdPortfolio(env, msg, rawArgs);
      break;
    case "/alert":
      await cmdAlert(env, msg.chat.id, rawArgs);
      break;
    case "/unalert":
      await cmdUnalert(env, msg.chat.id, rawArgs);
      break;
    case "/whale":
      await cmdWhale(env, msg.chat.id, rawArgs);
      break;
    case "/unwhale":
      await cmdUnwhale(env, msg.chat.id, rawArgs);
      break;
    case "/stop":
      await cmdStop(env, msg.chat.id);
      break;
    case "/enable_cashtags":
    case "/enablecashtags":
      await cmdEnableCashtags(env, msg);
      break;
    case "/disable_cashtags":
    case "/disablecashtags":
      await cmdDisableCashtags(env, msg);
      break;
    case "/staking":
      await cmdStaking(env, msg.chat.id);
      break;
    case "/compare":
      await cmdCompare(env, msg.chat.id, rawArgs);
      break;
    case "/explain":
      await cmdExplain(env, msg.chat.id, rawArgs);
      break;
    case "/leaderboard":
      await cmdLeaderboard(env, msg.chat.id);
      break;
    case "/trending":
      await cmdTrending(env, msg.chat.id);
      break;
    default:
      // Stay quiet in groups so a random `/foo` typed by a member
      // doesn't draw an unsolicited reply from the bot.
      if (!isGroup) {
        await sendMessage(env, msg.chat.id, "Unknown command. Try /help.");
      }
  }
}

// -----------------------------------------------------------------------------
// Group-mode helpers (PR-1: public group support)
// -----------------------------------------------------------------------------

/**
 * Compare a Telegram user record against the configured bot identity.
 * The bot's numeric user_id is the prefix of the bot token issued by
 * BotFather (e.g. `8085047757:AAFi…` → user_id `8085047757`). We use that
 * to detect when the bot itself was added to, or removed from, a group.
 */
function isOwnBot(
  member: { id: number; is_bot?: boolean },
  env: Env,
): boolean {
  if (!member.is_bot) return false;
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const prefix = token.split(":", 1)[0];
  const botId = Number(prefix);
  return Number.isFinite(botId) && botId === member.id;
}

/**
 * Fires once when the bot is added to a new group. Bootstraps an empty
 * `ChatRecord` keyed on the (negative) group chat id so subsequent
 * /watch, /alert, etc. behave identically to the private-chat path on
 * first use — and posts a single welcome message that links to the
 * landing page and demonstrates the three highest-signal commands.
 */
async function onBotJoinedGroup(
  env: Env,
  msg: TelegramMessage,
): Promise<void> {
  const chatId = msg.chat.id;
  const title = msg.chat.title ?? "this group";
  // Bootstrap empty ChatRecord if not already present. This is the same
  // shape cmdStart writes for DMs — keeps the cron pipeline schema-uniform.
  const existing = await getChat(env, chatId);
  if (!existing) {
    await putChat(env, chatId, {
      tokens: [],
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }
  const lines = [
    `Vexor Watchtower is live in *${escapeMarkdown(title)}*.`,
    "",
    "This bot tracks 7 Base-mainnet tokens (VT, AERO, BRETT, DEGEN, TOSHI, AEON, BNKR) and pushes alerts on price moves, whale transfers, and volatility spikes.",
    "",
    "Try:",
    "• `/chart vt` — latest snapshot + chart",
    "• `/watch aero` — subscribe this group to AERO alerts",
    "• `/help` — full command list",
    "",
    `Watches set here apply to the group as a whole. Personal data (\`/portfolio\`) stays in DM with me to keep wallets private.`,
    "",
    "More: https://vexorterminal.com",
  ];
  await sendMessage(env, chatId, lines.join("\n"), "Markdown");
}

// Per-group rate limit: anti-spam guard so a noisy group cannot burn
// the bot's Telegram-side quota or generate flood penalties. We allow up
// to GROUP_RATE_LIMIT_BURST messages within GROUP_RATE_LIMIT_WINDOW_SEC.
const GROUP_RATE_LIMIT_BURST = 30;
const GROUP_RATE_LIMIT_WINDOW_SEC = 60;

async function checkGroupRateLimit(
  env: Env,
  chatId: number,
): Promise<boolean> {
  // Bucket key tied to the wall-clock minute. KV is eventually consistent
  // so this is best-effort across regions; it's strict enough to bound
  // worst-case spam without a coordination layer.
  const bucket = Math.floor(Date.now() / 1000 / GROUP_RATE_LIMIT_WINDOW_SEC);
  const key = `rl:group:${chatId}:${bucket}`;
  const raw = await env.WATCHTOWER.get(key);
  const count = raw ? Number(raw) : 0;
  if (count >= GROUP_RATE_LIMIT_BURST) return false;
  await env.WATCHTOWER.put(key, String(count + 1), {
    expirationTtl: GROUP_RATE_LIMIT_WINDOW_SEC * 2,
  });
  return true;
}

// -----------------------------------------------------------------------------
// PR-2: passive cashtag listener (opt-in per group)
// -----------------------------------------------------------------------------

// Match `$AERO` / `$VT` / `$BNKR` etc. — uppercase ticker after a `$`,
// 2-10 chars. We require a non-word boundary before the `$` so cashtags
// embedded mid-word (e.g. `prefix$VT`) don't match — Telegram convention
// is whitespace/start-of-message before the dollar sign. The cross-ref
// against INTEL_TOKENS happens after the regex pass so a `$DOGE` in a
// group does not trigger the bot.
const CASHTAG_REGEX = /(?:^|[^A-Za-z0-9_])\$([A-Z]{2,10})\b/g;

// Per-(group, slug) dedupe TTL. Picks the 10-minute wall-clock bucket so
// the same cashtag mention bursts (e.g. 5 people typing `$VT` in a row)
// only produce one reply per 10 min.
const CASHTAG_DEDUPE_WINDOW_SEC = 600;

// Up to this many distinct cashtag matches per message we reply to.
// Caps the worst-case sendPhoto fan-out from a single spammy message.
const CASHTAG_MAX_PER_MESSAGE = 3;

async function cmdEnableCashtags(
  env: Env,
  msg: TelegramMessage,
): Promise<void> {
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  if (!isGroup) {
    await sendMessage(
      env,
      msg.chat.id,
      "`/enable_cashtags` only applies to group chats. In DMs the bot already replies to every message.",
      "Markdown",
    );
    return;
  }
  // Admin gate: group members shouldn't unilaterally flip the bot into
  // a noise-generating mode for everyone else. We trust Telegram's own
  // role check rather than maintaining our own ACL.
  if (!(await isGroupAdmin(env, msg.chat.id, msg.from?.id))) {
    await sendMessage(
      env,
      msg.chat.id,
      "Only group admins can toggle cashtag mode.",
      "Markdown",
    );
    return;
  }
  const existing = (await getChat(env, msg.chat.id)) ?? {
    tokens: [],
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };
  existing.cashtags_enabled = true;
  existing.last_seen = new Date().toISOString();
  await putChat(env, msg.chat.id, existing);
  const tickers = INTEL_TOKENS.map((t) => `$${t.symbol}`).join(", ");
  await sendMessage(
    env,
    msg.chat.id,
    `Cashtag mode *on* for this group. I'll auto-reply with a chart card whenever someone posts one of: ${tickers}. Disable any time with \`/disable_cashtags\`.\n\nNote: requires *Group Privacy = Disabled* for me in @BotFather, otherwise Telegram only shows me explicit commands.`,
    "Markdown",
  );
}

async function cmdDisableCashtags(
  env: Env,
  msg: TelegramMessage,
): Promise<void> {
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  if (!isGroup) {
    await sendMessage(
      env,
      msg.chat.id,
      "`/disable_cashtags` only applies to group chats.",
      "Markdown",
    );
    return;
  }
  if (!(await isGroupAdmin(env, msg.chat.id, msg.from?.id))) {
    await sendMessage(
      env,
      msg.chat.id,
      "Only group admins can toggle cashtag mode.",
      "Markdown",
    );
    return;
  }
  const existing = await getChat(env, msg.chat.id);
  if (!existing || !existing.cashtags_enabled) {
    await sendMessage(env, msg.chat.id, "Cashtag mode is already off for this group.");
    return;
  }
  existing.cashtags_enabled = false;
  existing.last_seen = new Date().toISOString();
  await putChat(env, msg.chat.id, existing);
  await sendMessage(env, msg.chat.id, "Cashtag mode *off* for this group.", "Markdown");
}

// Scan a group message for `$XXX` cashtags. If the group opted in via
// `/enable_cashtags` and at least one cashtag matches the INTEL_TOKENS
// roster, post a chart card per matched slug (capped, deduped).
async function maybeHandleCashtag(
  env: Env,
  msg: TelegramMessage,
): Promise<void> {
  const text = msg.text;
  if (!text) return;
  // Cheap regex check first to skip the KV read on most messages.
  const matches = new Set<string>();
  for (const m of text.matchAll(CASHTAG_REGEX)) {
    const slug = m[1].toLowerCase();
    if (isIntelTokenSlug(slug)) matches.add(slug);
    if (matches.size >= CASHTAG_MAX_PER_MESSAGE) break;
  }
  if (matches.size === 0) return;

  // Opt-in check — group has to have run `/enable_cashtags`. We do this
  // AFTER the regex so we don't pay a KV read for every chat line.
  const chat = await getChat(env, msg.chat.id);
  if (!chat || !chat.cashtags_enabled) return;

  // Apply the same rate-limit budget here so a single spammy message
  // mentioning many cashtags can't burn through Telegram's quota.
  // The dedupe check comes BEFORE the rate-limit decrement so a busy
  // group where everyone keeps typing `$VT` (the exact target use case)
  // doesn't burn the 30/min slot on a no-op while real commands like
  // `/watch` get silently dropped for the rest of the minute.
  for (const slug of matches) {
    if (await cashtagRecentlySent(env, msg.chat.id, slug)) continue;
    const allowed = await checkGroupRateLimit(env, msg.chat.id);
    if (!allowed) return;
    await sendCashtagChartCard(env, msg.chat.id, slug);
    await markCashtagSent(env, msg.chat.id, slug);
  }
}

// 10-min per-(group, slug) dedupe so a cashtag mention burst only fires
// once. We use a bucketed key (current 10-min window only) so freshness
// is naturally enforced by KV TTL.
async function cashtagRecentlySent(
  env: Env,
  chatId: number,
  slug: string,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000 / CASHTAG_DEDUPE_WINDOW_SEC);
  const key = `cashtag-dedupe:${chatId}:${slug}:${bucket}`;
  const raw = await env.WATCHTOWER.get(key);
  return raw !== null;
}

async function markCashtagSent(
  env: Env,
  chatId: number,
  slug: string,
): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000 / CASHTAG_DEDUPE_WINDOW_SEC);
  const key = `cashtag-dedupe:${chatId}:${slug}:${bucket}`;
  await env.WATCHTOWER.put(key, "1", {
    expirationTtl: CASHTAG_DEDUPE_WINDOW_SEC * 2,
  });
}

// Compact `/chart`-style reply for a cashtag match. We reuse the same
// Pulse Premium snapshot fetch + daily PNG chart attachment that
// `cmdChart` uses, but skip the usage / help paths since the user
// didn't explicitly request the chart.
async function sendCashtagChartCard(
  env: Env,
  chatId: number,
  slug: string,
): Promise<void> {
  const meta = getIntelToken(slug);
  if (!meta) return;

  const baseUrl = (
    env.INTEL_TOKEN_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens"
  ).replace(/\/+$/, "");
  const tokenUrl = `${baseUrl}/${slug}.json`;

  // Fetch snapshot + sentiment in parallel — both come from the same
  // aeon `data` branch CDN.
  let snapshot: PulsePremiumSnapshot | null = null;
  let generatedAt: string | null = null;
  const [snapResult, sentiment] = await Promise.all([
    (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(tokenUrl, {
          signal: ctrl.signal,
          cf: { cacheTtl: 60, cacheEverything: true },
          headers: { "user-agent": "vexor-watchtower-worker/1" },
        });
        clearTimeout(timer);
        if (res.ok) {
          return (await res.json()) as PulsePremiumPayload;
        }
      } catch (err) {
        console.warn(`watchtower: cashtag fetch failed for ${slug}: ${String(err)}`);
      }
      return null;
    })(),
    fetchSentiment(env, slug),
  ]);
  if (snapResult) {
    snapshot = snapResult?.market_snapshot ?? null;
    generatedAt =
      typeof snapResult?.generated_at === "string" ? snapResult.generated_at : null;
  }

  const intelLink = `https://vexorterminal.com/intel/${slug}`;
  const heading = `*${meta.symbol}* \u2014 ${escapeMarkdown(meta.name)}`;

  if (!snapshot) {
    await sendMessage(
      env,
      chatId,
      `${heading}\nPulse Premium snapshot not available yet.\n\nFull intel \u2192 ${intelLink}`,
      "Markdown",
      true,
    );
    return;
  }

  const priceStr = fmtPriceMaybe(snapshot.price_usd ?? null);
  const change24 = snapshot.price_change_24h_pct;
  const chgStr =
    typeof change24 === "number" && Number.isFinite(change24)
      ? ` (${change24 >= 0 ? "+" : ""}${change24.toFixed(1)}% 24h)`
      : "";
  const vol = fmtUsdMaybe(snapshot.volume_24h_usd ?? null);
  const liq = fmtUsdMaybe(snapshot.liquidity_usd ?? null);
  const fdv = fmtUsdMaybe(snapshot.fdv_usd ?? null);
  const ageLine = generatedAt ? `\nSnapshot: ${escapeMarkdown(generatedAt)}` : "";

  const sentTag = formatSentimentTag(sentiment);
  const rationale = typeof sentiment?.rationale === "string" ? sentiment.rationale : "";
  const sentLine =
    sentTag && rationale
      ? `_${sentTag} \u2014 ${escapeMarkdown(rationale)}_`
      : sentTag
        ? `_${sentTag}_`
        : "";

  const body = [
    heading,
    `${priceStr}${chgStr}`,
    `vol ${vol}  \u00B7  liq ${liq}  \u00B7  FDV ${fdv}`,
    sentLine,
    ageLine,
    "",
    `Full intel \u2192 ${intelLink}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const chartBaseUrl = (
    env.INTEL_CHART_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/charts"
  ).replace(/\/+$/, "");
  const photoUrl = `${chartBaseUrl}/${slug}.png`;
  const photoOk = await sendPhoto(env, chatId, photoUrl, body, "Markdown");
  if (!photoOk) {
    await sendMessage(env, chatId, body, "Markdown", true);
  }
}

// Ask Telegram whether a user holds an admin role in a chat. Used to
// gate `/enable_cashtags` / `/disable_cashtags`. Falls back to "not
// admin" if the API call fails — we'd rather under-grant than
// over-grant. `creator` and `administrator` are the two statuses that
// count as admin per Telegram's getChatMember spec.
async function isGroupAdmin(
  env: Env,
  chatId: number,
  userId: number | undefined,
): Promise<boolean> {
  if (!userId) return false;
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const url = `${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      ok?: boolean;
      result?: { status?: string };
    };
    if (!data?.ok || !data.result) return false;
    const status = data.result.status;
    return status === "creator" || status === "administrator";
  } catch (err) {
    console.warn(`watchtower: getChatMember failed: ${String(err)}`);
    return false;
  }
}

// Inline mode entry point. When inline mode is enabled in BotFather
// (`/setinline`), users can invoke @VexorAeonWatchtowerbot from any
// chat by typing `@VexorAeonWatchtowerbot <query>` in the composer.
// We reply with up to 50 InlineQueryResultPhoto entries pointing at
// the daily Pulse Charts PNGs published to the aeon `data` branch.
async function handleInlineQuery(
  iq: TelegramInlineQuery,
  env: Env,
): Promise<void> {
  const chartBaseUrl = (
    env.INTEL_CHART_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/charts"
  ).replace(/\/+$/, "");

  const query = iq.query.trim().toLowerCase().replace(/^\$/, "");

  // Pick which tokens to surface. Empty query = full roster (gallery),
  // otherwise filter by slug or symbol prefix. Telegram caps inline
  // responses at 50 results; we have 7, so no slicing required.
  let matches = INTEL_TOKENS.slice();
  if (query.length > 0) {
    matches = INTEL_TOKENS.filter(
      (t) =>
        t.slug.startsWith(query) ||
        t.symbol.toLowerCase().startsWith(query),
    );
  }

  // Fan out snapshot fetches so we can include live price + 24h delta
  // in the caption. Missing snapshots fall back to a generic caption
  // pointing at the intel page.
  const baseUrl = (
    env.INTEL_TOKEN_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens"
  ).replace(/\/+$/, "");
  const snapshots = await Promise.all(
    matches.map(async (t) => {
      try {
        const res = await fetch(`${baseUrl}/${t.slug}.json`, {
          cf: { cacheTtl: 60, cacheEverything: true },
          headers: { "user-agent": "vexor-watchtower-worker/1" },
        });
        if (!res.ok) return null;
        return (await res.json()) as PulsePremiumPayload;
      } catch {
        return null;
      }
    }),
  );

  const results: InlineQueryResultPhoto[] = matches.map((t, i) => {
    const photoUrl = `${chartBaseUrl}/${t.slug}.png`;
    const snap = snapshots[i]?.market_snapshot;
    const priceStr = fmtPriceMaybe(snap?.price_usd ?? null);
    const chg = snap?.price_change_24h_pct;
    const chgStr =
      chg != null && Number.isFinite(chg)
        ? ` (${chg >= 0 ? "+" : ""}${chg.toFixed(1)}% 24h)`
        : "";
    const caption = [
      `*${t.symbol}*  \u00B7  ${t.name}`,
      `${priceStr}${chgStr}`,
      `Open: https://vexorterminal.com/intel/${t.slug}`,
    ].join("\n");
    return {
      type: "photo",
      id: t.slug,
      photo_url: photoUrl,
      thumb_url: photoUrl,
      title: `$${t.symbol}  \u00B7  ${priceStr}`,
      description: `${t.name}${chgStr}`,
      caption,
      parse_mode: "Markdown",
    };
  });

  // 60s cache lines up with the Pulse Premium snapshot edge cache.
  // After that Telegram will round-trip back for fresh data.
  await answerInlineQuery(env, iq.id, results, 60);
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

async function cmdStart(env: Env, msg: TelegramMessage): Promise<void> {
  const isGroup =
    msg.chat.type === "group" || msg.chat.type === "supergroup";
  const subject = isGroup
    ? `*${escapeMarkdown(msg.chat.title ?? "this group")}*`
    : escapeMarkdown(msg.from?.first_name ?? "anon");
  const existing = await getChat(env, msg.chat.id);
  if (!existing) {
    await putChat(env, msg.chat.id, {
      tokens: [],
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }
  const scopeNote = isGroup
    ? "Watches set here apply to the whole group. Personal data (`/portfolio`) stays in DM."
    : "";
  const portfolioLine = isGroup
    ? "/portfolio <0xWallet> \u2014 one-shot wallet lookup (DM me to bind a wallet privately)"
    : "/portfolio <0xWallet> \u2014 track your holdings + RevShare position";
  const greet = [
    `Vexor Watchtower live in ${subject}.`,
    "",
    "I push a Telegram alert when one of your watched tokens makes a sharp move:",
    `\u2022 price moves \u00B1${PRICE_THRESHOLD_PCT}% within 1h (custom: /alert <slug> <pct>)`,
    `\u2022 liquidity drops \u2265${Math.abs(LIQ_DROP_THRESHOLD_PCT)}% within 1h (rug signal)`,
    `\u2022 whale transfers \u2265 $${fmtUsd(DEFAULT_WHALE_USD)} (opt-in: /whale <slug>)`,
    `\u2022 24h volume \u2265 ${VOLATILITY_SPIKE_FACTOR}\u00D7 median (auto)`,
    "",
    "Commands:",
    "/watch <slug> \u2014 start watching a token (max " + MAX_TOKENS_PER_USER + ")",
    "/unwatch <slug> \u2014 stop watching",
    "/list \u2014 your active watches",
    "/alert <slug> <pct> \u2014 set custom price-move threshold",
    "/whale <slug> <usd> \u2014 set whale-transfer threshold",
    "/tokens \u2014 list every supported slug",
    `/research <slug|CA> \u2014 on-demand AI deep dive (${RESEARCH_DAILY_LIMIT}/day)`,
    "/chart <slug> \u2014 latest Pulse Premium snapshot (price, vol, liq)",
    "/staking \u2014 live $VT RevShare pool stats (TVL, APR, distributed)",
    "/compare <slug> <slug> \u2014 side-by-side stats for two tokens",
    `/explain <slug> \u2014 AI commentary (${EXPLAIN_DAILY_LIMIT}/day)`,
    "/leaderboard \u2014 top 24h gainers/losers (auto-broadcast daily)",
    ...(isGroup
      ? [
          "/enable_cashtags \u2014 (admin) auto-reply on $TICKER mentions",
          "/disable_cashtags \u2014 (admin) turn cashtag auto-reply off",
        ]
      : []),
    portfolioLine,
    "/help \u2014 full command reference",
    "/stop \u2014 unsubscribe entirely",
    "",
    "Examples: `/watch vt`  \u00B7  `/alert vt 5`  \u00B7  `/whale aero 100000`",
    ...(scopeNote ? ["", scopeNote] : []),
  ].join("\n");
  await sendMessage(env, msg.chat.id, greet, "Markdown");
}

async function cmdHelp(env: Env, chatId: number): Promise<void> {
  const lines = [
    "Commands:",
    "/watch <slug> \u2014 watch a token (e.g. `/watch vt`)",
    "/unwatch <slug> \u2014 stop watching a token",
    "/list \u2014 your watchlist + custom alert configs",
    "/alert <slug> <pct> \u2014 custom price-move threshold (e.g. `/alert vt 5`)",
    "/unalert <slug> \u2014 reset to default \u00B1" + PRICE_THRESHOLD_PCT + "%",
    "/whale <slug> <usd> \u2014 alert on transfers \u2265 $X (e.g. `/whale aero 100000`)",
    "/unwhale <slug> \u2014 turn off whale alerts for a token",
    "/tokens \u2014 supported slugs",
    "/research <slug|CA> \u2014 on-demand AI deep dive",
    "/chart <slug> \u2014 latest snapshot (price, vol, liq, FDV)",
    "/portfolio <0xWallet> \u2014 track your holdings + RevShare position",
    "/staking \u2014 live $VT RevShare pool stats (TVL, APR, distributed)",
    "/compare <slug> <slug> \u2014 side-by-side stats for two tokens",
    "/explain <slug> \u2014 AI commentary on recent price + on-chain context",
    "/leaderboard \u2014 top 24h gainers + losers across the roster (also auto-broadcast daily at 12 UTC)",
    "/trending \u2014 hottest tokens by vol/liq activity score + AI sentiment",
    "/enable_cashtags \u2014 (groups, admin) auto-reply on `$VT`/`$AERO`/\u2026 mentions",
    "/disable_cashtags \u2014 (groups, admin) turn cashtag auto-reply off",
    "/stop \u2014 unsubscribe everything",
    "",
    `Free-tier limits: ${MAX_TOKENS_PER_USER} watched tokens, ${RESEARCH_DAILY_LIMIT} researches/day.`,
    `Defaults: price \u00B1${PRICE_THRESHOLD_PCT}% / 1h, liquidity \u2264-${Math.abs(LIQ_DROP_THRESHOLD_PCT)}% / 1h, volatility \u2265${VOLATILITY_SPIKE_FACTOR}\u00D7 median.`,
  ];
  await sendMessage(env, chatId, lines.join("\n"), "Markdown");
}

async function cmdList(env: Env, chatId: number): Promise<void> {
  const chat = await getChat(env, chatId);
  if (!chat || chat.tokens.length === 0) {
    await sendMessage(
      env,
      chatId,
      "You are not watching any tokens. Try `/watch vt`.",
      "Markdown",
    );
    return;
  }
  const rows = await Promise.all(
    chat.tokens.map(async (slug) => {
      const meta = getIntelToken(slug);
      // Fan out snapshot + sentiment in parallel — both come from the
      // same aeon `data` branch CDN, so the overall latency is bounded
      // by the slower of the two (typically <100ms edge-cached).
      const [snap, sentiment] = await Promise.all([
        getSnapshot(env, slug),
        fetchSentiment(env, slug),
      ]);
      const price = snap?.price_usd != null ? `$${fmtUsd(snap.price_usd)}` : "\u2014";
      const customPct = chat.thresholds?.[slug];
      const whaleUsd = chat.whale_thresholds?.[slug];
      const tags: string[] = [];
      const sentTag = formatSentimentTag(sentiment);
      if (sentTag) tags.push(sentTag);
      if (customPct != null) tags.push(`alert \u00B1${customPct}%`);
      if (whaleUsd != null) tags.push(`whale \u2265$${fmtUsd(whaleUsd)}`);
      const tagStr = tags.length > 0 ? `  _${tags.join(" \u00B7 ")}_` : "";
      return `\u2022 *${meta?.symbol ?? slug.toUpperCase()}* (\`${slug}\`) ${price}${tagStr}`;
    }),
  );
  await sendMessage(
    env,
    chatId,
    `Your watchlist (${chat.tokens.length}/${MAX_TOKENS_PER_USER}):\n${rows.join("\n")}`,
    "Markdown",
  );
}

async function cmdWatch(env: Env, chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    await sendMessage(env, chatId, "Usage: `/watch <slug>` (e.g. `/watch vt`).", "Markdown");
    return;
  }
  const slug = normalizeSlugArg(args[0]);
  if (!isIntelTokenSlug(slug)) {
    await sendMessage(
      env,
      chatId,
      `Unknown slug \`${sanitizeSlugForEcho(slug)}\`. Run /tokens to see supported tokens.`,
      "Markdown",
    );
    return;
  }
  const existing = (await getChat(env, chatId)) ?? {
    tokens: [],
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };
  if (existing.tokens.includes(slug)) {
    await sendMessage(env, chatId, `Already watching \`${slug}\`.`, "Markdown");
    return;
  }
  if (existing.tokens.length >= MAX_TOKENS_PER_USER) {
    await sendMessage(
      env,
      chatId,
      `Free-tier cap is ${MAX_TOKENS_PER_USER} tokens. Unwatch one first with \`/unwatch <slug>\`.`,
      "Markdown",
    );
    return;
  }
  existing.tokens.push(slug);
  existing.last_seen = new Date().toISOString();
  await putChat(env, chatId, existing);
  const meta = getIntelToken(slug);
  await sendMessage(
    env,
    chatId,
    `Watching *${meta?.symbol ?? slug.toUpperCase()}*. You will get an alert on \u00B1${PRICE_THRESHOLD_PCT}% / 1h moves. Customize with \`/alert ${slug} <pct>\` or add whale tracking via \`/whale ${slug} <usd>\`.`,
    "Markdown",
  );
}

// -----------------------------------------------------------------------------
// Custom-threshold commands
// -----------------------------------------------------------------------------

async function cmdAlert(
  env: Env,
  chatId: number,
  args: string[],
): Promise<void> {
  if (args.length < 2) {
    await sendMessage(
      env,
      chatId,
      `Usage: \`/alert <slug> <pct>\` (e.g. \`/alert vt 5\`). Range ${MIN_PRICE_THRESHOLD_PCT}\u2013${MAX_PRICE_THRESHOLD_PCT}%.`,
      "Markdown",
    );
    return;
  }
  const slug = normalizeSlugArg(args[0]);
  if (!isIntelTokenSlug(slug)) {
    await sendMessage(
      env,
      chatId,
      `Unknown slug \`${sanitizeSlugForEcho(slug)}\`. Run /tokens to see supported tokens.`,
      "Markdown",
    );
    return;
  }
  const pct = parsePctArg(args[1]);
  if (
    pct == null ||
    pct < MIN_PRICE_THRESHOLD_PCT ||
    pct > MAX_PRICE_THRESHOLD_PCT
  ) {
    await sendMessage(
      env,
      chatId,
      `Threshold must be a number between ${MIN_PRICE_THRESHOLD_PCT} and ${MAX_PRICE_THRESHOLD_PCT}. Got \`${escapeMarkdown(args[1])}\`.`,
      "Markdown",
    );
    return;
  }
  const chat = (await getChat(env, chatId)) ?? {
    tokens: [],
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };
  if (!chat.tokens.includes(slug)) {
    await sendMessage(
      env,
      chatId,
      `Not watching \`${slug}\` yet. Run \`/watch ${slug}\` first.`,
      "Markdown",
    );
    return;
  }
  chat.thresholds = { ...(chat.thresholds ?? {}), [slug]: pct };
  chat.last_seen = new Date().toISOString();
  await putChat(env, chatId, chat);
  const meta = getIntelToken(slug);
  await sendMessage(
    env,
    chatId,
    `Alert threshold for *${meta?.symbol ?? slug.toUpperCase()}* set to \u00B1${pct}% / 1h.`,
    "Markdown",
  );
}

async function cmdUnalert(
  env: Env,
  chatId: number,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    await sendMessage(
      env,
      chatId,
      "Usage: `/unalert <slug>` (reverts to default \u00B1" + PRICE_THRESHOLD_PCT + "%).",
      "Markdown",
    );
    return;
  }
  const slug = normalizeSlugArg(args[0]);
  const chat = await getChat(env, chatId);
  if (!chat || !chat.thresholds || chat.thresholds[slug] == null) {
    await sendMessage(
      env,
      chatId,
      `No custom alert set for \`${sanitizeSlugForEcho(slug)}\` (already on default).`,
      "Markdown",
    );
    return;
  }
  delete chat.thresholds[slug];
  if (Object.keys(chat.thresholds).length === 0) delete chat.thresholds;
  chat.last_seen = new Date().toISOString();
  await putChat(env, chatId, chat);
  const meta = getIntelToken(slug);
  await sendMessage(
    env,
    chatId,
    `Reverted *${meta?.symbol ?? slug.toUpperCase()}* to default \u00B1${PRICE_THRESHOLD_PCT}% / 1h.`,
    "Markdown",
  );
}

async function cmdWhale(
  env: Env,
  chatId: number,
  args: string[],
): Promise<void> {
  if (args.length < 2) {
    await sendMessage(
      env,
      chatId,
      `Usage: \`/whale <slug> <usd>\` (e.g. \`/whale vt 25000\`). Range $${fmtUsd(MIN_WHALE_USD)}\u2013$${fmtUsd(MAX_WHALE_USD)}.`,
      "Markdown",
    );
    return;
  }
  const slug = normalizeSlugArg(args[0]);
  if (!isIntelTokenSlug(slug)) {
    await sendMessage(
      env,
      chatId,
      `Unknown slug \`${sanitizeSlugForEcho(slug)}\`. Run /tokens to see supported tokens.`,
      "Markdown",
    );
    return;
  }
  const usd = parseUsdArg(args[1]);
  if (usd == null || usd < MIN_WHALE_USD || usd > MAX_WHALE_USD) {
    await sendMessage(
      env,
      chatId,
      `Whale threshold must be a number between ${MIN_WHALE_USD} and ${MAX_WHALE_USD}. Got \`${escapeMarkdown(args[1])}\`.`,
      "Markdown",
    );
    return;
  }
  const chat = (await getChat(env, chatId)) ?? {
    tokens: [],
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };
  if (!chat.tokens.includes(slug)) {
    await sendMessage(
      env,
      chatId,
      `Not watching \`${slug}\` yet. Run \`/watch ${slug}\` first.`,
      "Markdown",
    );
    return;
  }
  chat.whale_thresholds = {
    ...(chat.whale_thresholds ?? {}),
    [slug]: usd,
  };
  chat.last_seen = new Date().toISOString();
  await putChat(env, chatId, chat);
  const meta = getIntelToken(slug);
  await sendMessage(
    env,
    chatId,
    `Whale alerts on for *${meta?.symbol ?? slug.toUpperCase()}* at \u2265 $${fmtUsd(usd)} per transfer.`,
    "Markdown",
  );
}

async function cmdUnwhale(
  env: Env,
  chatId: number,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    await sendMessage(env, chatId, "Usage: `/unwhale <slug>`.", "Markdown");
    return;
  }
  const slug = normalizeSlugArg(args[0]);
  const chat = await getChat(env, chatId);
  if (
    !chat ||
    !chat.whale_thresholds ||
    chat.whale_thresholds[slug] == null
  ) {
    await sendMessage(
      env,
      chatId,
      `No whale alert set for \`${sanitizeSlugForEcho(slug)}\`.`,
      "Markdown",
    );
    return;
  }
  delete chat.whale_thresholds[slug];
  if (Object.keys(chat.whale_thresholds).length === 0) {
    delete chat.whale_thresholds;
  }
  chat.last_seen = new Date().toISOString();
  await putChat(env, chatId, chat);
  const meta = getIntelToken(slug);
  await sendMessage(
    env,
    chatId,
    `Whale alerts off for *${meta?.symbol ?? slug.toUpperCase()}*.`,
    "Markdown",
  );
}

function parsePctArg(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Normalize a user-typed slug arg: strip an optional `$` cashtag prefix,
// trim whitespace, and lowercase. Crypto-Telegram users naturally type
// `$VT` from cashtag convention, so every command that takes a slug
// arg accepts both `vt` and `$VT`. Mirrors the inline parsing in
// cmdChart / cmdCompare / cmdExplain so all 14 slug-taking commands
// behave identically.
function normalizeSlugArg(raw: string): string {
  return raw.trim().replace(/^\$/, "").toLowerCase();
}

function parseUsdArg(raw: string): number | null {
  // Accepts: 50000, 50_000, 50,000, $50000, 50k, 1.5m
  const cleaned = raw.replace(/[$,\s_]/g, "").toLowerCase();
  const match = cleaned.match(/^([\d.]+)([km])?$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = match[2];
  if (suffix === "k") return n * 1_000;
  if (suffix === "m") return n * 1_000_000;
  return n;
}

async function cmdUnwatch(env: Env, chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    await sendMessage(env, chatId, "Usage: `/unwatch <slug>`.", "Markdown");
    return;
  }
  const slug = normalizeSlugArg(args[0]);
  const existing = await getChat(env, chatId);
  if (!existing || !existing.tokens.includes(slug)) {
    await sendMessage(
      env,
      chatId,
      `Not currently watching \`${sanitizeSlugForEcho(slug)}\`.`,
      "Markdown",
    );
    return;
  }
  existing.tokens = existing.tokens.filter((t) => t !== slug);
  existing.last_seen = new Date().toISOString();
  await putChat(env, chatId, existing);
  await sendMessage(env, chatId, `Stopped watching \`${slug}\`.`, "Markdown");
}

async function cmdTokens(env: Env, chatId: number): Promise<void> {
  const rows = INTEL_TOKENS.map((t) => `\u2022 *${t.symbol}* \u2014 \`${t.slug}\``);
  await sendMessage(
    env,
    chatId,
    `Supported tokens (${INTEL_TOKENS.length}):\n${rows.join("\n")}\n\nUse \`/watch <slug>\` to start.`,
    "Markdown",
  );
}

async function cmdResearch(env: Env, chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    await sendMessage(
      env,
      chatId,
      "Usage: `/research <slug>` or `/research <0x-CA>` (e.g. `/research vt`).",
      "Markdown",
    );
    return;
  }
  const input = parseResearchInput(args[0]);
  if (!input) {
    await sendMessage(
      env,
      chatId,
      `Unrecognized input \`${sanitizeSlugForEcho(args[0])}\`. Pass one of the supported slugs (see /tokens) or a 0x-prefixed Base mainnet address.`,
      "Markdown",
    );
    return;
  }

  // Rate-limit check against per-chat per-UTC-day counter. We read and
  // check here, but only *increment* the counter after the brief is
  // successfully synthesized — otherwise an upstream blip (Groq down,
  // DexScreener timeout, ResearchError on a bad CA) would burn one of
  // the user's 3 daily slots without delivering anything.
  const today = utcDayKey(new Date());
  const counterKey = researchCounterKey(chatId, today);
  const used = await readCounter(env, counterKey);
  if (used >= RESEARCH_DAILY_LIMIT) {
    await sendMessage(
      env,
      chatId,
      `Daily \`/research\` quota reached (${used}/${RESEARCH_DAILY_LIMIT}). Resets at 00:00 UTC.`,
      "Markdown",
    );
    return;
  }

  // ACK so the user knows the bot heard them; the LLM call below can
  // take 10-20s and Telegram users get nervous without an immediate
  // reply. Quota shown is "what it will be on success" so the user
  // sees an honest budget — we commit the write on the success path.
  await sendMessage(
    env,
    chatId,
    `\uD83D\uDD2C Researching ${input.label}\u2026 brief incoming in ~30s. (Quota today: ${used + 1}/${RESEARCH_DAILY_LIMIT}.)`,
    "Markdown",
  );

  try {
    const brief = await produceResearchBrief(env, input);
    // Commit the quota slot ONLY after we have a real brief in hand.
    // sendMessage doesn't throw on Telegram API errors (it just logs)
    // so the user still gets charged for transient Telegram-side
    // failures; that tradeoff is acceptable because the work was done.
    await writeCounter(env, counterKey, used + 1);
    await sendMessage(env, chatId, brief, "Markdown");
  } catch (err) {
    if (err instanceof ResearchError) {
      // User-facing soft errors (bad CA, no pair on Base, etc.) — do
      // not charge quota since no real work happened.
      await sendMessage(env, chatId, err.message, "Markdown");
    } else {
      console.warn("watchtower: research failed", err);
      await sendMessage(
        env,
        chatId,
        `Research failed for ${input.label}. The upstream data feed or model is unreachable right now \u2014 try again in a minute.`,
        "Markdown",
      );
    }
  }
}

// `/chart` — pull the latest Pulse Premium snapshot for a token and reply
// with a one-screen stat block + a link to the per-token intel page (which
// Telegram unfurls into a rich preview, giving the user an inline chart
// without us rendering an image here).
async function cmdChart(env: Env, chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    const list = INTEL_TOKENS.map((t) => t.symbol).join(", ");
    await sendMessage(
      env,
      chatId,
      `Usage: \`/chart <slug>\`\nAvailable: ${list}\n\nExample: \`/chart vt\``,
      "Markdown",
    );
    return;
  }

  // Accept `vt`, `$vt`, `VT`, `$VT`.
  const raw = normalizeSlugArg(args[0]);
  if (!isIntelTokenSlug(raw)) {
    const list = INTEL_TOKENS.map((t) => t.symbol).join(", ");
    await sendMessage(
      env,
      chatId,
      `Unknown ticker \`${sanitizeSlugForEcho(args[0])}\`. Available: ${list}.`,
      "Markdown",
    );
    return;
  }
  const slug = raw;
  const meta = getIntelToken(slug);
  if (!meta) {
    // Defensive — isIntelTokenSlug returned true so this branch should
    // never fire, but tightens the type for the downstream interpolation.
    await sendMessage(env, chatId, "Internal error: token metadata missing.");
    return;
  }

  const baseUrl = (
    env.INTEL_TOKEN_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens"
  ).replace(/\/+$/, "");
  const tokenUrl = `${baseUrl}/${slug}.json`;

  // Fetch snapshot + sentiment in parallel. Sentiment is optional —
  // /chart still renders if it's missing; we just skip the appended
  // rationale line.
  let snapshot: PulsePremiumSnapshot | null = null;
  let generatedAt: string | null = null;
  const [snapResult, sentiment] = await Promise.all([
    (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(tokenUrl, {
          signal: ctrl.signal,
          cf: { cacheTtl: 60, cacheEverything: true },
          headers: { "user-agent": "vexor-watchtower-worker/1" },
        });
        clearTimeout(timer);
        if (res.ok) {
          return (await res.json()) as PulsePremiumPayload;
        }
      } catch (err) {
        console.warn(`watchtower: /chart fetch failed for ${slug}: ${String(err)}`);
      }
      return null;
    })(),
    fetchSentiment(env, slug),
  ]);
  if (snapResult) {
    snapshot = snapResult?.market_snapshot ?? null;
    generatedAt =
      typeof snapResult?.generated_at === "string" ? snapResult.generated_at : null;
  }

  const intelLink = `https://vexorterminal.com/intel/${slug}`;
  const heading = `*${meta.symbol}* \u2014 ${escapeMarkdown(meta.name)}`;

  if (!snapshot) {
    await sendMessage(
      env,
      chatId,
      `${heading}\nPulse Premium snapshot not available yet (cron may not have produced this token's feed).\n\nFull intel \u2192 ${intelLink}`,
      "Markdown",
      true, // unfurl the intel link so the per-token page preview shows
    );
    return;
  }

  const priceStr = fmtPriceMaybe(snapshot.price_usd ?? null);
  const change24 = snapshot.price_change_24h_pct;
  const chgStr =
    typeof change24 === "number" && Number.isFinite(change24)
      ? ` (${change24 >= 0 ? "+" : ""}${change24.toFixed(1)}% 24h)`
      : "";
  const vol = fmtUsdMaybe(snapshot.volume_24h_usd ?? null);
  const liq = fmtUsdMaybe(snapshot.liquidity_usd ?? null);
  const fdv = fmtUsdMaybe(snapshot.fdv_usd ?? null);
  const ageLine = generatedAt ? `\nSnapshot: ${escapeMarkdown(generatedAt)}` : "";

  const sentTag = formatSentimentTag(sentiment);
  const rationale = typeof sentiment?.rationale === "string" ? sentiment.rationale : "";
  const sentLine =
    sentTag && rationale
      ? `_${sentTag} \u2014 ${escapeMarkdown(rationale)}_`
      : sentTag
        ? `_${sentTag}_`
        : "";

  const body = [
    heading,
    `${priceStr}${chgStr}`,
    `vol ${vol}  \u00B7  liq ${liq}  \u00B7  FDV ${fdv}`,
    sentLine,
    ageLine,
    "",
    `Full intel \u2192 ${intelLink}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  // Try to attach the daily-rendered candlestick PNG via `sendPhoto`.
  // Charts live on the vexor-aeon `data` branch under `intel/charts/`,
  // refreshed daily at 12:30 UTC by the `vexor-pulse-charts` workflow.
  // Telegram fetches the URL itself so we just pass the photo URL.
  //
  // If the photo isn't available yet (e.g. chart workflow hasn't run
  // for this token, GitHub Raw is having a moment, Telegram couldn't
  // fetch the URL), fall back to the previous text-only reply with an
  // unfurled intel-page link preview so the user still gets something
  // useful.
  const chartBaseUrl = (
    env.INTEL_CHART_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/charts"
  ).replace(/\/+$/, "");
  const photoUrl = `${chartBaseUrl}/${slug}.png`;
  const photoOk = await sendPhoto(env, chatId, photoUrl, body, "Markdown");
  if (!photoOk) {
    await sendMessage(env, chatId, body, "Markdown", true);
  }
}

// -----------------------------------------------------------------------------
// Bot trio v2: /staking, /compare, /explain
// -----------------------------------------------------------------------------

// `/staking` — live $VT RevShare pool stats. We hit the worker's own
// public `/api/pool` endpoint (edge-cached 60s) so we get a single
// normalized JSON payload covering on-chain + market data, and don't
// duplicate the multi-RPC + log-window aggregation logic here.
interface PoolApiPayload {
  fetched_at?: string;
  block_number?: number;
  pool?: {
    total_staked_vt?: string;
    pool_balance_vt?: string;
  };
  rewards?: {
    total_distributed_vt?: string;
    estimated_apr_percent?: number | null;
    avg_push_interval_hours?: number | null;
  };
  market?: {
    vt_price_usd?: number | null;
    market_cap_usd?: number | null;
    fdv_usd?: number | null;
  };
  links?: {
    site?: string;
    docs?: string;
    basescan_revshare?: string;
  };
}

async function cmdStaking(env: Env, chatId: number): Promise<void> {
  let payload: PoolApiPayload | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    // Hit our own origin so the response is served from the same edge
    // cache the landing widget uses. In Workers we can use a relative
    // URL via the ASSETS fetcher fallback, but the simplest portable
    // option is the canonical vexorterminal.com host.
    const res = await fetch("https://vexorterminal.com/api/pool", {
      signal: ctrl.signal,
      cf: { cacheTtl: 60, cacheEverything: true },
      headers: { "user-agent": "vexor-watchtower-worker/1" },
    });
    clearTimeout(timer);
    if (res.ok) {
      payload = (await res.json()) as PoolApiPayload;
    }
  } catch (err) {
    console.warn(`watchtower: /staking fetch failed: ${String(err)}`);
  }

  if (!payload || !payload.pool) {
    await sendMessage(
      env,
      chatId,
      "Couldn't read the RevShare pool right now. Try again in a minute, or check https://vexorterminal.com/docs/staking.",
      "Markdown",
    );
    return;
  }

  const totalStakedVt = Number(payload.pool.total_staked_vt ?? "0");
  const poolBalanceVt = Number(payload.pool.pool_balance_vt ?? "0");
  const distributed = Number(payload.rewards?.total_distributed_vt ?? "0");
  const apr = payload.rewards?.estimated_apr_percent;
  const intervalHours = payload.rewards?.avg_push_interval_hours;
  const vtPrice = payload.market?.vt_price_usd ?? null;
  const tvlUsd =
    typeof vtPrice === "number" && Number.isFinite(vtPrice)
      ? totalStakedVt * vtPrice
      : null;
  const fdv = payload.market?.fdv_usd ?? null;

  const aprStr =
    typeof apr === "number" && Number.isFinite(apr)
      ? `${apr.toFixed(1)}%`
      : "\u2014";
  const intervalStr =
    typeof intervalHours === "number" && Number.isFinite(intervalHours)
      ? `~${intervalHours.toFixed(1)}h between reward pushes (30d avg)`
      : "no recent reward pushes in the 30d window";

  const body = [
    "*VexorRevShare pool* \u2014 Base mainnet",
    "",
    `TVL: ${fmtUsdMaybe(tvlUsd)}  (${totalStakedVt.toFixed(2)} VT staked)`,
    `Estimated APR: *${aprStr}*  \u00B7  ${intervalStr}`,
    `Pool balance: ${poolBalanceVt.toFixed(2)} VT pending push`,
    `Lifetime distributed: ${distributed.toFixed(2)} VT`,
    "",
    `VT price: ${fmtPriceMaybe(vtPrice)}  \u00B7  FDV: ${fmtUsdMaybe(fdv)}`,
    "",
    `Stake $VT \u2192 https://vexorterminal.com/console`,
    `Docs \u2192 https://vexorterminal.com/docs/staking`,
  ].join("\n");
  await sendMessage(env, chatId, body, "Markdown", true);
}

// `/compare <slug> <slug>` — side-by-side Pulse Premium snapshots.
async function cmdCompare(
  env: Env,
  chatId: number,
  args: string[],
): Promise<void> {
  if (args.length < 2) {
    const list = INTEL_TOKENS.map((t) => t.symbol).join(", ");
    await sendMessage(
      env,
      chatId,
      `Usage: \`/compare <slug> <slug>\`\nAvailable: ${list}\n\nExample: \`/compare vt aero\``,
      "Markdown",
    );
    return;
  }
  const slugA = normalizeSlugArg(args[0]);
  const slugB = normalizeSlugArg(args[1]);
  if (!isIntelTokenSlug(slugA)) {
    await sendMessage(
      env,
      chatId,
      `Unknown ticker \`${sanitizeSlugForEcho(args[0])}\`. Run /tokens.`,
      "Markdown",
    );
    return;
  }
  if (!isIntelTokenSlug(slugB)) {
    await sendMessage(
      env,
      chatId,
      `Unknown ticker \`${sanitizeSlugForEcho(args[1])}\`. Run /tokens.`,
      "Markdown",
    );
    return;
  }
  if (slugA === slugB) {
    await sendMessage(
      env,
      chatId,
      "Pass two *different* slugs to compare. (Use `/chart <slug>` for a single token.)",
      "Markdown",
    );
    return;
  }

  const [snapA, snapB] = await Promise.all([
    fetchPulseSnapshot(env, slugA),
    fetchPulseSnapshot(env, slugB),
  ]);
  const metaA = getIntelToken(slugA);
  const metaB = getIntelToken(slugB);
  if (!metaA || !metaB) {
    await sendMessage(env, chatId, "Internal error: token metadata missing.");
    return;
  }

  const lines: string[] = [
    `*${metaA.symbol}* vs *${metaB.symbol}*`,
    "",
    compareRow("Price", fmtPriceMaybe(snapA?.price_usd ?? null), fmtPriceMaybe(snapB?.price_usd ?? null)),
    compareRow("24h", changePctStr(snapA?.price_change_24h_pct), changePctStr(snapB?.price_change_24h_pct)),
    compareRow("Vol 24h", fmtUsdMaybe(snapA?.volume_24h_usd ?? null), fmtUsdMaybe(snapB?.volume_24h_usd ?? null)),
    compareRow("Liquidity", fmtUsdMaybe(snapA?.liquidity_usd ?? null), fmtUsdMaybe(snapB?.liquidity_usd ?? null)),
    compareRow("FDV", fmtUsdMaybe(snapA?.fdv_usd ?? null), fmtUsdMaybe(snapB?.fdv_usd ?? null)),
    "",
    `${metaA.symbol} \u2192 https://vexorterminal.com/intel/${slugA}`,
    `${metaB.symbol} \u2192 https://vexorterminal.com/intel/${slugB}`,
  ];
  await sendMessage(env, chatId, lines.join("\n"), "Markdown");
}

// Format a `Label   valueA  vs  valueB` row with monospaced alignment.
// Telegram legacy Markdown doesn't support tables, so we render inside a
// fenced code block separately — here we just emit a single-line pair.
function compareRow(label: string, a: string, b: string): string {
  const labelPad = label.padEnd(10, " ");
  return `\`${labelPad}\`  ${a}  vs  ${b}`;
}

function changePctStr(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "\u2014";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// Pulse Premium snapshot fetch helper — reused by `/compare` and
// `/explain`. Same edge-cached path as `cmdChart` uses.
async function fetchPulseSnapshot(
  env: Env,
  slug: string,
): Promise<PulsePremiumSnapshot | null> {
  const baseUrl = (
    env.INTEL_TOKEN_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens"
  ).replace(/\/+$/, "");
  const tokenUrl = `${baseUrl}/${slug}.json`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(tokenUrl, {
      signal: ctrl.signal,
      cf: { cacheTtl: 60, cacheEverything: true },
      headers: { "user-agent": "vexor-watchtower-worker/1" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as PulsePremiumPayload;
    return data?.market_snapshot ?? null;
  } catch (err) {
    console.warn(`watchtower: pulse snapshot fetch failed for ${slug}: ${String(err)}`);
    return null;
  }
}

// Fetch the per-token AI sentiment JSON produced by the vexor-sentiment
// workflow. Returns null on any failure (missing file, network blip,
// JSON parse error). The Telegram surfaces ALWAYS degrade gracefully:
// no sentiment data = no tag/badge/rationale, never a hard error.
//
// 5 min CF cache TTL — the source updates once daily at 12:45 UTC, so
// even 5 min is overkill for freshness but minimizes Raw GitHub egress.
async function fetchSentiment(
  env: Env,
  slug: string,
): Promise<SentimentPayload | null> {
  const baseUrl = (
    env.INTEL_SENTIMENT_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/sentiment"
  ).replace(/\/+$/, "");
  const url = `${baseUrl}/${slug}.json`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      cf: { cacheTtl: 300, cacheEverything: true },
      headers: { "user-agent": "vexor-watchtower-worker/1" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as SentimentPayload;
    const label = typeof data?.label === "string" ? data.label.toLowerCase() : "";
    if (label !== "bullish" && label !== "bearish" && label !== "neutral") {
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`watchtower: sentiment fetch failed for ${slug}: ${String(err)}`);
    return null;
  }
}

// Compact label suitable for inline italic tags (e.g. /list rows).
// Returns null when there's no usable sentiment, so callers can drop
// the tag instead of rendering an empty placeholder.
function formatSentimentTag(s: SentimentPayload | null): string | null {
  if (!s || typeof s.label !== "string") return null;
  const label = s.label.toLowerCase();
  if (label === "bullish") return "\uD83D\uDFE2 bullish";
  if (label === "bearish") return "\uD83D\uDD34 bearish";
  if (label === "neutral") return "\u26AA neutral";
  return null;
}

// `/explain <slug>` — Groq LLM commentary on recent price + on-chain
// context. Rate-limited per-chat to bound LLM cost.
const EXPLAIN_DAILY_LIMIT = 5;
const EXPLAIN_KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

async function cmdExplain(
  env: Env,
  chatId: number,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    const list = INTEL_TOKENS.map((t) => t.symbol).join(", ");
    await sendMessage(
      env,
      chatId,
      `Usage: \`/explain <slug>\`\nAvailable: ${list}\n\nExample: \`/explain vt\``,
      "Markdown",
    );
    return;
  }
  const slug = normalizeSlugArg(args[0]);
  if (!isIntelTokenSlug(slug)) {
    await sendMessage(
      env,
      chatId,
      `Unknown ticker \`${sanitizeSlugForEcho(args[0])}\`. Run /tokens.`,
      "Markdown",
    );
    return;
  }
  if (!env.GROQ_API_KEY) {
    await sendMessage(
      env,
      chatId,
      "AI commentary is not configured on this deploy (no GROQ_API_KEY).",
    );
    return;
  }

  // Per-chat daily budget. Same wall-clock-day bucket scheme as /research.
  const day = new Date().toISOString().slice(0, 10);
  const limitKey = `explain:${chatId}:${day}`;
  const usedRaw = await env.WATCHTOWER.get(limitKey);
  const used = usedRaw ? Number(usedRaw) : 0;
  if (used >= EXPLAIN_DAILY_LIMIT) {
    await sendMessage(
      env,
      chatId,
      `Daily \`/explain\` limit reached (${EXPLAIN_DAILY_LIMIT}/day). Resets at 00:00 UTC.`,
      "Markdown",
    );
    return;
  }

  const meta = getIntelToken(slug);
  if (!meta) {
    await sendMessage(env, chatId, "Internal error: token metadata missing.");
    return;
  }
  const snap = await fetchPulseSnapshot(env, slug);
  if (!snap) {
    await sendMessage(
      env,
      chatId,
      `No Pulse Premium snapshot for \`${slug}\` yet \u2014 cron may not have produced this token's feed today.`,
      "Markdown",
    );
    return;
  }

  const facts = [
    `Token: $${meta.symbol} (${meta.name})`,
    `Chain: Base mainnet`,
    `Price (USD): ${snap.price_usd ?? "n/a"}`,
    `24h change: ${snap.price_change_24h_pct ?? "n/a"}%`,
    `24h volume: $${snap.volume_24h_usd ?? "n/a"}`,
    `Liquidity: $${snap.liquidity_usd ?? "n/a"}`,
    `FDV: $${snap.fdv_usd ?? "n/a"}`,
  ].join("\n");

  const systemPrompt = `You are Vexor Watchtower's market commentary mode. Given a single Base-mainnet token's latest market snapshot, write a concise commentary in 2-3 short paragraphs covering: (1) what the 24h price action implies about momentum, (2) how the liquidity / volume ratio compares to a healthy mid-cap DEX pair (call out thin liquidity if liq < 100k), (3) one neutral risk callout and one neutral bullish callout. Avoid price predictions and "wen moon" language. Do not invent on-chain numbers beyond what is provided. End with a one-line disclaimer that this is not financial advice. Keep total length under 1500 chars.`;
  const userPrompt = `Latest snapshot:\n${facts}\n\nWrite the commentary now.`;

  let reply = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          authorization: `Bearer ${env.GROQ_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
          max_tokens: 600,
          temperature: 0.4,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      },
    );
    clearTimeout(timer);
    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      console.warn(`watchtower: /explain groq ${groqRes.status} ${errText}`);
      await sendMessage(
        env,
        chatId,
        "AI commentary upstream errored. Try again in a moment.",
      );
      return;
    }
    const data = (await groqRes.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    reply = (data.choices?.[0]?.message?.content ?? "").trim();
  } catch (err) {
    console.warn(`watchtower: /explain fetch failed: ${String(err)}`);
    await sendMessage(env, chatId, "AI commentary network error. Try again.");
    return;
  }

  if (!reply) {
    await sendMessage(env, chatId, "AI commentary returned empty. Try again.");
    return;
  }

  // Bump the daily counter only after a successful reply so failed
  // attempts don't burn the user's budget.
  await env.WATCHTOWER.put(limitKey, String(used + 1), {
    expirationTtl: EXPLAIN_KEY_TTL_SECONDS,
  });

  // Send plain text (no Markdown parse) because Groq output can include
  // unbalanced `*` / `_` that Telegram would reject. The chart card
  // below is opt-in for users that want both.
  const header = `*${meta.symbol}* \u2014 AI commentary\n`;
  const footer = `\n\n_${EXPLAIN_DAILY_LIMIT - used - 1} \`/explain\` calls left today._`;
  // Send header in Markdown, body in plain text, footer in Markdown via
  // a separate small message so we never have to escape the body.
  await sendMessage(env, chatId, header.trim(), "Markdown");
  await sendMessage(env, chatId, reply);
  await sendMessage(env, chatId, footer.trim(), "Markdown");
}

// -----------------------------------------------------------------------------
// /leaderboard — daily 24h gainer/loser ranking across the 7-token roster.
//
// Reads the latest Pulse Premium snapshot for each token (24h % change),
// formats top-N up and down lists. Used both as an on-demand bot command
// and as a daily 12:00 UTC broadcast to every chat with a non-empty
// watchlist. The same body string is shared by both paths so the on-demand
// reply and the broadcast cannot drift in formatting.
// -----------------------------------------------------------------------------

const LEADERBOARD_TOP_N = 3;
const LEADERBOARD_BROADCAST_UTC_HOUR = 12;
// 36h outlasts the 24h gap between broadcast triggers, so the dedupe
// key is guaranteed alive across the entire broadcast window even if
// the cron fires twice within the same UTC hour (e.g. retry).
const LEADERBOARD_BROADCAST_TTL_SECONDS = 36 * 60 * 60;

interface LeaderboardRow {
  slug: string;
  symbol: string;
  pct: number;
  price_usd: number | null;
}

async function buildLeaderboardBody(env: Env): Promise<string | null> {
  // Fetch snapshot + sentiment per token in parallel. Sentiment is
  // optional — we just append the label after the row if present.
  const fetches = INTEL_TOKENS.map(async (tok) => ({
    tok,
    snap: await fetchPulseSnapshot(env, tok.slug),
    sent: await fetchSentiment(env, tok.slug),
  }));
  const results = await Promise.all(fetches);
  const rows: (LeaderboardRow & { sentLabel: string | null })[] = [];
  for (const { tok, snap, sent } of results) {
    if (!snap) continue;
    const pct = snap.price_change_24h_pct;
    if (pct == null || !Number.isFinite(pct)) continue;
    rows.push({
      slug: tok.slug,
      symbol: tok.symbol,
      pct,
      price_usd: snap.price_usd ?? null,
      sentLabel: formatSentimentTag(sent),
    });
  }
  if (rows.length === 0) return null;

  const gainers = rows
    .filter((r) => r.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, LEADERBOARD_TOP_N);
  const losers = rows
    .filter((r) => r.pct < 0)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, LEADERBOARD_TOP_N);

  const fmtRow = (r: LeaderboardRow & { sentLabel: string | null }): string => {
    const base = `\u2022 *${r.symbol}* ${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(1)}%  \u00B7  ${fmtPriceMaybe(r.price_usd)}`;
    return r.sentLabel ? `${base}  _${r.sentLabel}_` : base;
  };

  const day = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `\uD83D\uDCCA *Vexor Leaderboard* \u2014 ${day} UTC`,
    "",
  ];
  if (gainers.length > 0) {
    lines.push("\uD83D\uDFE2 Top gainers (24h):");
    lines.push(...gainers.map(fmtRow));
    lines.push("");
  }
  if (losers.length > 0) {
    lines.push("\uD83D\uDD34 Top losers (24h):");
    lines.push(...losers.map(fmtRow));
    lines.push("");
  }
  if (gainers.length === 0 && losers.length === 0) {
    lines.push("All 7 tokens flat on 24h. Quiet day on Base.");
    lines.push("");
  }
  lines.push("Open chart \u2192 `/chart <ticker>`  \u00B7  Full intel \u2192 https://vexorterminal.com/intel");
  return lines.join("\n");
}

async function cmdLeaderboard(env: Env, chatId: number): Promise<void> {
  const body = await buildLeaderboardBody(env);
  if (!body) {
    await sendMessage(
      env,
      chatId,
      "Leaderboard unavailable \u2014 Pulse Premium snapshots not produced yet for any roster token. Try again after the next 12:00 UTC refresh.",
    );
    return;
  }
  await sendMessage(env, chatId, body, "Markdown");
}

async function broadcastDailyLeaderboard(env: Env): Promise<void> {
  // Per-UTC-day dedupe guard. The guard is checked first to short-circuit
  // a same-day retry, but it's only WRITTEN after `buildLeaderboardBody`
  // succeeds AND we know we have at least one recipient. A transient
  // Pulse Premium fetch failure (snapshots not yet produced, network
  // hiccup, etc.) must not burn the entire UTC-day broadcast window.
  const day = new Date().toISOString().slice(0, 10);
  const guardKey = `leaderboard:broadcast:${day}`;
  if (await env.WATCHTOWER.get(guardKey)) {
    console.log(`watchtower cron: leaderboard already broadcast for ${day}`);
    return;
  }

  const body = await buildLeaderboardBody(env);
  if (!body) {
    console.warn(
      "watchtower cron: leaderboard body empty, skipping fanout " +
        "(guard not written; broadcast only fires on the 12:00 UTC cron tick, " +
        "so the next automatic retry is ~24h away — manual cron dispatch can retry sooner)",
    );
    return;
  }
  const chats = await listAllChats(env);
  const recipients = chats.filter(
    ({ record }) => Array.isArray(record.tokens) && record.tokens.length > 0,
  );
  if (recipients.length === 0) {
    // No recipients = nothing to dedupe. Don't burn the guard so a chat
    // that runs /watch in the next hour still gets the broadcast on the
    // next 12:00 UTC tick (well, next day, but the behavior is correct).
    return;
  }

  // Body built + recipients found: commit the guard before fanout so a
  // concurrent cron retry mid-broadcast cannot kick off a second
  // parallel fanout.
  await env.WATCHTOWER.put(guardKey, new Date().toISOString(), {
    expirationTtl: LEADERBOARD_BROADCAST_TTL_SECONDS,
  });
  console.log(
    `watchtower cron: broadcasting leaderboard to ${recipients.length} chats`,
  );

  // Telegram global rate limit is 30 msg/sec. We process 6 chats per
  // batch and sleep 250ms between batches — 24 msg/sec sustained,
  // comfortably under the cap for any realistic chat count.
  const BATCH_SIZE = 6;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ chat_id }) =>
        sendMessage(env, chat_id, body, "Markdown").catch((e) => {
          console.warn(`watchtower cron: leaderboard send to ${chat_id} failed: ${e}`);
        }),
      ),
    );
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

// `/trending` — rank the 7-token roster by a "trending score": the
// ratio of 24h volume to liquidity (vol / liq). This is a proxy for
// unusual relative activity. Higher vol/liq = more action relative to
// the pool depth. Returns the top 3 trending tokens with the score,
// price, and sentiment label when available.

async function cmdTrending(env: Env, chatId: number): Promise<void> {
  const fetches = INTEL_TOKENS.map(async (tok) => ({
    tok,
    snap: await fetchPulseSnapshot(env, tok.slug),
    sent: await fetchSentiment(env, tok.slug),
  }));
  const results = await Promise.all(fetches);

  interface TrendingRow {
    symbol: string;
    slug: string;
    score: number;
    vol: number;
    liq: number;
    pct24: number | null;
    sentLabel: string | null;
  }

  const rows: TrendingRow[] = [];
  for (const { tok, snap, sent } of results) {
    if (!snap) continue;
    const vol = snap.volume_24h_usd;
    const liq = snap.liquidity_usd;
    if (vol == null || liq == null || liq <= 0) continue;
    rows.push({
      symbol: tok.symbol,
      slug: tok.slug,
      score: vol / liq,
      vol,
      liq,
      pct24: snap.price_change_24h_pct ?? null,
      sentLabel: formatSentimentTag(sent),
    });
  }

  if (rows.length === 0) {
    await sendMessage(
      env,
      chatId,
      "Trending unavailable \u2014 Pulse Premium snapshots not yet produced. Try again after the next 12:00 UTC refresh.",
    );
    return;
  }

  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, 3);

  const lines: string[] = [
    "\uD83D\uDD25 *Trending on Base* (by vol/liq ratio)",
    "",
  ];
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    const medal = i === 0 ? "\uD83E\uDD47" : i === 1 ? "\uD83E\uDD48" : "\uD83E\uDD49";
    const chgStr =
      r.pct24 != null && Number.isFinite(r.pct24)
        ? ` ${r.pct24 >= 0 ? "+" : ""}${r.pct24.toFixed(1)}%`
        : "";
    const sentStr = r.sentLabel ? `  _${r.sentLabel}_` : "";
    lines.push(
      `${medal} *${r.symbol}*  \u00B7  score ${r.score.toFixed(2)}\u00D7${chgStr}${sentStr}`,
    );
    lines.push(
      `   vol ${fmtUsdMaybe(r.vol)}  /  liq ${fmtUsdMaybe(r.liq)}`,
    );
  }
  lines.push("");
  lines.push("Score = 24h volume \u00F7 liquidity. Higher = more relative action.");
  lines.push("Open chart \u2192 `/chart <ticker>`");
  await sendMessage(env, chatId, lines.join("\n"), "Markdown");
}

// `/portfolio` — read on-chain ERC-20 balances for the roster tokens
// plus the user's $VT stake / pending rewards in VexorRevShare, multiply
// by the latest Pulse Premium price, reply with a sorted USD breakdown.
//
// Sub-commands:
//   /portfolio                    — show portfolio for the bound wallet
//                                   (or usage hint if none is bound)
//   /portfolio 0xWallet           — bind that wallet to this chat and
//                                   show the portfolio for it
//   /portfolio unbind             — clear the binding
//
// Binding lives in KV under `portfolio:<chatId>`. We deliberately do
// NOT store anything on-chain — the chat <-> wallet link is purely
// off-chain bookkeeping so the user can change wallets freely without
// touching gas.
const VEXOR_REVSHARE_ADDRESS = "0xE25f6243f848523c4577639e975B9F3E0fA57186";

async function cmdPortfolio(
  env: Env,
  msg: TelegramMessage,
  args: string[],
): Promise<void> {
  const chatId = msg.chat.id;
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  const sub = args[0]?.toLowerCase();

  // Privacy guard: in groups we never bind a wallet to the chat (would
  // leak holdings of whoever bound it to every member) and we never
  // honor a previously-bound wallet (same reason). One-off read of an
  // explicit address is allowed because the address is public anyway,
  // but bind / unbind / bare /portfolio always redirect to DM.
  if (isGroup && (sub === "unbind" || args.length === 0)) {
    await sendMessage(
      env,
      chatId,
      "`/portfolio` is private \u2014 DM me at @VexorAeonWatchtowerbot to bind your wallet. Read-only lookups still work here if you pass an explicit address: `/portfolio 0x\u2026`.",
      "Markdown",
    );
    return;
  }

  if (sub === "unbind") {
    await env.WATCHTOWER.delete(portfolioKey(chatId));
    await sendMessage(
      env,
      chatId,
      "Portfolio binding cleared. Use `/portfolio 0xYourWallet` to bind a new one.",
      "Markdown",
    );
    return;
  }

  let wallet: string | null;
  if (args.length === 0) {
    // Unreachable in groups (handled above); only DM users reach this branch.
    wallet = await getPortfolioBinding(env, chatId);
    if (!wallet) {
      await sendMessage(
        env,
        chatId,
        [
          "Usage: `/portfolio 0xYourWalletAddress`",
          "",
          "I will track your holdings of every $VT-roster token + your $VT",
          "stake and pending rewards in the VexorRevShare pool. Your wallet",
          "address stays linked to this chat until you run `/portfolio unbind`.",
          "",
          "Example: `/portfolio 0x0259abb884050E19e787cF7E271b6984E13BD79B`",
        ].join("\n"),
        "Markdown",
      );
      return;
    }
  } else {
    const candidate = args[0];
    if (!isValidAddress(candidate)) {
      await sendMessage(
        env,
        chatId,
        `\`${sanitizeAddressForEcho(candidate)}\` does not look like a valid 0x address (need 0x + 40 hex chars).`,
        "Markdown",
      );
      return;
    }
    wallet = candidate.toLowerCase();
    // Only persist the binding in DMs. Group lookups are one-shot reads
    // — we never remember a wallet for a group chat to avoid leaking
    // whoever-typed-first's holdings on every subsequent `/portfolio`.
    if (!isGroup) {
      await setPortfolioBinding(env, chatId, wallet);
    }
  }

  // Acknowledge before the on-chain reads — the user sees something
  // useful even if RPC is slow or a snapshot is missing.
  await sendMessage(
    env,
    chatId,
    `Reading portfolio for \`${wallet.slice(0, 6)}\u2026${wallet.slice(-4)}\` \u2014 hold on.`,
    "Markdown",
  );

  let result: PortfolioRow[];
  let staked: bigint;
  let pendingReward: bigint;
  try {
    const data = await readPortfolio(env, wallet);
    result = data.rows;
    staked = data.staked;
    pendingReward = data.pendingReward;
  } catch (err) {
    console.warn(`watchtower: /portfolio rpc failed for ${wallet}: ${String(err)}`);
    await sendMessage(
      env,
      chatId,
      "On-chain read failed (Base RPC is having a moment). Try again in a minute.",
    );
    return;
  }

  const lines: string[] = [
    `*Portfolio* \u2014 \`${wallet.slice(0, 6)}\u2026${wallet.slice(-4)}\``,
    "",
  ];

  // Sort by USD value descending; tokens with zero balance fall to the bottom.
  result.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  let totalUsd = 0;
  for (const row of result) {
    if (row.amount === 0n) continue;
    const amountStr = formatTokenAmount(row.amount, 18);
    const usdStr =
      row.usdValue != null ? `$${fmtUsd(row.usdValue)}` : "\u2014";
    if (row.usdValue != null) totalUsd += row.usdValue;
    lines.push(`\u2022 *${row.symbol}*  ${amountStr}  \u00B7  ${usdStr}`);
  }
  if (lines.length === 2) {
    lines.push("_No roster-token balances detected._");
  }

  // RevShare block (only when there's something interesting to show).
  if (staked > 0n || pendingReward > 0n) {
    const vtPrice = result.find((r) => r.slug === "vt")?.priceUsd ?? null;
    const stakedNum = bigintToNumber(staked, 18);
    const pendingNum = bigintToNumber(pendingReward, 18);
    const stakedUsd = vtPrice != null ? stakedNum * vtPrice : null;
    const pendingUsd = vtPrice != null ? pendingNum * vtPrice : null;

    lines.push("");
    lines.push("*RevShare ($VT pool)*");
    lines.push(
      `Staked: ${formatTokenAmount(staked, 18)} VT` +
        (stakedUsd != null ? `  \u00B7  $${fmtUsd(stakedUsd)}` : ""),
    );
    lines.push(
      `Pending rewards: ${formatTokenAmount(pendingReward, 18)} VT` +
        (pendingUsd != null ? `  \u00B7  $${fmtUsd(pendingUsd)}` : ""),
    );
    if (stakedUsd != null) totalUsd += stakedUsd;
    if (pendingUsd != null) totalUsd += pendingUsd;
  }

  lines.push("");
  lines.push(`*Total*: $${fmtUsd(totalUsd)} (where price was available)`);
  lines.push("");
  lines.push(
    "Console: https://vexorterminal.com/console  \u00B7  `/portfolio unbind` to clear",
  );

  await sendMessage(env, chatId, lines.join("\n"), "Markdown", false);
}

interface PortfolioRow {
  slug: string;
  symbol: string;
  amount: bigint;
  priceUsd: number | null;
  usdValue: number | null;
}

interface PortfolioReadResult {
  rows: PortfolioRow[];
  staked: bigint;
  pendingReward: bigint;
}

async function readPortfolio(env: Env, wallet: string): Promise<PortfolioReadResult> {
  const baseUrl = (
    env.INTEL_TOKEN_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens"
  ).replace(/\/+$/, "");

  const paddedWallet = padAddress(wallet);

  // Fan out RPC + snapshot fetches in parallel. balanceOf() for each
  // roster token + RevShare balanceOf() and pending() for the same
  // wallet. Snapshots are pulled in parallel from the GitHub Raw CDN
  // (edge-cached for 60s) so this whole step usually finishes in well
  // under a second once RPC settles.
  const balanceCalls = INTEL_TOKENS.map((t) =>
    rpcCall("eth_call", [
      { to: t.ca, data: SEL.balanceOf + paddedWallet },
      "latest",
    ]).catch((err) => {
      console.warn(`watchtower: balanceOf failed for ${t.slug}: ${String(err)}`);
      return null;
    }),
  );
  const snapshotFetches = INTEL_TOKENS.map(async (t) => {
    try {
      const res = await fetch(`${baseUrl}/${t.slug}.json`, {
        cf: { cacheTtl: 60, cacheEverything: true },
        headers: { "user-agent": "vexor-watchtower-worker/1" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as PulsePremiumPayload;
      return data?.market_snapshot?.price_usd ?? null;
    } catch {
      return null;
    }
  });

  const stakedCall = rpcCall("eth_call", [
    { to: VEXOR_REVSHARE_ADDRESS, data: SEL.balanceOf + paddedWallet },
    "latest",
  ]).catch(() => null);
  const pendingCall = rpcCall("eth_call", [
    { to: VEXOR_REVSHARE_ADDRESS, data: SEL.pending + paddedWallet },
    "latest",
  ]).catch(() => null);

  const [balances, prices, stakedHex, pendingHex] = await Promise.all([
    Promise.all(balanceCalls),
    Promise.all(snapshotFetches),
    stakedCall,
    pendingCall,
  ]);

  const rows: PortfolioRow[] = INTEL_TOKENS.map((t, i) => {
    const balHex = balances[i];
    const amount = typeof balHex === "string" ? hexToBigInt(balHex) : 0n;
    const priceUsd = prices[i];
    const tokenAmount = bigintToNumber(amount, 18);
    const usdValue = priceUsd != null ? tokenAmount * priceUsd : null;
    return {
      slug: t.slug,
      symbol: t.symbol,
      amount,
      priceUsd,
      usdValue,
    };
  });

  const staked = typeof stakedHex === "string" ? hexToBigInt(stakedHex) : 0n;
  const pendingReward =
    typeof pendingHex === "string" ? hexToBigInt(pendingHex) : 0n;

  return { rows, staked, pendingReward };
}

function isValidAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function sanitizeAddressForEcho(s: string): string {
  // For Markdown safety — strip anything that's not 0-9/a-f/A-F/x.
  const cleaned = s.replace(/[^a-fA-F0-9x]/g, "").slice(0, 64);
  return cleaned || "?";
}

// 18-decimal token amount → human display. Uses 0 decimals above 1000,
// 2 decimals between 1 and 1000, and a few significant digits for sub-1
// dust so a tiny pending reward still shows something useful instead
// of collapsing to "0".
function formatTokenAmount(raw: bigint, decimals: number): string {
  const num = bigintToNumber(raw, decimals);
  if (num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.0001) return num.toFixed(4);
  if (num >= 1e-8) return num.toFixed(8);
  return num.toExponential(2);
}

function bigintToNumber(raw: bigint, decimals: number): number {
  if (raw === 0n) return 0;
  // Two-step divide to avoid precision loss on the BigInt → Number cast:
  // grab the integer + fractional parts separately.
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

async function cmdStop(env: Env, chatId: number): Promise<void> {
  await env.WATCHTOWER.delete(chatKey(chatId));
  await sendMessage(
    env,
    chatId,
    "Unsubscribed. All watches removed. Type /start to come back.",
  );
}

// -----------------------------------------------------------------------------
// Cron pipeline
// -----------------------------------------------------------------------------

async function refreshAndAlertToken(
  slug: string,
  watchers: ChatRecord[],
  env: Env,
): Promise<void> {
  const meta = getIntelToken(slug);
  if (!meta) return;
  const live = await fetchDexScreenerSnapshot(meta.ca);
  if (!live) {
    console.warn(`watchtower cron: dexscreener returned no pair for ${slug}`);
    return;
  }

  const prev = await getSnapshot(env, slug);
  const now = new Date();
  const fetchedAt = now.toISOString();
  const newSnap: SnapshotRecord = {
    price_usd: live.price_usd,
    liquidity_usd: live.liquidity_usd,
    volume_24h_usd: live.volume_24h_usd,
    fetched_at: fetchedAt,
    last_alert_at: prev?.last_alert_at,
    last_alert_dir: prev?.last_alert_dir,
  };

  // Need a fresh prior snapshot to compute a delta. Cold start = persist
  // the baseline and skip alerting until the next cron tick.
  if (!prev || prev.price_usd == null || prev.liquidity_usd == null) {
    await putSnapshot(env, slug, newSnap);
    return;
  }
  const prevAge = Date.now() - Date.parse(prev.fetched_at);
  if (!Number.isFinite(prevAge) || prevAge > SNAPSHOT_FRESH_WINDOW_MS) {
    await putSnapshot(env, slug, newSnap);
    return;
  }

  // Compute observed magnitudes once; per-chat filter below decides who
  // gets alerted.
  // Guard against bad upstream data: DexScreener occasionally returns a
  // `priceUsd: "0"` for very-low-liquidity pairs, which would compute as
  // a -100% delta and spam every watcher with a fake "down" alert. A
  // genuine rug is still caught by the liq_drop branch below (and by
  // /watch's existing -25% liquidity threshold), so dropping the price
  // alert when `live.price_usd` is non-positive is safe.
  const pricePct =
    live.price_usd != null && live.price_usd > 0 && prev.price_usd > 0
      ? ((live.price_usd - prev.price_usd) / prev.price_usd) * 100
      : null;
  const liqPct =
    live.liquidity_usd != null && prev.liquidity_usd > 0
      ? ((live.liquidity_usd - prev.liquidity_usd) / prev.liquidity_usd) * 100
      : null;

  // Per-chat fan-out: each watcher may have a custom threshold via
  // /alert. Liquidity drop uses the global threshold (no per-user
  // override) because rug-risk semantics are not user-tunable.
  const sends: Promise<unknown>[] = [];
  for (const rec of watchers) {
    const chatId = (rec as ChatRecord & { __chat_id?: number }).__chat_id;
    if (chatId == null) continue;
    const userThreshold = rec.thresholds?.[slug] ?? PRICE_THRESHOLD_PCT;
    let trigger: { dir: "up" | "down" | "liq_drop"; pct: number } | null = null;
    if (pricePct != null) {
      if (pricePct >= userThreshold) trigger = { dir: "up", pct: pricePct };
      else if (pricePct <= -userThreshold)
        trigger = { dir: "down", pct: pricePct };
    }
    if (!trigger && liqPct != null && liqPct <= LIQ_DROP_THRESHOLD_PCT) {
      trigger = { dir: "liq_drop", pct: liqPct };
    }
    if (!trigger) continue;

    // Per-(chat, slug, dir) cooldown via KV. Avoids one chatty user
    // suppressing another user's alert (which the old global cooldown
    // would do).
    const cooldownKey = priceCooldownKey(chatId, slug, trigger.dir);
    const last = await env.WATCHTOWER.get(cooldownKey);
    if (last) continue; // TTL'd key still alive = on cooldown
    sends.push(
      env.WATCHTOWER.put(cooldownKey, fetchedAt, {
        expirationTtl: Math.ceil(ALERT_COOLDOWN_MS / 1000),
      }),
      sendPriceAlert(env, chatId, slug, trigger, prev, live, userThreshold),
    );
  }
  await Promise.all(sends);

  // Keep snapshot.last_alert_* in sync with whatever trigger (if any)
  // fired this tick — used by debug tooling and not strictly required.
  if (pricePct != null && Math.abs(pricePct) >= PRICE_THRESHOLD_PCT) {
    newSnap.last_alert_at = fetchedAt;
    newSnap.last_alert_dir = pricePct >= 0 ? "up" : "down";
  } else if (liqPct != null && liqPct <= LIQ_DROP_THRESHOLD_PCT) {
    newSnap.last_alert_at = fetchedAt;
    newSnap.last_alert_dir = "liq_drop";
  }
  await putSnapshot(env, slug, newSnap);
}

async function sendPriceAlert(
  env: Env,
  chatId: number,
  slug: string,
  trigger: { dir: "up" | "down" | "liq_drop"; pct: number },
  prev: SnapshotRecord,
  live: LiveSnap,
  userThreshold: number,
): Promise<void> {
  const meta = getIntelToken(slug);
  const symbol = meta?.symbol ?? slug.toUpperCase();
  const usingCustom = userThreshold !== PRICE_THRESHOLD_PCT;
  const headline =
    trigger.dir === "liq_drop"
      ? `\u26A0\uFE0F *${symbol}* liquidity dropped ${Math.abs(trigger.pct).toFixed(1)}% / 1h`
      : trigger.dir === "up"
        ? `\uD83D\uDFE2 *${symbol}* +${trigger.pct.toFixed(1)}% / 1h`
        : `\uD83D\uDD34 *${symbol}* ${trigger.pct.toFixed(1)}% / 1h`;
  const lines = [
    headline,
    "",
    `Price: ${fmtPriceMaybe(prev.price_usd)} \u2192 ${fmtPriceMaybe(live.price_usd)}`,
    `Liquidity: ${fmtUsdMaybe(prev.liquidity_usd)} \u2192 ${fmtUsdMaybe(live.liquidity_usd)}`,
    `24h volume: ${fmtUsdMaybe(live.volume_24h_usd)}`,
  ];
  if (usingCustom && trigger.dir !== "liq_drop") {
    lines.push(`Threshold: \u00B1${userThreshold}% (custom)`);
  }
  lines.push("", `Open: https://vexorterminal.com/intel/${slug}`);
  await sendMessage(env, chatId, lines.join("\n"), "Markdown").catch((e) => {
    console.warn(`watchtower cron: sendMessage failed for ${chatId}: ${e}`);
  });
}

// -----------------------------------------------------------------------------
// Whale-transfer scanner (Feature 2)
// -----------------------------------------------------------------------------

async function scanWhaleTransfers(
  slug: string,
  watchers: ChatRecord[],
  env: Env,
): Promise<void> {
  // Anyone opted in for this token?
  const subscribers = watchers.filter(
    (w) => w.whale_thresholds && w.whale_thresholds[slug] != null,
  );
  if (subscribers.length === 0) return;

  const meta = getIntelToken(slug);
  if (!meta) return;

  // Resolve scan range.
  const headHex = (await rpcCall("eth_blockNumber", []).catch(() => null)) as
    | string
    | null;
  if (!headHex) {
    console.warn(`watchtower whale: failed to read head block for ${slug}`);
    return;
  }
  const head = Number(hexToBigInt(headHex));
  if (!Number.isFinite(head) || head <= 0) return;

  const lastRaw = await env.WATCHTOWER.get(whaleBlockKey(slug));
  const lastScanned = lastRaw ? Number(lastRaw) : NaN;
  const from = Number.isFinite(lastScanned) && lastScanned > 0
    ? Math.max(lastScanned + 1, head - WHALE_MAX_BLOCK_RANGE)
    : head - WHALE_RECENT_FALLBACK_BLOCKS;
  const to = Math.min(head, from + WHALE_MAX_BLOCK_RANGE);
  if (from > to) {
    // Already up to date.
    await env.WATCHTOWER.put(whaleBlockKey(slug), String(to));
    return;
  }

  // Get current price + decimals so we can convert raw token amounts → USD.
  const [logs, decimals, snap] = await Promise.all([
    fetchTransferLogs(meta.ca, from, to).catch((e) => {
      console.warn(`watchtower whale: eth_getLogs failed for ${slug}: ${e}`);
      return [];
    }),
    getTokenDecimals(env, meta.ca),
    getSnapshot(env, slug),
  ]);
  const priceUsd = snap?.price_usd ?? null;
  if (priceUsd == null || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    // Without a live price we cannot convert wei → USD. Bump the cursor
    // anyway so we don't accumulate a backlog when DexScreener is down.
    await env.WATCHTOWER.put(whaleBlockKey(slug), String(to));
    return;
  }

  // For each log, compute USD value and fan out to each subscriber whose
  // threshold is met.
  const sends: Promise<unknown>[] = [];
  for (const log of logs) {
    const value = parseTransferValue(log.data);
    if (value === 0n) continue;
    const tokens = Number(value) / Math.pow(10, decimals);
    if (!Number.isFinite(tokens)) continue;
    const usd = tokens * priceUsd;
    if (!Number.isFinite(usd) || usd < MIN_WHALE_USD) continue;

    const from_addr = topicToAddress(log.topics[1]);
    const to_addr = topicToAddress(log.topics[2]);
    const dedupeKey = whaleDedupeKey(slug, log.transactionHash, log.logIndex);
    const already = await env.WATCHTOWER.get(dedupeKey);
    if (already) continue;

    for (const rec of subscribers) {
      const chatId = (rec as ChatRecord & { __chat_id?: number }).__chat_id;
      if (chatId == null) continue;
      // `subscribers` is pre-filtered to only include records with a
      // configured whale threshold for this slug, so this lookup is
      // guaranteed to be defined. The `?? DEFAULT_WHALE_USD` fallback
      // was dead code and is dropped.
      const threshold = rec.whale_thresholds![slug];
      if (usd < threshold) continue;
      sends.push(
        sendWhaleAlert(env, chatId, slug, {
          from_addr,
          to_addr,
          tokens,
          usd,
          tx_hash: log.transactionHash,
        }),
      );
    }
    sends.push(
      env.WATCHTOWER.put(dedupeKey, String(Date.now()), {
        expirationTtl: WHALE_COOLDOWN_TTL_SECONDS,
      }),
    );
  }

  sends.push(env.WATCHTOWER.put(whaleBlockKey(slug), String(to)));
  await Promise.all(sends);
}

interface TransferLog {
  topics: string[];
  data: string;
  transactionHash: string;
  logIndex: string;
  blockNumber: string;
}

async function fetchTransferLogs(
  ca: string,
  fromBlock: number,
  toBlock: number,
): Promise<TransferLog[]> {
  const result = await rpcCall("eth_getLogs", [
    {
      address: ca,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
      topics: [TRANSFER_TOPIC],
    },
  ]);
  if (!Array.isArray(result)) return [];
  return result.filter((l): l is TransferLog => {
    if (!l || typeof l !== "object") return false;
    const x = l as Partial<TransferLog>;
    return (
      Array.isArray(x.topics) &&
      typeof x.data === "string" &&
      typeof x.transactionHash === "string" &&
      typeof x.logIndex === "string"
    );
  });
}

function parseTransferValue(dataHex: string): bigint {
  // ERC-20 Transfer: data = value (single 32-byte word).
  if (!dataHex || !dataHex.startsWith("0x")) return 0n;
  // Take the first 64 hex chars after `0x` to defend against malformed logs.
  const valHex = dataHex.slice(0, 66);
  try {
    return hexToBigInt(valHex);
  } catch {
    return 0n;
  }
}

function topicToAddress(topic: string | undefined): string {
  if (!topic || !topic.startsWith("0x") || topic.length < 66) return "";
  return "0x" + topic.slice(-40);
}

async function getTokenDecimals(env: Env, ca: string): Promise<number> {
  const key = `dec:${ca.toLowerCase()}`;
  const cached = await env.WATCHTOWER.get(key);
  if (cached) {
    const n = Number(cached);
    if (Number.isFinite(n) && n > 0 && n <= 30) return n;
  }
  try {
    const res = await rpcCall("eth_call", [
      { to: ca, data: "0x313ce567" },
      "latest",
    ]);
    if (typeof res === "string") {
      const n = Number(hexToBigInt(res));
      if (Number.isFinite(n) && n > 0 && n <= 30) {
        await env.WATCHTOWER.put(key, String(n));
        return n;
      }
    }
  } catch (e) {
    console.warn(`watchtower whale: decimals query failed for ${ca}: ${e}`);
  }
  // ERC-20 default. All 7 Pulse Premium tokens are 18 decimals.
  return 18;
}

async function sendWhaleAlert(
  env: Env,
  chatId: number,
  slug: string,
  whale: {
    from_addr: string;
    to_addr: string;
    tokens: number;
    usd: number;
    tx_hash: string;
  },
): Promise<void> {
  const meta = getIntelToken(slug);
  const symbol = meta?.symbol ?? slug.toUpperCase();
  const fromShort = shortAddr(whale.from_addr);
  const toShort = shortAddr(whale.to_addr);
  const lines = [
    `\uD83D\uDC0B *${symbol}* whale transfer \u2014 $${fmtUsd(whale.usd)}`,
    "",
    `Tokens: ${fmtUsd(whale.tokens)} ${symbol}`,
    `From: \`${fromShort}\`  \u2192  \`${toShort}\``,
    `Tx: https://basescan.org/tx/${whale.tx_hash}`,
  ];
  await sendMessage(env, chatId, lines.join("\n"), "Markdown").catch((e) => {
    console.warn(`watchtower whale: sendMessage failed for ${chatId}: ${e}`);
  });
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "\u2014";
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

// -----------------------------------------------------------------------------
// Volatility-spike scanner (Feature 3)
// -----------------------------------------------------------------------------

async function checkVolatilitySpike(
  slug: string,
  watchers: number[],
  env: Env,
): Promise<void> {
  if (watchers.length === 0) return;
  const snap = await getSnapshot(env, slug);
  if (!snap) return; // need price pipeline to have populated baseline first
  const today24h = snap.volume_24h_usd;
  if (today24h == null || today24h < VOLATILITY_MIN_USD) return;

  // Don't re-alert if we already fired within VOLATILITY_COOLDOWN_MS.
  // Use a dedicated KV key (not the snapshot) so we don't race with
  // refreshAndAlertToken's snapshot writes.
  const cooldownRaw = await env.WATCHTOWER.get(volAlertKey(slug));
  if (cooldownRaw) return; // TTL'd key still alive

  // Discover the pool address from the per-token Pulse Premium feed.
  const baseUrl = (
    env.INTEL_TOKEN_BASE_URL ??
    "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens"
  ).replace(/\/+$/, "");
  let poolAddress: string | null = null;
  try {
    const res = await fetch(`${baseUrl}/${slug}.json`, {
      cf: { cacheTtl: 300, cacheEverything: true },
      headers: { "user-agent": "vexor-watchtower-worker/1" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        market_snapshot?: { top_pool?: { address?: string } };
      };
      poolAddress = data?.market_snapshot?.top_pool?.address ?? null;
    }
  } catch (e) {
    console.warn(`watchtower vol: pulse premium fetch failed for ${slug}: ${e}`);
  }
  if (!poolAddress) return;

  const ohlc = await fetchDailyVolumeUsd(poolAddress).catch((e) => {
    console.warn(`watchtower vol: GeckoTerminal fetch failed for ${slug}: ${e}`);
    return null;
  });
  if (!ohlc || ohlc.length < VOLATILITY_MIN_DAYS) return;

  // Drop today's incomplete candle (first or last depending on ordering)
  // by sorting descending and using ohlc[1..] as the history baseline.
  const sorted = [...ohlc].sort((a, b) => b.ts - a.ts);
  const history = sorted.slice(1, 1 + 30).map((d) => d.volume_usd).filter((v) => v > 0);
  if (history.length < VOLATILITY_MIN_DAYS) return;
  const median = median0(history);
  if (median <= 0) return;
  const ratio = today24h / median;
  if (ratio < VOLATILITY_SPIKE_FACTOR) return;

  // Fire.
  const fetchedAt = new Date().toISOString();
  await Promise.all([
    env.WATCHTOWER.put(volAlertKey(slug), fetchedAt, {
      expirationTtl: Math.ceil(VOLATILITY_COOLDOWN_MS / 1000),
    }),
    ...watchers.map((id) =>
      sendVolatilityAlert(env, id, slug, today24h, median, ratio),
    ),
  ]);
}

interface DailyVol {
  ts: number;
  volume_usd: number;
}

async function fetchDailyVolumeUsd(pool: string): Promise<DailyVol[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}/ohlcv/day?aggregate=1&limit=60&currency=usd`,
      {
        signal: ctl.signal,
        cf: { cacheTtl: 1800, cacheEverything: true },
        headers: { "user-agent": "vexor-watchtower-worker/1" },
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { attributes?: { ohlcv_list?: Array<Array<number>> } };
    };
    const list = json?.data?.attributes?.ohlcv_list;
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (row): row is number[] =>
          Array.isArray(row) && row.length >= 6 && typeof row[5] === "number",
      )
      .map((row) => ({ ts: row[0], volume_usd: row[5] }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

function median0(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function sendVolatilityAlert(
  env: Env,
  chatId: number,
  slug: string,
  today24h: number,
  median30d: number,
  ratio: number,
): Promise<void> {
  const meta = getIntelToken(slug);
  const symbol = meta?.symbol ?? slug.toUpperCase();
  const lines = [
    `\uD83D\uDD25 *${symbol}* volume spike \u2014 ${ratio.toFixed(1)}\u00D7 median`,
    "",
    `24h volume: $${fmtUsd(today24h)}`,
    `30d median: $${fmtUsd(median30d)}`,
    "",
    `Open: https://vexorterminal.com/intel/${slug}`,
  ];
  await sendMessage(env, chatId, lines.join("\n"), "Markdown").catch((e) => {
    console.warn(`watchtower vol: sendMessage failed for ${chatId}: ${e}`);
  });
}

// -----------------------------------------------------------------------------
// KV-key helpers (new alerts pipelines)
// -----------------------------------------------------------------------------

function priceCooldownKey(
  chatId: number,
  slug: string,
  dir: "up" | "down" | "liq_drop",
): string {
  return `cd:${chatId}:${slug}:${dir}`;
}

function whaleBlockKey(slug: string): string {
  return `whale-block:${slug}`;
}

function whaleDedupeKey(slug: string, txHash: string, logIndex: string): string {
  return `whale-dedupe:${slug}:${txHash}:${logIndex}`;
}

function volAlertKey(slug: string): string {
  return `vol-alert:${slug}`;
}

interface LiveSnap {
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  price_change_1h_pct: number | null;
  price_change_24h_pct: number | null;
}

async function fetchDexScreenerSnapshot(ca: string): Promise<LiveSnap | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
      { signal: ctl.signal },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as DexScreenerResponse;
    const pairs = Array.isArray(json.pairs) ? json.pairs.filter((p): p is DexScreenerPair => !!p) : [];
    if (pairs.length === 0) return null;
    // Pick the deepest-liquidity pair on Base.
    const sorted = [...pairs]
      .filter((p) => p.chainId === "base")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const best = sorted[0] ?? pairs[0];
    const priceUsd = best.priceUsd ? Number(best.priceUsd) : null;
    return {
      price_usd: Number.isFinite(priceUsd) ? priceUsd : null,
      liquidity_usd: best.liquidity?.usd ?? null,
      volume_24h_usd: best.volume?.h24 ?? null,
      price_change_1h_pct: best.priceChange?.h1 ?? null,
      price_change_24h_pct: best.priceChange?.h24 ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// -----------------------------------------------------------------------------
// KV helpers
// -----------------------------------------------------------------------------

function chatKey(chatId: number): string {
  return `chat:${chatId}`;
}

function snapKey(slug: string): string {
  return `snapshot:${slug}`;
}

function portfolioKey(chatId: number): string {
  return `portfolio:${chatId}`;
}

async function getPortfolioBinding(
  env: Env,
  chatId: number,
): Promise<string | null> {
  const raw = await env.WATCHTOWER.get(portfolioKey(chatId));
  if (!raw) return null;
  // Stored as `0xabc...` lowercase. Validate to defend against legacy
  // junk in KV from earlier experiments.
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : null;
}

async function setPortfolioBinding(
  env: Env,
  chatId: number,
  wallet: string,
): Promise<void> {
  await env.WATCHTOWER.put(portfolioKey(chatId), wallet.toLowerCase());
}

function researchCounterKey(chatId: number, utcDay: string): string {
  return `research-count:${chatId}:${utcDay}`;
}

/** Returns `YYYYMMDD` in UTC. */
function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}${m}${day}`;
}

async function readCounter(env: Env, key: string): Promise<number> {
  const raw = await env.WATCHTOWER.get(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function writeCounter(env: Env, key: string, value: number): Promise<void> {
  await env.WATCHTOWER.put(key, String(value), {
    expirationTtl: RESEARCH_KEY_TTL_SECONDS,
  });
}

async function getChat(env: Env, chatId: number): Promise<ChatRecord | null> {
  const raw = await env.WATCHTOWER.get(chatKey(chatId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChatRecord;
  } catch {
    return null;
  }
}

async function putChat(env: Env, chatId: number, record: ChatRecord): Promise<void> {
  await env.WATCHTOWER.put(chatKey(chatId), JSON.stringify(record));
}

async function getSnapshot(env: Env, slug: string): Promise<SnapshotRecord | null> {
  const raw = await env.WATCHTOWER.get(snapKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SnapshotRecord;
  } catch {
    return null;
  }
}

async function putSnapshot(env: Env, slug: string, record: SnapshotRecord): Promise<void> {
  await env.WATCHTOWER.put(snapKey(slug), JSON.stringify(record));
}

async function listAllChats(env: Env): Promise<Array<{ chat_id: number; record: ChatRecord }>> {
  const out: Array<{ chat_id: number; record: ChatRecord }> = [];
  let cursor: string | undefined;
  for (;;) {
    const page: KVNamespaceListResult<unknown> = await env.WATCHTOWER.list({
      prefix: "chat:",
      cursor,
    });
    for (const k of page.keys) {
      const raw = await env.WATCHTOWER.get(k.name);
      if (!raw) continue;
      const parsed = safeParse<ChatRecord>(raw);
      if (!parsed) continue;
      const id = Number(k.name.replace(/^chat:/, ""));
      if (!Number.isFinite(id)) continue;
      out.push({ chat_id: id, record: parsed });
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return out;
}

function safeParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Telegram client
// -----------------------------------------------------------------------------

async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  parseMode?: "Markdown" | "MarkdownV2" | "HTML",
  // `/chart` needs Telegram to unfurl the per-token intel link so the user
  // sees the inline chart preview. Every other code path (alerts, help
  // text, command responses) sends short URLs they don't want unfurling.
  // Default keeps the previous behavior (no preview); opt-in for the
  // commands that benefit from it.
  enableLinkPreview = false,
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("watchtower: TELEGRAM_BOT_TOKEN missing; cannot send message");
    return;
  }
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: !enableLinkPreview,
  };
  if (parseMode) body.parse_mode = parseMode;
  const res = await fetch(
    `${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(`watchtower: sendMessage ${res.status} ${errText}`);
  }
}

// Send a photo from a public URL with an optional Markdown caption.
// Returns true on success so callers can fall back to a text-only reply
// when the photo URL is unreachable (e.g. the daily chart render has
// not produced this token's PNG yet).
async function sendPhoto(
  env: Env,
  chatId: number,
  photoUrl: string,
  caption?: string,
  parseMode?: "Markdown" | "MarkdownV2" | "HTML",
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("watchtower: TELEGRAM_BOT_TOKEN missing; cannot send photo");
    return false;
  }
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
  };
  if (caption) body.caption = caption;
  if (parseMode) body.parse_mode = parseMode;
  const res = await fetch(
    `${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(`watchtower: sendPhoto ${res.status} ${errText}`);
    return false;
  }
  return true;
}

// Reply to a Telegram `inline_query`. Telegram requires this within
// ~10s of receiving the query; after that the update is silently
// dropped from the client UI. `cache_time` lets Telegram serve the
// same result set to other users without round-tripping back to us.
interface InlineQueryResultPhoto {
  type: "photo";
  id: string;
  photo_url: string;
  thumb_url: string;
  photo_width?: number;
  photo_height?: number;
  title?: string;
  description?: string;
  caption?: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
}

async function answerInlineQuery(
  env: Env,
  queryId: string,
  results: InlineQueryResultPhoto[],
  cacheSeconds: number,
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn(
      "watchtower: TELEGRAM_BOT_TOKEN missing; cannot answer inline query",
    );
    return;
  }
  const res = await fetch(
    `${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/answerInlineQuery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inline_query_id: queryId,
        results,
        cache_time: cacheSeconds,
        is_personal: false,
      }),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(`watchtower: answerInlineQuery ${res.status} ${errText}`);
  }
}

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  return n.toExponential(2);
}

function fmtUsdMaybe(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  return `$${fmtUsd(n)}`;
}

function fmtPriceMaybe(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  return `$${fmtUsd(n)}`;
}

// Escape Telegram legacy Markdown special chars. Telegram silently rejects
// messages with mismatched `_`, `*`, `` ` `` or `[` characters, so any raw
// user-supplied string interpolated into a Markdown message must be escaped
// first.
function escapeMarkdown(s: string): string {
  return s.replace(/([_*`\[\]])/g, "\\$1");
}

// User-supplied slugs (from /watch /unwatch args) are echoed back in error
// messages inside Markdown code spans. Strip anything that isn't a safe slug
// character so a malformed input can't break the code span or the entire
// message parse.
function sanitizeSlugForEcho(s: string): string {
  const cleaned = s.replace(/[^a-z0-9-]/g, "").slice(0, 32);
  return cleaned || "?";
}
