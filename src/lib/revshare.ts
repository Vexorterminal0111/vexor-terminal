// Shared on-chain data helpers for the $VT RevShare pool on Base mainnet.
// Used by the landing Hero APR widget and the /widget/stats embed page.

export const RPC_URL = "https://mainnet.base.org";
export const STAKING_CONTRACT = "0xE25f6243f848523c4577639e975B9F3E0fA57186";
export const VT_TOKEN = "0x2c684D666998436634EcEde1527EdA7975427Ba3";
export const LOG_BLOCK_RANGE = 90000;
export const LOG_CHUNK_SIZE = 9000;

const SEL_TOTAL_STAKED = "0x817b1cd2";
const TOPIC_REWARDS_PUSHED =
  "0xc1385e138caab1497b877640f7c64be52dcce8053e3e24b2b13d34af76d7d835";

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
}
interface DexResponse {
  pairs: DexPair[] | null;
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}

async function fetchLogsChunked(
  topic: string,
  currentBlock: number
): Promise<RawLog[]> {
  const chunks: { fromBlock: string; toBlock: string }[] = [];
  for (let end = currentBlock; end > currentBlock - LOG_BLOCK_RANGE; end -= LOG_CHUNK_SIZE) {
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
      ]).catch(() => [] as RawLog[])
    )
  );
  return results.flat() as RawLog[];
}

export interface PoolSummary {
  totalStaked: bigint; // raw wei
  vtPriceUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  estimatedApr: number | null; // percent, e.g. 110.28
  rewards30dVt: bigint;
}

export async function fetchPoolSummary(): Promise<PoolSummary> {
  // 1) Pool stats — fatal
  const [tsHex, blockHex] = await Promise.all([
    rpcCall("eth_call", [{ to: STAKING_CONTRACT, data: SEL_TOTAL_STAKED }, "latest"]),
    rpcCall("eth_blockNumber", []),
  ]);
  const totalStaked = hexToBigInt(tsHex as string);
  const currentBlock = Number(hexToBigInt(blockHex as string));

  // 2) Optional: price (non-fatal)
  let vtPriceUsd: number | null = null;
  let fdvUsd: number | null = null;
  let volume24hUsd: number | null = null;
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${VT_TOKEN}`
    );
    const j = (await r.json()) as DexResponse;
    const pair = j?.pairs?.[0];
    if (pair) {
      vtPriceUsd = pair.priceUsd ? Number(pair.priceUsd) : null;
      fdvUsd = pair.fdv ?? null;
      volume24hUsd = pair.volume?.h24 ?? null;
    }
  } catch {
    // ignore
  }

  // 3) Optional: APR estimate from last 30d of RewardsPushed (non-fatal)
  let rewards30dVt = 0n;
  let estimatedApr: number | null = null;
  try {
    const logs = await fetchLogsChunked(TOPIC_REWARDS_PUSHED, currentBlock);
    if (logs.length > 0) {
      // Window = (current block timestamp) − (oldest fetched log timestamp).
      // Using the current head instead of the newest log timestamp keeps the
      // window meaningful when only one log exists or when several logs land
      // in the same block — otherwise newestTs − oldestTs collapses to 0 and
      // the annualization explodes (e.g. a single 1k VT push → ~1.6M% APR).
      const oldest = logs.reduce<RawLog>(
        (acc, l) => (Number(BigInt(l.blockNumber)) < Number(BigInt(acc.blockNumber)) ? l : acc),
        logs[0]
      );
      const [oldestBlock, headBlock] = (await Promise.all([
        rpcCall("eth_getBlockByNumber", [oldest.blockNumber, false]),
        rpcCall("eth_getBlockByNumber", ["latest", false]),
      ])) as BlockInfo[];
      const oldestTs = Number(BigInt(oldestBlock.timestamp));
      const headTs = Number(BigInt(headBlock.timestamp));
      const windowSeconds = headTs - oldestTs;

      // Event RewardsPushed(address indexed from, uint256 amount, uint256 newAcc)
      // packs two non-indexed uint256s into `data` (64 bytes). Only the first
      // 32 bytes is the reward amount — including the second word inflates the
      // sum by ~2^256 per log and explodes APR to e+80%.
      let total = 0n;
      for (const l of logs) {
        total += hexToBigInt("0x" + l.data.slice(2, 66));
      }
      rewards30dVt = total;

      // Require a minimum window of 1 hour before annualizing. A shorter
      // window would dramatically over-extrapolate from a single fresh push.
      const MIN_APR_WINDOW_SECONDS = 60 * 60;
      if (totalStaked > 0n && windowSeconds >= MIN_APR_WINDOW_SECONDS) {
        // Annualize: (total / windowSeconds) * (365d in seconds) / totalStaked * 100
        const yearSeconds = 365 * 24 * 60 * 60;
        const totalNum = Number(total / 10n ** 14n) / 10000;
        const stakedNum = Number(totalStaked / 10n ** 14n) / 10000;
        if (stakedNum > 0) {
          estimatedApr = (totalNum / windowSeconds) * yearSeconds / stakedNum * 100;
        }
      }
    }
  } catch {
    // ignore — keep estimatedApr as null
  }

  return {
    totalStaked,
    vtPriceUsd,
    fdvUsd,
    volume24hUsd,
    estimatedApr,
    rewards30dVt,
  };
}

export function formatVtCompact(raw: bigint): string {
  const num = Number(raw / 10n ** 14n) / 10000;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

export function formatUsdCompact(val: number): string {
  if (val >= 1e9) return "$" + (val / 1e9).toFixed(2) + "B";
  if (val >= 1e6) return "$" + (val / 1e6).toFixed(2) + "M";
  if (val >= 1e3) return "$" + (val / 1e3).toFixed(2) + "K";
  if (val < 0.01 && val > 0) return "$" + val.toFixed(8);
  return "$" + val.toFixed(2);
}
