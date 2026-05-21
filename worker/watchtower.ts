/**
 * Vexor Watchtower — Telegram-native per-token alerting (V1)
 *
 * Telegram bot @VexorAeonWatchtowerbot. The bot is the UI: there is no
 * /watch web page in V1. Users subscribe via Telegram commands; an hourly
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
 * - `chat:<chat_id>` → { tokens: string[], created_at, last_seen }
 * - `snapshot:<slug>` → { price_usd, liquidity_usd, volume_24h_usd,
 *                         fetched_at, last_alert_at, last_alert_dir }
 *
 * Routes (registered in worker/index.ts):
 * - `POST /api/watchtower/webhook` — Telegram webhook target. Always
 *   responds 200 quickly; long-running work (KV writes, sendMessage) is
 *   spawned via `ctx.waitUntil` to keep webhook latency low.
 *
 * Cron entrypoint:
 * - `scheduled()` in worker/index.ts dispatches to `runWatchtowerCron()`
 *   here. Cron cadence is set in wrangler.jsonc.
 *
 * Alert thresholds (V1, hardcoded):
 * - Price: ±10% / 1h move from last snapshot
 * - Liquidity drop: -25% / 1h (rug signal)
 * - Cooldown: one alert per direction per token per hour (so a token
 *   that keeps moving doesn't spam users every cron tick).
 */

import type { Env } from "./index";
import { INTEL_TOKENS, isIntelTokenSlug, getIntelToken } from "../src/lib/intel-tokens";

const TELEGRAM_API_BASE = "https://api.telegram.org";

const PRICE_THRESHOLD_PCT = 10; // alert on ±10% / 1h
const LIQ_DROP_THRESHOLD_PCT = -25; // alert on ≤-25% / 1h
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1h per direction per token
const SNAPSHOT_FRESH_WINDOW_MS = 2 * 60 * 60 * 1000; // ignore baselines older than 2h
const MAX_TOKENS_PER_USER = 5; // free-tier ceiling

interface ChatRecord {
  tokens: string[];
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

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string; first_name?: string };
  chat: { id: number; type: string };
  date: number;
  text?: string;
  entities?: Array<{ type: string; offset: number; length: number }>;
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
  // 1. Gather the union set of watched tokens across all chats.
  const chats = await listAllChats(env);
  const tokenWatchers = new Map<string, number[]>(); // slug -> [chat_id, ...]
  for (const { chat_id, record } of chats) {
    for (const slug of record.tokens) {
      if (!isIntelTokenSlug(slug)) continue;
      const arr = tokenWatchers.get(slug) ?? [];
      arr.push(chat_id);
      tokenWatchers.set(slug, arr);
    }
  }

  if (tokenWatchers.size === 0) {
    console.log("watchtower cron: no active subscriptions; skipping");
    return;
  }

  // 2. Refresh every watched token in parallel.
  const slugs = [...tokenWatchers.keys()];
  await Promise.all(
    slugs.map((slug) => refreshAndAlertToken(slug, tokenWatchers.get(slug)!, env)),
  );
}

// -----------------------------------------------------------------------------
// Telegram update dispatch
// -----------------------------------------------------------------------------

async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  const msg = update.message ?? update.edited_message;
  if (!msg || !msg.text) return;
  if (msg.chat.type !== "private") {
    // V1: only private chats. Group chats are noisy and require per-user
    // subscription disambiguation we don't want to design yet.
    await sendMessage(
      env,
      msg.chat.id,
      "Watchtower V1 only supports private chats. DM @VexorAeonWatchtowerbot to subscribe.",
    );
    return;
  }

  const text = msg.text.trim();
  const [rawCmd, ...rawArgs] = text.split(/\s+/);
  const cmd = rawCmd.toLowerCase().replace(/@.*/, "");

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
    case "/stop":
      await cmdStop(env, msg.chat.id);
      break;
    default:
      await sendMessage(
        env,
        msg.chat.id,
        "Unknown command. Try /help.",
      );
  }
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

