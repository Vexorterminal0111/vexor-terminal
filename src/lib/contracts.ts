import type { Address } from "viem";
import { base, baseSepolia } from "wagmi/chains";

export type ContractAddresses = {
  token: Address | null;
  staking: Address | null;
  governance: Address | null;
  /** Mainnet revenue-share staking pool (VexorRevShare). Only set on Base mainnet. */
  revShare: Address | null;
};

const ZERO = "0x0000000000000000000000000000000000000000" as const;

// Direct process.env access (not dynamic) so Next.js can statically inline at build time.
function asAddr(v: string | undefined): Address | null {
  if (!v || v === ZERO) return null;
  return v as Address;
}

// Hardcoded mainnet revenue-share pool. Public, verified on Basescan.
const VEXOR_REV_SHARE_MAINNET: Address = "0xE25f6243f848523c4577639e975B9F3E0fA57186";

export const CONTRACTS: Record<number, ContractAddresses> = {
  [base.id]: {
    token: asAddr(process.env.NEXT_PUBLIC_VEXOR_TOKEN),
    staking: asAddr(process.env.NEXT_PUBLIC_VEXOR_STAKING),
    governance: asAddr(process.env.NEXT_PUBLIC_VEXOR_GOVERNANCE),
    revShare: VEXOR_REV_SHARE_MAINNET,
  },
  [baseSepolia.id]: {
    token: asAddr(process.env.NEXT_PUBLIC_VEXOR_TOKEN_TESTNET),
    staking: asAddr(process.env.NEXT_PUBLIC_VEXOR_STAKING_TESTNET),
    governance: asAddr(process.env.NEXT_PUBLIC_VEXOR_GOVERNANCE_TESTNET),
    revShare: null,
  },
};

export function getContracts(chainId: number | undefined): ContractAddresses {
  if (!chainId || !(chainId in CONTRACTS)) {
    return { token: null, staking: null, governance: null, revShare: null };
  }
  return CONTRACTS[chainId];
}

export function isTestnet(chainId: number | undefined): boolean {
  return chainId === baseSepolia.id;
}

// -------------------------------------------------------------
// ABIs (only the surface the frontend uses)
// -------------------------------------------------------------

export const VEXOR_TOKEN_ABI = [
  // ERC-20 essentials
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  // ERC20Votes
  {
    type: "function",
    name: "delegate",
    stateMutability: "nonpayable",
    inputs: [{ name: "delegatee", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "delegates",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getVotes",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  // Faucet
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "FAUCET_AMOUNT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// LockTier enum: 0=30d, 1=90d, 2=180d, 3=365d
export const VEXOR_STAKING_ABI = [
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "amount", type: "uint128" },
      { name: "weighted", type: "uint128" },
      { name: "start", type: "uint64" },
      { name: "unlock", type: "uint64" },
      { name: "tier", type: "uint8" },
      { name: "rewardDebt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "pending",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "positionCountOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "positionIdAt",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalWeighted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "rewardRatePerSecond",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "rewardPeriodEnd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const VEXOR_GOVERNOR_ABI = [
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "castVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "proposalVotes",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "againstVotes", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "abstainVotes", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "proposalThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "quorum",
    stateMutability: "view",
    inputs: [{ name: "blockNumber", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "votingDelay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "votingPeriod",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "ProposalCreated",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: false },
      { name: "proposer", type: "address", indexed: false },
      { name: "targets", type: "address[]", indexed: false },
      { name: "values", type: "uint256[]", indexed: false },
      { name: "signatures", type: "string[]", indexed: false },
      { name: "calldatas", type: "bytes[]", indexed: false },
      { name: "voteStart", type: "uint256", indexed: false },
      { name: "voteEnd", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
] as const;

export const LOCK_TIERS = [
  { value: 0, label: "30 days", multiplier: "1.0x", days: 30 },
  { value: 1, label: "90 days", multiplier: "1.5x", days: 90 },
  { value: 2, label: "180 days", multiplier: "2.0x", days: 180 },
  { value: 3, label: "365 days", multiplier: "3.0x", days: 365 },
] as const;

// VexorRevShare — flat $VEXOR mainnet staking pool with manual pro-rata reward push.
// See contracts/src/VexorRevShare.sol.
export const VEXOR_REV_SHARE_ABI = [
  { type: "function", name: "stakingToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalStaked", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "accRewardPerToken", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ACC_PRECISION", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "rewardDebt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pending",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isStaker",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "pushRewards",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  // Events
  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newBalance", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newBalance", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardsPushed",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newAcc", type: "uint256", indexed: false },
    ],
  },
] as const;

export const PROPOSAL_STATES = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
] as const;
