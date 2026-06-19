/**
 * Vexor Pulse Premium — GET /api/intel/<slug>
 *
 * Per-token public read-only JSON endpoint. The companion aeon fork
 * publishes one file per token to `intel/tokens/<slug>.json` on the
 * `data` branch (via `scripts/vexor-pulse-premium.sh`). This handler
 * fetches that file, normalizes it, edge-caches the response for 60s,
 * and returns it.
 *
 * Slug validation happens locally against an allow-list (the same list
 * the static export uses for `generateStaticParams()`) so we don't fan
 * out 404s to GitHub Raw for typos / scrapers.
 *
 * The index manifest is served at `/api/intel/index` from the same
 * branch path `intel/tokens/index.json`.
 *
 * CORS open (`*`) — public read API.
 */

import type { Env } from "./index";
import { isIntelTokenSlug } from "../src/lib/intel-tokens";

const DEFAULT_BASE_URL =
  "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens";

const CACHE_TTL_SECONDS = 60;
const SCHEMA_VERSION = "1";
const FETCH_TIMEOUT_MS = 5000;

interface TokenCard {
  card: string;
  title?: string;
  summary?: string;
  markdown?: string;
  produced_at?: string;
  run_id?: string | number;
}

interface MarketSnapshot {
  price_usd?: number | null;
  volume_24h_usd?: number;
  liquidity_usd?: number;
  fdv_usd?: number;
  market_cap_usd?: number;
  price_change_1h_pct?: number;
  price_change_6h_pct?: number;
  price_change_24h_pct?: number;
  txns_24h?: { buys?: number; sells?: number };
  top_pool?: { address?: string; dex?: string; url?: string };
}

interface TokenMeta {
  slug?: string;
  symbol?: string;
  name?: string;
  ca?: string;
  network?: string;
  host?: boolean;
  blurb?: string | null;
  solscan_url?: string;
  dex_url?: string;
}

interface TokenPayload {
  schema_version?: string;
  generated_at?: string;
  next_run_at?: string | null;
  source?: string;
  token?: TokenMeta;
  market_snapshot?: MarketSnapshot;
  cards?: TokenCard[];
}

interface IndexEntry {
  slug?: string;
  symbol?: string;
  name?: string;
  ca?: string;
  network?: string;
  host?: boolean;
  blurb?: string | null;
  summary?: string | null;
  produced_at?: string;
  price_usd?: number | null;
  price_change_24h_pct?: number;
  volume_24h_usd?: number;
  liquidity_usd?: number;
  fdv_usd?: number;
}

interface IndexPayload {
  schema_version?: string;
  generated_at?: string;
  next_run_at?: string | null;
  source?: string;
  tokens?: IndexEntry[];
}