async function cmdStart(env: Env, msg: TelegramMessage): Promise<void> {
  const name = escapeMarkdown(msg.from?.first_name ?? "anon");
  const existing = await getChat(env, msg.chat.id);
  if (!existing) {
    await putChat(env, msg.chat.id, {
      tokens: [],
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }
  const greet = [
    `Vexor Watchtower live, ${name}.`,
    "",
    "I push you a Telegram alert when one of your watched tokens makes a sharp move:",
    `\u2022 price moves \u00B1${PRICE_THRESHOLD_PCT}% within 1h`,
    `\u2022 liquidity drops \u2265${Math.abs(LIQ_DROP_THRESHOLD_PCT)}% within 1h (rug signal)`,
    "",
    "Commands:",
    "/watch <slug> \u2014 start watching a token (max " + MAX_TOKENS_PER_USER + ")",
    "/unwatch <slug> \u2014 stop watching",
    "/list \u2014 your active watches",
    "/tokens \u2014 list every supported slug",
    "/stop \u2014 unsubscribe entirely",
    "",
    "Example: `/watch vt`",
  ].join("\n");
  await sendMessage(env, msg.chat.id, greet, "Markdown");
}

async function cmdHelp(env: Env, chatId: number): Promise<void> {
  const lines = [
    "Commands:",
    "/watch <slug> \u2014 watch a token (e.g. `/watch vt`)",
    "/unwatch <slug> \u2014 stop watching a token",
    "/list \u2014 your watchlist",
    "/tokens \u2014 supported slugs",
    "/stop \u2014 unsubscribe everything",
    "",
    `Free-tier limit: ${MAX_TOKENS_PER_USER} tokens.`,
    "Thresholds: price \u00B110% / 1h, liquidity \u2264-25% / 1h.",
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
      const snap = await getSnapshot(env, slug);
      const price = snap?.price_usd != null ? `$${fmtUsd(snap.price_usd)}` : "\u2014";
      return `\u2022 *${meta?.symbol ?? slug.toUpperCase()}* (\`${slug}\`) ${price}`;
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
  const slug = args[0].toLowerCase();
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
    `Watching *${meta?.symbol ?? slug.toUpperCase()}*. You will get an alert on \u00B1${PRICE_THRESHOLD_PCT}% / 1h moves.`,
    "Markdown",
  );
}

async function cmdUnwatch(env: Env, chatId: number, args: string[]): Promise<void> {
  if (args.length === 0) {
    await sendMessage(env, chatId, "Usage: `/unwatch <slug>`.", "Markdown");
    return;
  }
  const slug = args[0].toLowerCase();
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
  watchers: number[],
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

  // Direction + magnitude.
  let trigger: { dir: "up" | "down" | "liq_drop"; pct: number } | null = null;
  if (live.price_usd != null && prev.price_usd > 0) {
    const pct = ((live.price_usd - prev.price_usd) / prev.price_usd) * 100;
    if (pct >= PRICE_THRESHOLD_PCT) trigger = { dir: "up", pct };
    else if (pct <= -PRICE_THRESHOLD_PCT) trigger = { dir: "down", pct };
  }
  if (!trigger && live.liquidity_usd != null && prev.liquidity_usd > 0) {
    const pct = ((live.liquidity_usd - prev.liquidity_usd) / prev.liquidity_usd) * 100;
    if (pct <= LIQ_DROP_THRESHOLD_PCT) trigger = { dir: "liq_drop", pct };
  }

  if (trigger) {
    // Cooldown: same direction within ALERT_COOLDOWN_MS is suppressed.
    const cooldownOk =
      !prev.last_alert_at ||
      prev.last_alert_dir !== trigger.dir ||
      Date.now() - Date.parse(prev.last_alert_at) >= ALERT_COOLDOWN_MS;
    if (cooldownOk) {
      newSnap.last_alert_at = fetchedAt;
      newSnap.last_alert_dir = trigger.dir;
      await fanOutAlert(env, slug, trigger, prev, live, watchers);
    }
  }

  await putSnapshot(env, slug, newSnap);
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

async function fanOutAlert(
  env: Env,
  slug: string,
  trigger: { dir: "up" | "down" | "liq_drop"; pct: number },
  prev: SnapshotRecord,
  live: LiveSnap,
  chatIds: number[],
): Promise<void> {
  const meta = getIntelToken(slug);
  const symbol = meta?.symbol ?? slug.toUpperCase();
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
    "",
    `Open: https://vexorterminal.com/intel/${slug}`,
  ];
  const body = lines.join("\n");
  await Promise.all(
    chatIds.map((id) => sendMessage(env, id, body, "Markdown").catch((e) => {
      console.warn(`watchtower cron: sendMessage failed for ${id}: ${e}`);
    })),
  );
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
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("watchtower: TELEGRAM_BOT_TOKEN missing; cannot send message");
    return;
  }
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
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
