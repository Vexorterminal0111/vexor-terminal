/**
 * Shared Base mainnet RPC client for Worker routes.
 *
 * Extracted from `worker/pool.ts` so other handlers (Watchtower `/portfolio`,
 * future on-chain reads) can reuse the same multi-RPC fallback strategy
 * without duplicating endpoint lists, timeout handling, or selector
 * conventions.
 *
 * Strategy: try each RPC in `RPC_URLS` order; on any failure (4xx, 5xx,
 * timeout, network error) move on to the next. From the Cloudflare edge,
 * `mainnet.base.org` aggressively 429s due to shared outbound IP space,
 * so it sits last as the final fallback.
 *
 * Keep this module **stateless** — no caching, no env access. Caching is
 * the caller's responsibility (see pool.ts edge-cache wrapper).
 */

const RPC_URLS: ReadonlyArray<string> = [
  "https://base-rpc.publicnode.com",
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
  "https://mainnet.base.org",
] as const;
const RPC_TIMEOUT_MS = 5000;

async function rpcCallOnce(
  url: string,
  method: string,
  params: unknown[],
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

export async function rpcCall(
  method: string,
  params: unknown[],
): Promise<unknown> {
  let lastErr: unknown = new Error("no rpc endpoints configured");
  for (const url of RPC_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    try {
      const result = await rpcCallOnce(url, method, params, controller.signal);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // try next RPC
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// -----------------------------------------------------------------------------
// ABI / hex helpers
// -----------------------------------------------------------------------------

export function padAddress(addr: string): string {
  // 12-byte left-pad to fit a 32-byte ABI word.
  return "000000000000000000000000" + addr.slice(2).toLowerCase();
}

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}

// Common ERC-20 / RevShare selectors. Keeping them centralized prevents
// the routes from each computing keccak256 hashes by hand and helps grep
// across the worker codebase when adding a new on-chain read.
export const SEL = {
  // ERC-20
  balanceOf: "0x70a08231", // balanceOf(address)
  // VexorRevShare
  pending: "0x5eebea20", // pending(address)
  isStaker: "0x6f1e8533", // isStaker(address)
  totalStaked: "0x817b1cd2", // totalStaked()
  accRewardPerToken: "0xcbce44b4", // accRewardPerToken()
} as const;
