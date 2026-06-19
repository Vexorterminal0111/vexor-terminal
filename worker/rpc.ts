/**
 * Shared Solana mainnet RPC client for Worker routes.
 *
 * Extracted from `worker/pool.ts` so other handlers (Watchtower `/portfolio`,
 * future on-chain reads) can reuse the same multi-RPC fallback strategy
 * without duplicating endpoint lists, timeout handling, or selector
 * conventions.
 *
 * Strategy: try each RPC in `RPC_URLS` order; on any failure (4xx, 5xx,
 * timeout, network error) move on to the next.
 *
 * Keep this module **stateless** — no caching, no env access. Caching is
 * the caller's responsibility (see pool.ts edge-cache wrapper).
 */

const RPC_URLS: ReadonlyArray<string> = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
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
// Helpers
// -----------------------------------------------------------------------------

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}
