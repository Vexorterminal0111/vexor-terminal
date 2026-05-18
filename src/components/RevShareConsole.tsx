"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import {
  useAccount,
  useChainId,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import {
  Coins,
  Layers,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Gift,
  ArrowDownToLine,
} from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { WalletButton } from "./WalletButton";
import {
  VEXOR_REV_SHARE_ABI,
  VEXOR_TOKEN_ABI,
  getContracts,
} from "@/lib/contracts";

// Base mainnet $VT (canonical, see lib/contracts.ts).
const VT_MAINNET: Address = "0x2c684D666998436634EcEde1527EdA7975427Ba3";

function explorerTx(hash: string) {
  return `https://basescan.org/tx/${hash}`;
}
function explorerAddr(addr: string) {
  return `https://basescan.org/address/${addr}`;
}

function fmt(n: bigint | undefined, decimals = 18, max = 4): string {
  if (n === undefined) return "—";
  const s = formatUnits(n, decimals);
  const [whole, frac] = s.split(".");
  if (!frac) return whole;
  return `${whole}.${frac.slice(0, max).replace(/0+$/, "") || "0"}`;
}

type Mode = "stake" | "withdraw" | "claim";

export function RevShareConsole() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { revShare } = getContracts(base.id);
  const onBaseMainnet = chainId === base.id;

  return (
    <section
      id="revshare"
      className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32 border-t border-white/5"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Live on Base mainnet"
          title="$VT Revenue Share — stake, claim, real $VT."
          description="Flat single-sided staking pool on Base mainnet. No lock, no tier — withdraw anytime. Owner pushes $VT rewards periodically; each staker's claimable balance updates pro-rata to their share of totalStaked."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-10 sm:mt-12 overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3 sm:px-4 py-2 sm:py-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-red-400/70 shrink-0" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-yellow-400/70 shrink-0" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400/70 shrink-0" />
              <span className="ml-2 sm:ml-3 font-mono text-[10px] sm:text-[11px] text-white/60 truncate">
                vexor@revshare —{" "}
                {onBaseMainnet ? "base-mainnet" : chainId ? "wrong-chain" : "disconnected"}
              </span>
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/40 shrink-0 ml-2">
              {isConnected ? "AUTH OK" : "AUTH PENDING"}
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8 min-h-[460px]">
            {!isConnected ? (
              <ConnectGate />
            ) : !onBaseMainnet ? (
              <WrongChainGate />
            ) : !revShare ? (
              <NoContractGate />
            ) : (
              <RevSharePanel
                address={address!}
                revShare={revShare}
                token={VT_MAINNET}
              />
            )}
          </div>
        </motion.div>

        {revShare && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <ContractLink label="RevShare" addr={revShare} />
            <ContractLink label="$VT (staking + reward token)" addr={VT_MAINNET} />
          </div>
        )}
      </div>
    </section>
  );
}

// =============================================================================
// Gates
// =============================================================================

function ConnectGate() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="font-mono text-sm text-white/60">
        <span className="text-cyan-300">vexor@revshare:~$</span> auth --required
      </div>
      <div className="mt-4 font-mono text-base text-white">
        Connect your wallet to access the revenue share pool.
      </div>
      <div className="mt-1 text-xs text-white/50">
        Live on Base mainnet. Real $VT, real gas (~$0.001 per tx).
      </div>
      <div className="mt-6">
        <WalletButton />
      </div>
    </div>
  );
}

function WrongChainGate() {
  const { switchChain } = useSwitchChain();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-300" />
      <div className="mt-3 font-mono text-base text-white">Wrong network.</div>
      <div className="mt-1 max-w-md text-xs text-white/55">
        The revenue-share pool lives on Base mainnet (chainId 8453). Switch
        networks to interact with the live contract.
      </div>
      <button
        onClick={() => switchChain({ chainId: base.id })}
        className="mt-5 px-4 py-2 rounded-md border border-cyan-300/40 bg-cyan-300/10 text-cyan-200 font-mono text-xs uppercase tracking-widest hover:bg-cyan-300/20 transition-colors"
      >
        Switch to Base mainnet
      </button>
    </div>
  );
}

function NoContractGate() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="font-mono text-sm text-white/55">
        RevShare contract not configured for this network.
      </div>
    </div>
  );
}