const PUBLIC_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      cf: { cacheTtl: 60, cacheEverything: true },
      headers: { "user-agent": "vexor-pulse-premium-worker/1" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...PUBLIC_CORS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=30, s-maxage=${CACHE_TTL_SECONDS}`,
    },
  });
}

function emptyToken(slug: string, sourceUrl: string): TokenPayload {
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: undefined,
    next_run_at: null,
    source: sourceUrl,
    token: { slug },
    market_snapshot: {},
    cards: [],
  };
}

function emptyIndex(sourceUrl: string): IndexPayload {
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: undefined,
    next_run_at: null,
    source: sourceUrl,
    tokens: [],
  };
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function pickNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function pickBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function normalizeToken(raw: unknown, slug: string, sourceUrl: string): TokenPayload {
  if (!raw || typeof raw !== "object") return emptyToken(slug, sourceUrl);
  const obj = raw as Record<string, unknown>;
  const tokenIn =
    obj.token && typeof obj.token === "object"
      ? (obj.token as Record<string, unknown>)
      : {};
  const marketIn =
    obj.market_snapshot && typeof obj.market_snapshot === "object"
      ? (obj.market_snapshot as Record<string, unknown>)
      : {};
  const cardsIn = Array.isArray(obj.cards) ? obj.cards : [];

  const txnsIn =
    marketIn.txns_24h && typeof marketIn.txns_24h === "object"
      ? (marketIn.txns_24h as Record<string, unknown>)
      : {};
  const poolIn =
    marketIn.top_pool && typeof marketIn.top_pool === "object"
      ? (marketIn.top_pool as Record<string, unknown>)
      : {};

  const cards: TokenCard[] = [];
  for (const entry of cardsIn) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const card = pickString(e.card);
    if (!card) continue;
    cards.push({
      card,
      title: pickString(e.title),
      summary: pickString(e.summary),
      markdown: pickString(e.markdown),
      produced_at: pickString(e.produced_at),
      run_id:
        typeof e.run_id === "string" || typeof e.run_id === "number"
          ? e.run_id
          : undefined,
    });
  }

  return {
    schema_version: pickString(obj.schema_version) ?? SCHEMA_VERSION,
    generated_at: pickString(obj.generated_at),
    next_run_at: pickString(obj.next_run_at) ?? null,
    source: sourceUrl,
    token: {
      slug: pickString(tokenIn.slug) ?? slug,
      symbol: pickString(tokenIn.symbol),
      name: pickString(tokenIn.name),
      ca: pickString(tokenIn.ca),
      network: pickString(tokenIn.network),
      host: pickBool(tokenIn.host),
      blurb: pickString(tokenIn.blurb) ?? null,
      solscan_url: pickString(tokenIn.solscan_url),
      dex_url: pickString(tokenIn.dex_url),
    },
    market_snapshot: {
      price_usd:
        typeof marketIn.price_usd === "number"
          ? marketIn.price_usd
          : marketIn.price_usd === null
            ? null
            : undefined,
      volume_24h_usd: pickNumber(marketIn.volume_24h_usd),
      liquidity_usd: pickNumber(marketIn.liquidity_usd),
      fdv_usd: pickNumber(marketIn.fdv_usd),
      market_cap_usd: pickNumber(marketIn.market_cap_usd),
      price_change_1h_pct: pickNumber(marketIn.price_change_1h_pct),
      price_change_6h_pct: pickNumber(marketIn.price_change_6h_pct),
      price_change_24h_pct: pickNumber(marketIn.price_change_24h_pct),
      txns_24h: {
        buys: pickNumber(txnsIn.buys),
        sells: pickNumber(txnsIn.sells),
      },
      top_pool: {
        address: pickString(poolIn.address),
        dex: pickString(poolIn.dex),
        url: pickString(poolIn.url),
      },
    },
    cards,
  };
}

function normalizeIndex(raw: unknown, sourceUrl: string): IndexPayload {
  if (!raw || typeof raw !== "object") return emptyIndex(sourceUrl);
  const obj = raw as Record<string, unknown>;
  const tokensIn = Array.isArray(obj.tokens) ? obj.tokens : [];
  const tokens: IndexEntry[] = [];
  for (const entry of tokensIn) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const slug = pickString(e.slug);
    if (!slug) continue;
    tokens.push({
      slug,
      symbol: pickString(e.symbol),
      name: pickString(e.name),
      ca: pickString(e.ca),
      network: pickString(e.network),
      host: pickBool(e.host),
      blurb: pickString(e.blurb) ?? null,
      summary: pickString(e.summary) ?? null,
      produced_at: pickString(e.produced_at),
      price_usd:
        typeof e.price_usd === "number"
          ? e.price_usd
          : e.price_usd === null
            ? null
            : undefined,
      price_change_24h_pct: pickNumber(e.price_change_24h_pct),
      volume_24h_usd: pickNumber(e.volume_24h_usd),
      liquidity_usd: pickNumber(e.liquidity_usd),
      fdv_usd: pickNumber(e.fdv_usd),
    });
  }
  return {
    schema_version: pickString(obj.schema_version) ?? SCHEMA_VERSION,
    generated_at: pickString(obj.generated_at),
    next_run_at: pickString(obj.next_run_at) ?? null,
    source: sourceUrl,
    tokens,
  };
}

export async function handleIntelToken(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  slug: string,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: PUBLIC_CORS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({
        error: "method_not_allowed",
        allowed: ["GET", "HEAD", "OPTIONS"],
      }),
      {
        status: 405,
        headers: {
          ...PUBLIC_CORS,
          "content-type": "application/json; charset=utf-8",
          allow: "GET, HEAD, OPTIONS",
        },
      },
    );
  }

  const baseUrl = (env.INTEL_TOKEN_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );

  // Special "index" route — list manifest.
  if (slug === "index") {
    const url = new URL(request.url);
    url.search = "";
    url.hash = "";
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cache = (caches as unknown as { default: Cache }).default;
    const cached = await cache.match(cacheKey).catch(() => undefined);
    if (cached) return cached;

    const indexUrl = `${baseUrl}/index.json`;
    let payload: IndexPayload;
    try {
      const upstream = await fetchWithTimeout(indexUrl, FETCH_TIMEOUT_MS);
      if (!upstream.ok) {
        payload = emptyIndex(indexUrl);
      } else {
        payload = normalizeIndex(await upstream.json(), indexUrl);
      }
    } catch {
      payload = emptyIndex(indexUrl);
    }

    const res = jsonResponse(payload, 200);
    ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => undefined));
    return res;
  }

  // Per-token route.
  if (!isIntelTokenSlug(slug)) {
    return jsonResponse(
      {
        error: "unknown_token",
        slug,
        hint: "GET /api/intel/index for the full list of supported tokens.",
      },
      404,
    );
  }

  const normalizedSlug = slug.toLowerCase();
  const tokenUrl = `${baseUrl}/${normalizedSlug}.json`;

  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(cacheKey).catch(() => undefined);
  if (cached) return cached;

  let payload: TokenPayload;
  try {
    const upstream = await fetchWithTimeout(tokenUrl, FETCH_TIMEOUT_MS);
    if (!upstream.ok) {
      // 404 from GitHub Raw = file not produced yet by the cron. Surface
      // an empty payload (not a 404) so the page can render its
      // "no data yet" empty state instead of breaking.
      payload = emptyToken(normalizedSlug, tokenUrl);
    } else {
      payload = normalizeToken(await upstream.json(), normalizedSlug, tokenUrl);
    }
  } catch {
    payload = emptyToken(normalizedSlug, tokenUrl);
  }

  const res = jsonResponse(payload, 200);
  ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => undefined));
  return res;
}
