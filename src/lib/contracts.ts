import type { Address } from "viem";
import { base, baseSepolia } from "wagmi/chains";

export type ContractAddresses = {
  token: Address | null;
  staking: Address | null;
  governance: Address | null;
  treasury: Address | null;
};

export const CONTRACTS: Record<number, ContractAddresses> = {
  [base.id]: {
    token: (process.env.NEXT_PUBLIC_VEXOR_TOKEN as Address) || null,
    staking: (process.env.NEXT_PUBLIC_VEXOR_STAKING as Address) || null,
    governance: (process.env.NEXT_PUBLIC_VEXOR_GOVERNANCE as Address) || null,
    treasury: (process.env.NEXT_PUBLIC_VEXOR_TREASURY as Address) || null,
  },
  [baseSepolia.id]: {
    token:
      (process.env.NEXT_PUBLIC_VEXOR_TOKEN_TESTNET as Address) || null,
    staking:
      (process.env.NEXT_PUBLIC_VEXOR_STAKING_TESTNET as Address) || null,
    governance:
      (process.env.NEXT_PUBLIC_VEXOR_GOVERNANCE_TESTNET as Address) || null,
    treasury:
      (process.env.NEXT_PUBLIC_VEXOR_TREASURY_TESTNET as Address) || null,
  },
};

export function getContracts(chainId: number | undefined): ContractAddresses {
  if (!chainId || !(chainId in CONTRACTS)) {
    return { token: null, staking: null, governance: null, treasury: null };
  }
  return CONTRACTS[chainId];
}

export const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
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
] as const;
