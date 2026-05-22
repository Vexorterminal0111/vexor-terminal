/**
 * Vexor Researcher — on-demand deep-dive briefs for Base mainnet tokens.
 *
 * Triggered from the Telegram bot via `/research <slug-or-CA>` (handled in
 * worker/watchtower.ts). Pulls live DexScreener data, optionally pairs it
 * with Basescan contract-verification status (when `ETHERSCAN_API_KEY` is
 * configured), and asks Groq llama-3.3-70b to synthesize a verdict +
 * three pulse bullets + risk flags + outlook.
 *
 * Design constraints:
 * - Output must fit Telegram's 4096-char message limit comfortably (we
 *   aim for ~1200-1800 chars including the deterministic header).
 * - LLM output is constrained to a strict Markdown structure; we never
 *   let the model invent numbers — all figures come from the raw data
 *   payload we feed in, and the system prompt forbids unsourced claims.
 * - All external calls (DexScreener, Basescan, Groq) run in parallel and
 *   tolerate individual failures: a missing Basescan key just drops the
 *   contract-security bullet; the brief still ships.
 */

import type { Env } from "./index";
import { INTEL_TOKENS, getIntelToken } from "../src/lib/intel-tokens";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const DEX_API_BASE = "https://api.dexscreener.com";
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api";
const BASE_CHAIN_ID = 8453;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = 20_000;
const DEX_TIMEOUT_MS = 6_000;
const ETHERSCAN_TIMEOUT_MS = 6_000;

/**
 * Parsed `/research <input>` arg. `kind === "slug"` means the input matched
 * one of the curated `INTEL_TOKENS` entries; `kind === "ca"` means the user
 * pasted a raw 40-hex Base address.
 */
export interface ResearchInput {
  kind: "slug" | "ca";
  /** Original (lowercased) user input — used for echoing in errors. */
  raw: string;
  /** Set when kind === "slug" — the canonical slug from `INTEL_TOKENS`. */
  slug?: string;
  /** Always set — for slug inputs, the slug's CA. */
  ca: string;
  /** Human-readable label for the brief header (e.g. `$VT` or `0x22aF…6F3b`). */
  label: string;
}

/** Returns `null` for unrecognized inputs (neither a known slug nor a 0x address). */
export function parseResearchInput(raw: string): ResearchInput | null {
  const s = raw.trim();
  if (!s) return null;
  if (ADDRESS_RE.test(s)) {
    const ca = s;
    return { kind: "ca", raw: s.toLowerCase(), ca, label: shortAddr(ca) };
  }
  // Strip an optional `$` cashtag prefix so `/research $vt` works the
  // same as `/research vt`. Crypto-Telegram users naturally type
  // `$VT` from cashtag convention.
  const slugCandidate = s.replace(/^\$/, "").toLowerCase();
  const meta = getIntelToken(slugCandidate);
  if (meta) {
    return {
      kind: "slug",
      raw: slugCandidate,
      slug: meta.slug,
      ca: meta.ca,
      label: `$${meta.symbol}`,
    };
  }
  return null;
}

