/**
 * Vexor Pool API — GET /api/pool
 *
 * Public, read-only JSON endpoint exposing the live state of the $VT RevShare
 * pool on Base mainnet. Aggregates on-chain RPC calls + DexScreener price data
 * into a single normalized response so external consumers (dashboards, bots,
 * indexers) don't have to re-derive APR / push interval / market data.
 *
 * The body is identical to what the landing Hero APR widget and the
 * /widget/stats embed page render, just JSON-shaped.
 *
 * Caching: 60s edge cache via the Cache API + `Cache-Control: public,
 * s-maxage=60`. CORS open (`*`) — this is a public API.
 */

import type { Env } from "./index";

const RPC_URL = "https://mainnet.base.org";
const STAKING_CONTRACT = "0xE25f6243f848523c4577639e975B9F3E0fA57186";
const VT_TOKEN = "0x2c684D666998436634EcEde1527EdA7975427Ba3";
const OWNER = "0x0259abb884050E19e787cF7E271b6984E13BD79B";
const CHAIN_ID = 8453;
const NETWORK_NAME = "base-mainnet";

const SEL_TOTAL_STAKED = "0x817b1cd2"; // totalStaked()
const SEL_ACC_REWARD = "0xcbce44b4"; // accRewardPerToken()
const SEL_BALANCE_OF = "0x70a08231"; // balanceOf(address)

const TOPIC_REWARDS_PUSHED =
  "0xc1385e138caab1497b877640f7c64be52dcce8053e3e24b2b13d34af76d7d835";

const LOG_BLOCK_RANGE = 90000;
const LOG_CHUNK_SIZE = 9000;

const CACHE_TTL_SECONDS = 60;
const SCHEMA_VERSION = "1";

interface RawLog {
  blockNumber: string;
  transactionHash: string;
  data: string;
}

interface BlockInfo {
  timestamp: string;
}

interface DexPair {
  priceUsd?: string;
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
}

interface DexResponse {
  pairs: DexPair[] | null;
}

interface PoolApiResponse {
  schema_version: string;
  fetched_at: string;
  block_number: number;
  contract: {
    revshare: string;
    token: string;
    owner: string;
    network: string;
    chain_id: number;
  };
  pool: {
    total_staked_wei: string;
    total_staked_vt: string;
    pool_balance_wei: string;
    pool_balance_vt: string;
    acc_reward_per_token: string;
  };
  rewards: {
    total_distributed_wei: string;
    total_distributed_vt: string;
    estimated_apr_percent: number | null;
    avg_push_interval_hours: number | null;
    window_blocks: number;
    window_logs_count: number;
  };
  market: {
    vt_price_usd: number | null;
    volume_24h_usd: number | null;
    market_cap_usd: number | null;
    fdv_usd: number | null;
    source: string;
  };
  links: {
    site: string;
    docs: string;
    basescan_revshare: string;
    basescan_token: string;
    github: string;
  };
}

function padAddress(addr: string): string {
  return "000000000000000000000000" + addr.slice(2).toLowerCase();
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}

