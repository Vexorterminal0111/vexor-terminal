// Shared on-chain data helpers for the $VEXOR RevShare pool on Solana mainnet.
// Currently stubbed — will be implemented once Anchor programs deploy.

export const RPC_URL = "https://api.mainnet-beta.solana.com";
export const STAKING_CONTRACT = "11111111111111111111111111111111";
export const VT_TOKEN = "11111111111111111111111111111111";
export const LOG_BLOCK_RANGE = 90000;
export const LOG_CHUNK_SIZE = 9000;

export interface PoolSummary {
  totalStaked: bigint;
  vtPriceUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  estimatedApr: number | null;
  rewards30dVt: bigint;
}

export async function fetchPoolSummary(): Promise<PoolSummary> {
  // Stubbed until Solana Anchor programs deploy.
  return {
    totalStaked: 0n,
    vtPriceUsd: null,
    fdvUsd: null,
    volume24hUsd: null,
    estimatedApr: null,
    rewards30dVt: 0n,
  };
}

export function formatVtCompact(raw: bigint): string {
  const num = Number(raw) / 1e9;
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