interface DexPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h1?: number; h6?: number; h24?: number };
  priceChange?: { h1?: number; h6?: number; h24?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  txns?: {
    h1?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
}

interface DexResp {
  pairs?: DexPair[] | null;
}

async function fetchDexPairs(ca: string): Promise<DexPair[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), DEX_TIMEOUT_MS);
  try {
    const res = await fetch(`${DEX_API_BASE}/latest/dex/tokens/${ca}`, {
      signal: ctl.signal,
    });
    if (!res.ok) return [];
    const j = (await res.json()) as DexResp;
    const all = Array.isArray(j.pairs) ? j.pairs : [];
    return all.filter((p): p is DexPair => !!p && p.chainId === "base");
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

interface ContractInfo {
  verified: boolean;
  name?: string;
  compiler?: string;
  proxy?: boolean;
}

async function fetchContractInfo(env: Env, ca: string): Promise<ContractInfo | null> {
  if (!env.ETHERSCAN_API_KEY) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ETHERSCAN_TIMEOUT_MS);
  try {
    const u = new URL(ETHERSCAN_V2);
    u.searchParams.set("chainid", String(BASE_CHAIN_ID));
    u.searchParams.set("module", "contract");
    u.searchParams.set("action", "getsourcecode");
    u.searchParams.set("address", ca);
    u.searchParams.set("apikey", env.ETHERSCAN_API_KEY);
    const res = await fetch(u.toString(), { signal: ctl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      status?: string;
      result?: Array<{
        SourceCode?: string;
        ContractName?: string;
        CompilerVersion?: string;
        Proxy?: string;
      }>;
    };
    if (j.status !== "1" || !j.result?.[0]) return null;
    const r = j.result[0];
    return {
      verified: Boolean(r.SourceCode && r.SourceCode.length > 0),
      name: r.ContractName || undefined,
      compiler: r.CompilerVersion || undefined,
      proxy: r.Proxy === "1",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function pickCanonicalPair(pairs: DexPair[]): DexPair | null {
  if (pairs.length === 0) return null;
  return pairs.reduce((best, cur) =>
    (cur.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? cur : best,
  );
}

interface ResearchFacts {
  label: string;
  address: string;
  symbol: string | null;
  name: string | null;
  quote: string | null;
  dex: string | null;
  pair_address: string | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  fdv_usd: number | null;
  market_cap_usd: number | null;
  volume_1h_usd: number | null;
  volume_24h_usd: number | null;
  price_change_1h_pct: number | null;
  price_change_24h_pct: number | null;
  txns_24h_buys: number | null;
  txns_24h_sells: number | null;
  pair_age_days: number | null;
  contract_verified: boolean | null;
  contract_name: string | null;
  contract_is_proxy: boolean | null;
}

function buildFacts(input: ResearchInput, pair: DexPair, contract: ContractInfo | null): ResearchFacts {
  const priceUsd = pair.priceUsd != null ? Number(pair.priceUsd) : NaN;
  return {
    label: input.label,
    address: input.ca,
    symbol: pair.baseToken?.symbol ?? null,
    name: pair.baseToken?.name ?? null,
    quote: pair.quoteToken?.symbol ?? null,
    dex: pair.dexId ?? null,
    pair_address: pair.pairAddress ?? null,
    price_usd: Number.isFinite(priceUsd) ? priceUsd : null,
    liquidity_usd: pair.liquidity?.usd ?? null,
    fdv_usd: pair.fdv ?? null,
    market_cap_usd: pair.marketCap ?? null,
    volume_1h_usd: pair.volume?.h1 ?? null,
    volume_24h_usd: pair.volume?.h24 ?? null,
    price_change_1h_pct: pair.priceChange?.h1 ?? null,
    price_change_24h_pct: pair.priceChange?.h24 ?? null,
    txns_24h_buys: pair.txns?.h24?.buys ?? null,
    txns_24h_sells: pair.txns?.h24?.sells ?? null,
    pair_age_days:
      pair.pairCreatedAt != null && Number.isFinite(pair.pairCreatedAt)
        ? Math.floor((Date.now() - pair.pairCreatedAt) / 86_400_000)
        : null,
    contract_verified: contract?.verified ?? null,
    contract_name: contract?.name ?? null,
    contract_is_proxy: contract?.proxy ?? null,
  };
}

const SYNTHESIS_SYSTEM = `You are Vexor Researcher, a focused crypto analyst writing for a Telegram bot.

You receive a JSON payload of raw token data fetched from DexScreener (and optionally Basescan).
You MUST produce a tight Telegram Markdown brief in EXACTLY this structure, with no preamble and no postscript:

*Verdict:* <one word, choose from: BULLISH, BEARISH, MIXED, QUIET>

*Pulse:*
\u2022 <one sentence about price action, citing at least one number from the JSON>
\u2022 <one sentence about liquidity health (depth, ratio to vol, age of pair)>
\u2022 <one sentence about volume / trade activity, or contract security if contract data is in JSON>

*Risk:* <1-3 short flags, comma-separated, lowercase (e.g. "thin liquidity, unverified contract, low age")>

*Outlook:* <one short forward-looking sentence>

Hard rules:
- Never invent numbers. Every figure you cite must appear in the JSON.
- Never reference data that isn't in the JSON (no Twitter sentiment, no holder counts, no audit info unless provided).
- No prose outside the structure above.
- Total output under 220 words.
- Do not wrap output in quotes or code blocks.`;

interface GroqResp {
  choices?: Array<{ message?: { content?: string } }>;
}

async function callGroqSynthesis(env: Env, facts: ResearchFacts): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY missing");
  }
  const userMsg = [
    `Token: ${facts.label} on Base (CA: ${facts.address})`,
    "",
    "Raw data:",
    "```json",
    JSON.stringify(facts, null, 2),
    "```",
  ].join("\n");

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), GROQ_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYNTHESIS_SYSTEM },
          { role: "user", content: userMsg },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
      signal: ctl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq ${res.status}: ${errText.slice(0, 200)}`);
    }
    const j = (await res.json()) as GroqResp;
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Groq returned empty response");
    return text;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Produce a Telegram-Markdown brief for the given input. Throws on hard
 * failures (no pair found, Groq unreachable, etc.); the watchtower
 * command handler catches and converts these to user-friendly errors.
 */
export async function produceResearchBrief(env: Env, input: ResearchInput): Promise<string> {
  const [pairs, contract] = await Promise.all([
    fetchDexPairs(input.ca),
    fetchContractInfo(env, input.ca),
  ]);
  const pair = pickCanonicalPair(pairs);
  if (!pair) {
    throw new ResearchError(
      `No DexScreener pair found on Base for ${input.kind === "ca" ? `\`${shortAddr(input.ca)}\`` : input.label}. ` +
        "Either the token has no liquidity pool yet, or the CA is wrong.",
    );
  }

  const facts = buildFacts(input, pair, contract);
  const llmBody = await callGroqSynthesis(env, facts);
  const header = composeHeader(input, pair);
  const footer = `_DexScreener${contract ? " + Basescan" : ""} + Groq ${GROQ_MODEL}. Fetched ${new Date().toUTCString()}._`;

  return `${header}\n\n${llmBody}\n\n${footer}`;
}

function composeHeader(input: ResearchInput, pair: DexPair): string {
  const meta = input.kind === "slug" && input.slug ? getIntelToken(input.slug) : null;
  const symbol = meta?.symbol ?? pair.baseToken?.symbol ?? "?";
  const name = meta?.name ?? pair.baseToken?.name ?? "Unknown";
  const quote = pair.quoteToken?.symbol ?? "?";
  const dex = pair.dexId ?? "?";
  const priceStr = pair.priceUsd ? formatPrice(Number(pair.priceUsd)) : "\u2014";
  const liqStr = fmtUsdCompactMaybe(pair.liquidity?.usd ?? null);
  const volStr = fmtUsdCompactMaybe(pair.volume?.h24 ?? null);
  const ch24 = formatPctSigned(pair.priceChange?.h24 ?? null);

  return [
    `\uD83D\uDD2C *Research: ${escapeMd(symbol)}* \u2014 ${escapeMd(name)}`,
    `Base \u00B7 ${escapeMd(dex)} \u00B7 vs ${escapeMd(quote)}`,
    `Price ${priceStr} (${ch24} 24h) \u00B7 Liq ${liqStr} \u00B7 Vol24 ${volStr}`,
  ].join("\n");
}

/** Short-address helper (`0x22aF\u20266F3b`). */
function shortAddr(a: string): string {
  return `${a.slice(0, 6)}\u2026${a.slice(-4)}`;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "\u2014";
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function fmtUsdCompactMaybe(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPctSigned(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

/** Mirrors `escapeMarkdown` in worker/watchtower.ts. */
function escapeMd(s: string): string {
  return s.replace(/([_*`\[\]])/g, "\\$1");
}

/** Thrown when researcher fails for a *user-actionable* reason (bad CA, etc.). */
export class ResearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchError";
  }
}

/** Exposed for tests / future surface. Returns the full INTEL_TOKENS slug list. */
export function listSupportedSlugs(): string[] {
  return INTEL_TOKENS.map((t) => t.slug);
}