function formatVt(raw: bigint): string {
  // 4 decimal places, fixed
  const num = Number(raw / 10n ** 14n) / 10000;
  return num.toFixed(4);
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

async function fetchLogsChunked(
  topic: string,
  currentBlock: number,
): Promise<RawLog[]> {
  const chunks: { fromBlock: string; toBlock: string }[] = [];
  for (
    let end = currentBlock;
    end > currentBlock - LOG_BLOCK_RANGE;
    end -= LOG_CHUNK_SIZE
  ) {
    const start = Math.max(0, end - LOG_CHUNK_SIZE + 1);
    chunks.push({
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
    });
  }
  const results = await Promise.all(
    chunks.map((c) =>
      rpcCall("eth_getLogs", [
        {
          address: STAKING_CONTRACT,
          topics: [topic],
          fromBlock: c.fromBlock,
          toBlock: c.toBlock,
        },
      ]).catch(() => [] as RawLog[]),
    ),
  );
  return results.flat() as RawLog[];
}

async function buildPoolResponse(): Promise<PoolApiResponse> {
  // 1) Required on-chain reads (fatal if any fail)
  const [tsHex, accHex, balHex, blockHex] = await Promise.all([
    rpcCall("eth_call", [
      { to: STAKING_CONTRACT, data: SEL_TOTAL_STAKED },
      "latest",
    ]),
    rpcCall("eth_call", [
      { to: STAKING_CONTRACT, data: SEL_ACC_REWARD },
      "latest",
    ]),
    rpcCall("eth_call", [
      { to: VT_TOKEN, data: SEL_BALANCE_OF + padAddress(STAKING_CONTRACT) },
      "latest",
    ]),
    rpcCall("eth_blockNumber", []),
  ]);

  const totalStaked = hexToBigInt(tsHex as string);
  const accReward = hexToBigInt(accHex as string);
  const poolBalance = hexToBigInt(balHex as string);
  const currentBlock = Number(hexToBigInt(blockHex as string));

  // 2) Optional: DexScreener (non-fatal)
  let vtPriceUsd: number | null = null;
  let fdvUsd: number | null = null;
  let volume24hUsd: number | null = null;
  let marketCapUsd: number | null = null;
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${VT_TOKEN}`,
    );
    if (r.ok) {
      const j = (await r.json()) as DexResponse;
      const pair = j?.pairs?.[0];
      if (pair) {
        vtPriceUsd = pair.priceUsd ? Number(pair.priceUsd) : null;
        fdvUsd = pair.fdv ?? null;
        volume24hUsd = pair.volume?.h24 ?? null;
        marketCapUsd = pair.marketCap ?? fdvUsd;
      }
    }
  } catch {
    // ignore
  }

  // 3) Optional: RewardsPushed aggregation (non-fatal)
  let totalDistributed = 0n;
  let estimatedApr: number | null = null;
  let avgPushIntervalHours: number | null = null;
  let logsCount = 0;
  try {
    const logs = await fetchLogsChunked(TOPIC_REWARDS_PUSHED, currentBlock);
    logsCount = logs.length;
    if (logs.length > 0) {
      // Use the first 32 bytes of `data` (amount) — see src/lib/revshare.ts
      // for why the second word must be skipped.
      let total = 0n;
      for (const l of logs) {
        total += hexToBigInt("0x" + l.data.slice(2, 66));
      }
      totalDistributed = total;

      // Block-time window: oldest log block timestamp → current head timestamp.
      const oldest = logs.reduce<RawLog>(
        (acc, l) =>
          Number(BigInt(l.blockNumber)) < Number(BigInt(acc.blockNumber))
            ? l
            : acc,
        logs[0],
      );
      const [oldestBlock, headBlock] = (await Promise.all([
        rpcCall("eth_getBlockByNumber", [oldest.blockNumber, false]),
        rpcCall("eth_getBlockByNumber", ["latest", false]),
      ])) as BlockInfo[];
      const oldestTs = Number(BigInt(oldestBlock.timestamp));
      const headTs = Number(BigInt(headBlock.timestamp));
      const windowSeconds = headTs - oldestTs;

      const MIN_APR_WINDOW_SECONDS = 60 * 60;
      if (totalStaked > 0n && windowSeconds >= MIN_APR_WINDOW_SECONDS) {
        const yearSeconds = 365 * 24 * 60 * 60;
        const totalNum = Number(total / 10n ** 14n) / 10000;
        const stakedNum = Number(totalStaked / 10n ** 14n) / 10000;
        if (stakedNum > 0) {
          estimatedApr =
            ((totalNum / windowSeconds) * yearSeconds) / stakedNum * 100;
        }
      }

      if (logs.length >= 2 && windowSeconds > 0) {
        avgPushIntervalHours = windowSeconds / (logs.length - 1) / 3600;
      }
    }
  } catch {
    // ignore
  }

  return {
    schema_version: SCHEMA_VERSION,
    fetched_at: new Date().toISOString(),
    block_number: currentBlock,
    contract: {
      revshare: STAKING_CONTRACT,
      token: VT_TOKEN,
      owner: OWNER,
      network: NETWORK_NAME,
      chain_id: CHAIN_ID,
    },
    pool: {
      total_staked_wei: totalStaked.toString(),
      total_staked_vt: formatVt(totalStaked),
      pool_balance_wei: poolBalance.toString(),
      pool_balance_vt: formatVt(poolBalance),
      acc_reward_per_token: accReward.toString(),
    },
    rewards: {
      total_distributed_wei: totalDistributed.toString(),
      total_distributed_vt: formatVt(totalDistributed),
      estimated_apr_percent:
        estimatedApr !== null ? Number(estimatedApr.toFixed(2)) : null,
      avg_push_interval_hours:
        avgPushIntervalHours !== null
          ? Number(avgPushIntervalHours.toFixed(2))
          : null,
      window_blocks: LOG_BLOCK_RANGE,
      window_logs_count: logsCount,
    },
    market: {
      vt_price_usd: vtPriceUsd,
      volume_24h_usd: volume24hUsd,
      market_cap_usd: marketCapUsd,
      fdv_usd: fdvUsd,
      source: "dexscreener",
    },
    links: {
      site: "https://vexorterminal.com",
      docs: "https://vexorterminal.com/docs/api",
      basescan_revshare: `https://basescan.org/address/${STAKING_CONTRACT}`,
      basescan_token: `https://basescan.org/address/${VT_TOKEN}`,
      github: "https://github.com/Vexorterminal0111/vexor-terminal",
    },
  };
}

const PUBLIC_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export async function handlePool(
  request: Request,
  _env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: PUBLIC_CORS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed", allowed: ["GET", "HEAD", "OPTIONS"] }),
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

  const url = new URL(request.url);
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    // Re-attach CORS headers (Cache API preserves Cache-Control + content-type,
    // but echoing allow-origin keeps behavior consistent on every hit).
    const h = new Headers(cached.headers);
    for (const [k, v] of Object.entries(PUBLIC_CORS)) h.set(k, v);
    h.set("x-vexor-cache", "HIT");
    return new Response(request.method === "HEAD" ? null : cached.body, {
      status: cached.status,
      headers: h,
    });
  }

  try {
    const data = await buildPoolResponse();
    const body = JSON.stringify(data, null, 2);
    const headers = new Headers({
      ...PUBLIC_CORS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, s-maxage=${CACHE_TTL_SECONDS}, max-age=${CACHE_TTL_SECONDS}`,
      "x-vexor-schema": SCHEMA_VERSION,
      "x-vexor-cache": "MISS",
    });
    const res = new Response(body, { status: 200, headers });
    // Store a fresh copy (without the x-vexor-cache header rewritten).
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return request.method === "HEAD"
      ? new Response(null, { status: 200, headers })
      : res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return new Response(
      JSON.stringify({ error: "upstream_failure", detail: msg }),
      {
        status: 502,
        headers: {
          ...PUBLIC_CORS,
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }
}