// =============================================================================
// Main panel
// =============================================================================

function RevSharePanel({
  address,
  revShare,
  token,
}: {
  address: Address;
  revShare: Address;
  token: Address;
}) {
  const [mode, setMode] = useState<Mode>("stake");
  const [amount, setAmount] = useState("100");

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } =
    useWaitForTransactionReceipt({ hash: txHash });

  const reads = useReadContracts({
    contracts: [
      // 0: wallet $VT free balance
      {
        abi: VEXOR_TOKEN_ABI,
        address: token,
        functionName: "balanceOf",
        args: [address],
      },
      // 1: allowance(user, revShare) on $VT
      {
        abi: VEXOR_TOKEN_ABI,
        address: token,
        functionName: "allowance",
        args: [address, revShare],
      },
      // 2: user staked balance (RevShare.balanceOf)
      {
        abi: VEXOR_REV_SHARE_ABI,
        address: revShare,
        functionName: "balanceOf",
        args: [address],
      },
      // 3: pending claimable
      {
        abi: VEXOR_REV_SHARE_ABI,
        address: revShare,
        functionName: "pending",
        args: [address],
      },
      // 4: totalStaked
      {
        abi: VEXOR_REV_SHARE_ABI,
        address: revShare,
        functionName: "totalStaked",
      },
      // 5: accRewardPerToken
      {
        abi: VEXOR_REV_SHARE_ABI,
        address: revShare,
        functionName: "accRewardPerToken",
      },
      // 6: contract $VT balance (pool funds = staked + undistributed rewards)
      {
        abi: VEXOR_TOKEN_ABI,
        address: token,
        functionName: "balanceOf",
        args: [revShare],
      },
    ],
    query: { refetchInterval: 8_000 },
  });

  const walletBalance = reads.data?.[0]?.result as bigint | undefined;
  const allowance = reads.data?.[1]?.result as bigint | undefined;
  const userStake = reads.data?.[2]?.result as bigint | undefined;
  const claimable = reads.data?.[3]?.result as bigint | undefined;
  const totalStaked = reads.data?.[4]?.result as bigint | undefined;
  const accRewardPerToken = reads.data?.[5]?.result as bigint | undefined;
  const poolBalance = reads.data?.[6]?.result as bigint | undefined;

  const refetchReads = reads.refetch;
  useEffect(() => {
    if (isMined) refetchReads();
  }, [isMined, refetchReads]);

  const parsedAmount = useMemo(() => {
    try {
      if (!amount) return 0n;
      return parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  // Share of pool (post-stake projection)
  const sharePct = useMemo(() => {
    if (mode === "stake") {
      const future = (userStake ?? 0n) + parsedAmount;
      const futureTotal = (totalStaked ?? 0n) + parsedAmount;
      if (futureTotal === 0n) return null;
      return Number((future * 10000n) / futureTotal) / 100;
    }
    if (mode === "withdraw") {
      const future = (userStake ?? 0n) > parsedAmount ? (userStake ?? 0n) - parsedAmount : 0n;
      const futureTotal = (totalStaked ?? 0n) > parsedAmount ? (totalStaked ?? 0n) - parsedAmount : 0n;
      if (futureTotal === 0n) return 0;
      return Number((future * 10000n) / futureTotal) / 100;
    }
    if (!userStake || !totalStaked || totalStaked === 0n) return null;
    return Number((userStake * 10000n) / totalStaked) / 100;
  }, [mode, userStake, totalStaked, parsedAmount]);

  const needsApproval =
    mode === "stake" &&
    allowance !== undefined &&
    parsedAmount > 0n &&
    parsedAmount > allowance;

  const stakeDisabled =
    parsedAmount === 0n ||
    (walletBalance !== undefined && parsedAmount > walletBalance);
  const withdrawDisabled =
    parsedAmount === 0n ||
    (userStake !== undefined && parsedAmount > userStake);
  const claimDisabled = !claimable || claimable === 0n;

  return (
    <div className="space-y-6">
      {/* Pool stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total staked" value={fmt(totalStaked)} hint="$VT, pool-wide" />
        <Stat
          label="Pool $VT balance"
          value={fmt(poolBalance)}
          hint="staked + pending rewards"
        />
        <Stat
          label="acc Reward per token"
          value={fmt(accRewardPerToken)}
          hint="cumulative, /1e18"
        />
        <Stat
          label="Your share"
          value={sharePct !== null ? `${sharePct.toFixed(2)}%` : "—"}
          hint={mode === "claim" ? "current" : `if you ${mode}`}
        />
      </div>

      {/* User stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Wallet $VT" value={fmt(walletBalance)} hint="free, claimable" />
        <Stat label="Your stake" value={fmt(userStake)} hint="locked in pool" />
        <Stat
          label="Claimable rewards"
          value={fmt(claimable)}
          hint="updates on each pushRewards"
        />
      </div>

      {/* Mode tabs */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="grid grid-cols-3 gap-1 mb-5">
          <ModeButton
            active={mode === "stake"}
            onClick={() => setMode("stake")}
            icon={Layers}
            label="Stake"
          />
          <ModeButton
            active={mode === "withdraw"}
            onClick={() => setMode("withdraw")}
            icon={ArrowDownToLine}
            label="Withdraw"
          />
          <ModeButton
            active={mode === "claim"}
            onClick={() => setMode("claim")}
            icon={Gift}
            label="Claim"
          />
        </div>

        {mode === "claim" ? (
          <ClaimForm
            claimable={claimable}
            disabled={claimDisabled}
            loading={isPending || isMining}
            onClaim={() =>
              writeContract({
                abi: VEXOR_REV_SHARE_ABI,
                address: revShare,
                functionName: "claim",
              })
            }
          />
        ) : (
          <>
            <AmountInput
              amount={amount}
              setAmount={setAmount}
              maxValue={mode === "stake" ? walletBalance : userStake}
              symbol="$VT"
              label={mode === "stake" ? "Amount to stake" : "Amount to withdraw"}
            />
            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {mode === "stake" ? (
                needsApproval ? (
                  <PrimaryButton
                    onClick={() =>
                      writeContract({
                        abi: VEXOR_TOKEN_ABI,
                        address: token,
                        functionName: "approve",
                        args: [revShare, parsedAmount],
                      })
                    }
                    loading={isPending || isMining}
                    label={`1. Approve ${amount || "0"} $VT`}
                  />
                ) : (
                  <PrimaryButton
                    onClick={() =>
                      writeContract({
                        abi: VEXOR_REV_SHARE_ABI,
                        address: revShare,
                        functionName: "stake",
                        args: [parsedAmount],
                      })
                    }
                    loading={isPending || isMining}
                    label={`Stake ${amount || "0"} $VT`}
                    disabled={stakeDisabled}
                  />
                )
              ) : (
                <PrimaryButton
                  onClick={() =>
                    writeContract({
                      abi: VEXOR_REV_SHARE_ABI,
                      address: revShare,
                      functionName: "withdraw",
                      args: [parsedAmount],
                    })
                  }
                  loading={isPending || isMining}
                  label={`Withdraw ${amount || "0"} $VT`}
                  disabled={withdrawDisabled}
                />
              )}
              <div className="font-mono text-[10px] text-white/45">
                {mode === "stake"
                  ? `Allowance: ${fmt(allowance)} $VT`
                  : `Staked: ${fmt(userStake)} $VT`}
              </div>
            </div>
          </>
        )}
      </div>

      <HowItWorks />

      <TxReceipt
        txHash={txHash}
        isMining={isMining}
        isMined={isMined}
        onReset={reset}
      />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Coins;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-2.5 rounded-md border font-mono text-xs uppercase tracking-widest transition-colors ${
        active
          ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-200"
          : "border-white/10 bg-white/[0.02] text-white/55 hover:text-white"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AmountInput({
  amount,
  setAmount,
  maxValue,
  symbol,
  label,
}: {
  amount: string;
  setAmount: (v: string) => void;
  maxValue: bigint | undefined;
  symbol: string;
  label: string;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2.5">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="flex-1 bg-transparent font-mono text-white outline-none placeholder:text-white/30"
          placeholder="0"
        />
        <span className="font-mono text-[10px] text-white/45">{symbol}</span>
        <button
          onClick={() => maxValue && setAmount(formatUnits(maxValue, 18))}
          className="font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:text-cyan-200"
        >
          MAX
        </button>
      </div>
    </div>
  );
}

function ClaimForm({
  claimable,
  disabled,
  loading,
  onClaim,
}: {
  claimable: bigint | undefined;
  disabled: boolean;
  loading: boolean;
  onClaim: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
      <div className="flex-1">
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
          Reward available to claim
        </div>
        <div className="mt-1 font-mono text-3xl text-white">
          {fmt(claimable)}{" "}
          <span className="text-base text-white/55">$VT</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-white/40">
          Auto-updates as the owner pushes more rewards into the pool.
        </div>
      </div>
      <PrimaryButton
        onClick={onClaim}
        loading={loading}
        disabled={disabled}
        label={disabled ? "Nothing to claim" : "Claim rewards"}
      />
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.01] p-5 text-xs text-white/55 leading-relaxed">
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/45 mb-2">
        How it works
      </div>
      <ol className="list-decimal pl-5 space-y-1.5">
        <li>
          <span className="text-white/80">Stake</span> — approve $VT spending,
          then deposit any amount. Your stake earns a pro-rata share of every
          future reward push, based on{" "}
          <span className="font-mono text-cyan-300">
            your_stake / totalStaked
          </span>
          .
        </li>
        <li>
          <span className="text-white/80">Wait for rewards</span> — the contract
          owner pushes $VT periodically via{" "}
          <span className="font-mono text-cyan-300">pushRewards(amount)</span>.
          The pool&apos;s{" "}
          <span className="font-mono text-cyan-300">accRewardPerToken</span>{" "}
          jumps instantly; every staker&apos;s claimable balance updates in the
          same block.
        </li>
        <li>
          <span className="text-white/80">Claim</span> anytime — pulls your
          accumulated rewards to your wallet. Doesn&apos;t touch your stake.
        </li>
        <li>
          <span className="text-white/80">Withdraw</span> anytime — flat
          staking, zero lock. You can pull stake out and re-deposit later
          without penalty.
        </li>
      </ol>
    </div>
  );
}

// =============================================================================
// Shared primitives (local — kept self-contained to avoid touching Console.tsx)
// =============================================================================

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl text-white truncate">{value}</div>
      {hint && <div className="font-mono text-[10px] text-white/35">{hint}</div>}
    </div>
  );
}

function PrimaryButton({
  onClick,
  loading,
  label,
  disabled,
}: {
  onClick: () => void;
  loading?: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-cyan-300/40 bg-cyan-300/10 text-cyan-200 font-mono text-xs uppercase tracking-widest hover:bg-cyan-300/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </button>
  );
}

function ContractLink({ label, addr }: { label: string; addr: Address }) {
  return (
    <a
      href={explorerAddr(addr)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-white/20 transition-colors group"
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </span>
      <span className="font-mono text-xs text-white/70 group-hover:text-cyan-300">
        {addr.slice(0, 6)}…{addr.slice(-4)}{" "}
        <ExternalLink className="inline h-3 w-3" />
      </span>
    </a>
  );
}

function TxReceipt({
  txHash,
  isMining,
  isMined,
  onReset,
}: {
  txHash: Hex | undefined;
  isMining: boolean;
  isMined: boolean;
  onReset: () => void;
}) {
  if (!txHash) return null;
  return (
    <div
      className={`rounded-md border px-3 py-2 font-mono text-[11px] flex items-center justify-between ${
        isMined
          ? "border-emerald-300/30 bg-emerald-300/[0.05] text-emerald-200"
          : "border-cyan-300/30 bg-cyan-300/[0.05] text-cyan-200"
      }`}
    >
      <span>
        {isMined ? "✓ Confirmed" : isMining ? "Pending…" : "Submitted"} —{" "}
        <a
          href={explorerTx(txHash)}
          target="_blank"
          rel="noreferrer"
          className="underline hover:no-underline"
        >
          {txHash.slice(0, 10)}…{txHash.slice(-6)}
          <ExternalLink className="inline h-2.5 w-2.5 ml-0.5" />
        </a>
      </span>
      <button
        onClick={onReset}
        className="text-white/40 hover:text-white/60 text-[10px] uppercase tracking-widest"
      >
        dismiss
      </button>
    </div>
  );
}
