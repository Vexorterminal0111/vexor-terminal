"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  formatUnits,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
  useBlockNumber,
  useBalance,
  usePublicClient,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  Coins,
  Lock,
  Vote,
  Sparkles,
  Loader2,
  Droplets,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { WalletButton } from "./WalletButton";
import {
  getContracts,
  isTestnet,
  LOCK_TIERS,
  PROPOSAL_STATES,
  VEXOR_GOVERNOR_ABI,
  VEXOR_STAKING_ABI,
  VEXOR_TOKEN_ABI,
} from "@/lib/contracts";

type TabKey = "wallet" | "stake" | "govern" | "tier";

const TABS: { key: TabKey; label: string; icon: typeof Coins }[] = [
  { key: "wallet", label: "Wallet", icon: Coins },
  { key: "stake", label: "Stake", icon: Lock },
  { key: "govern", label: "Govern", icon: Vote },
  { key: "tier", label: "Tier", icon: Sparkles },
];

const TIER_LADDER = [
  { name: "Bronze", threshold: 1_000, color: "text-amber-300", note: "Priority chat slot" },
  { name: "Silver", threshold: 10_000, color: "text-slate-200", note: "Private channels" },
  { name: "Gold", threshold: 100_000, color: "text-yellow-300", note: "Beta sub-agents" },
  { name: "Black", threshold: 1_000_000, color: "text-cyan-300", note: "Revenue dashboard" },
];

function explorerTx(chainId: number, hash: string) {
  return chainId === baseSepolia.id
    ? `https://sepolia.basescan.org/tx/${hash}`
    : `https://basescan.org/tx/${hash}`;
}

function explorerAddr(chainId: number, addr: string) {
  return chainId === baseSepolia.id
    ? `https://sepolia.basescan.org/address/${addr}`
    : `https://basescan.org/address/${addr}`;
}

function fmt(n: bigint | undefined, decimals = 18, max = 4): string {
  if (n === undefined) return "—";
  const s = formatUnits(n, decimals);
  const [whole, frac] = s.split(".");
  if (!frac) return whole;
  return `${whole}.${frac.slice(0, max).replace(/0+$/, "") || "0"}`;
}

export function Console() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onTestnet = isTestnet(chainId);
  const { token, staking, governance } = getContracts(chainId);
  const [tab, setTab] = useState<TabKey>("wallet");

  return (
    <section id="console" className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Live on testnet"
          title="$VEXOR Console — claim, stake, govern."
          description="Wallet-gated terminal connected to live Vexor contracts on Base Sepolia. Claim testnet $VEXOR from the faucet, stake with a lock multiplier, propose & vote — every action is a real on-chain transaction."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-10 sm:mt-12 overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur"
        >
          {/* Terminal header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3 sm:px-4 py-2 sm:py-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-red-400/70 shrink-0" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-yellow-400/70 shrink-0" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400/70 shrink-0" />
              <span className="ml-2 sm:ml-3 font-mono text-[10px] sm:text-[11px] text-white/60 truncate">
                vexor@console — {onTestnet ? "base-sepolia" : chainId ? "base" : "disconnected"}
              </span>
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/40 shrink-0 ml-2">
              {isConnected ? "AUTH OK" : "AUTH PENDING"}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 font-mono text-[11px] sm:text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
                    active
                      ? "text-cyan-300 border-b border-cyan-300 bg-cyan-300/[0.05]"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 lg:p-8 min-h-[460px]">
            {!isConnected ? (
              <ConnectGate />
            ) : !onTestnet ? (
              <WrongChainGate />
            ) : !token || !staking || !governance ? (
              <NoContractsGate />
            ) : (
              <>
                {tab === "wallet" && (
                  <WalletPanel
                    address={address!}
                    token={token}
                    chainId={chainId}
                  />
                )}
                {tab === "stake" && (
                  <StakePanel
                    address={address!}
                    token={token}
                    staking={staking}
                    chainId={chainId}
                  />
                )}
                {tab === "govern" && (
                  <GovernPanel
                    address={address!}
                    token={token}
                    governor={governance}
                    chainId={chainId}
                  />
                )}
                {tab === "tier" && (
                  <TierPanel
                    address={address!}
                    token={token}
                    chainId={chainId}
                  />
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Contract addresses footer */}
        {token && staking && governance && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <ContractLink label="Token" addr={token} chainId={chainId} />
            <ContractLink label="Staking" addr={staking} chainId={chainId} />
            <ContractLink label="Governor" addr={governance} chainId={chainId} />
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
        <span className="text-cyan-300">vexor@console:~$</span> auth --required
      </div>
      <div className="mt-4 font-mono text-base text-white">
        Connect your wallet to access the console.
      </div>
      <div className="mt-1 text-xs text-white/50">
        Live on Base Sepolia. Testnet ETH required for transactions.
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
      <div className="mt-3 font-mono text-base text-white">
        Wrong network.
      </div>
      <div className="mt-1 max-w-md text-xs text-white/55">
        The Vexor Console is currently deployed on Base Sepolia testnet. Switch
        networks to continue.
      </div>
      <button
        onClick={() => switchChain({ chainId: baseSepolia.id })}
        className="mt-5 px-4 py-2 rounded-md border border-cyan-300/40 bg-cyan-300/10 text-cyan-200 font-mono text-xs uppercase tracking-widest hover:bg-cyan-300/20 transition-colors"
      >
        Switch to Base Sepolia
      </button>
    </div>
  );
}

function NoContractsGate() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="font-mono text-sm text-white/55">
        Contracts not configured for this network.
      </div>
    </div>
  );
}

// =============================================================================
// Wallet panel — balance + faucet + delegate
// =============================================================================

function WalletPanel({
  address,
  token,
  chainId,
}: {
  address: Address;
  token: Address;
  chainId: number;
}) {
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: ethBalance } = useBalance({ address });
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const reads = useReadContracts({
    contracts: [
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "balanceOf", args: [address] },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "totalSupply" },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "hasClaimed", args: [address] },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "FAUCET_AMOUNT" },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "delegates", args: [address] },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "getVotes", args: [address] },
    ],
    query: { refetchInterval: 8_000 },
  });

  useEffect(() => {
    if (isMined) reads.refetch();
  }, [isMined, reads, blockNumber]);

  const balance = reads.data?.[0]?.result as bigint | undefined;
  const supply = reads.data?.[1]?.result as bigint | undefined;
  const hasClaimed = reads.data?.[2]?.result as boolean | undefined;
  const faucetAmount = reads.data?.[3]?.result as bigint | undefined;
  const delegatee = reads.data?.[4]?.result as Address | undefined;
  const votes = reads.data?.[5]?.result as bigint | undefined;
  const isSelfDelegated = delegatee?.toLowerCase() === address.toLowerCase();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="$VEXOR balance" value={fmt(balance)} hint="balanceOf" />
        <Stat label="Voting power" value={fmt(votes)} hint="getVotes" />
        <Stat
          label="ETH (gas)"
          value={ethBalance ? fmt(ethBalance.value, ethBalance.decimals, 4) : "—"}
          hint={ethBalance?.symbol ?? ""}
        />
        <Stat label="Total supply" value={fmt(supply)} hint="totalSupply" />
      </div>

      {/* Faucet card */}
      <Panel
        icon={Droplets}
        title="Testnet faucet"
        body={
          hasClaimed
            ? "You've already claimed your one-time 1,000 $VEXOR drop. Use the Stake or Govern tabs to put it to work."
            : "Claim a one-time drop of 1,000 $VEXOR. Free, on-chain, no signup."
        }
        action={
          hasClaimed ? (
            <Tag>
              <CheckCircle2 className="h-3 w-3" /> Claimed
            </Tag>
          ) : (
            <PrimaryButton
              onClick={() =>
                writeContract({
                  abi: VEXOR_TOKEN_ABI,
                  address: token,
                  functionName: "claim",
                })
              }
              loading={isPending || isMining}
              label={
                faucetAmount
                  ? `Claim ${fmt(faucetAmount, 18, 0)} $VEXOR`
                  : "Claim 1,000 $VEXOR"
              }
            />
          )
        }
      />

      {/* Delegate card — required before voting */}
      <Panel
        icon={Vote}
        title="Activate voting power"
        body={
          isSelfDelegated
            ? "Voting power active — your $VEXOR balance is delegated to yourself."
            : "ERC20Votes requires explicit delegation. Self-delegate to use your balance as voting power."
        }
        action={
          isSelfDelegated ? (
            <Tag>
              <CheckCircle2 className="h-3 w-3" /> Active
            </Tag>
          ) : (
            <PrimaryButton
              onClick={() =>
                writeContract({
                  abi: VEXOR_TOKEN_ABI,
                  address: token,
                  functionName: "delegate",
                  args: [address],
                })
              }
              loading={isPending || isMining}
              label="Self-delegate"
            />
          )
        }
      />

      <TxReceipt txHash={txHash} isMining={isMining} isMined={isMined} chainId={chainId} onReset={reset} />
    </div>
  );
}

// =============================================================================
// Stake panel
// =============================================================================

function StakePanel({
  address,
  token,
  staking,
  chainId,
}: {
  address: Address;
  token: Address;
  staking: Address;
  chainId: number;
}) {
  const [amount, setAmount] = useState("100");
  const [tier, setTier] = useState<number>(0);
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const reads = useReadContracts({
    contracts: [
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "balanceOf", args: [address] },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "allowance", args: [address, staking] },
      { abi: VEXOR_STAKING_ABI, address: staking, functionName: "positionCountOf", args: [address] },
      { abi: VEXOR_STAKING_ABI, address: staking, functionName: "rewardRatePerSecond" },
      { abi: VEXOR_STAKING_ABI, address: staking, functionName: "totalWeighted" },
    ],
    query: { refetchInterval: 8_000 },
  });

  const balance = reads.data?.[0]?.result as bigint | undefined;
  const allowance = reads.data?.[1]?.result as bigint | undefined;
  const posCount = reads.data?.[2]?.result as bigint | undefined;
  const rewardRate = reads.data?.[3]?.result as bigint | undefined;
  const totalWeighted = reads.data?.[4]?.result as bigint | undefined;

  useEffect(() => {
    if (isMined) reads.refetch();
  }, [isMined, reads]);

  const parsedAmount = useMemo(() => {
    try {
      if (!amount) return 0n;
      return parseUnits(amount, 18);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = allowance !== undefined && parsedAmount > allowance;

  // Estimate annualized reward for this position assuming static totalWeighted
  const aprDisplay = useMemo(() => {
    if (!rewardRate || !totalWeighted || totalWeighted === 0n || parsedAmount === 0n) return null;
    const multBps = BigInt(
      tier === 0 ? 10000 : tier === 1 ? 15000 : tier === 2 ? 20000 : 30000,
    );
    const weighted = (parsedAmount * multBps) / 10000n;
    // Approximate share of next-second emission * seconds-per-year / principal
    const yearlyRewardForPos = (rewardRate * weighted * BigInt(31_536_000)) /
      (totalWeighted + weighted);
    if (parsedAmount === 0n) return null;
    // APR in % = yearlyReward / principal * 100
    const apr = Number(formatUnits(yearlyRewardForPos, 18)) /
      Number(formatUnits(parsedAmount, 18));
    if (!Number.isFinite(apr)) return null;
    return (apr * 100).toFixed(1) + "%";
  }, [rewardRate, totalWeighted, parsedAmount, tier]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Your balance" value={fmt(balance)} hint="$VEXOR" />
        <Stat label="Open positions" value={posCount?.toString() ?? "0"} hint="NFT-like" />
        <Stat label="Pool weighted" value={fmt(totalWeighted)} hint="totalWeighted" />
        <Stat
          label="Est. APR (this stake)"
          value={aprDisplay ?? "—"}
          hint={`tier ${LOCK_TIERS[tier].label}`}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="font-mono text-xs uppercase tracking-widest text-white/45 mb-3">
          New stake
        </div>
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <div className="flex-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-white/45">
              Amount ($VEXOR)
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-2.5">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="flex-1 bg-transparent font-mono text-white outline-none placeholder:text-white/30"
                placeholder="100"
              />
              <button
                onClick={() => balance && setAmount(formatUnits(balance, 18))}
                className="font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:text-cyan-200"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-white/45">
              Lock period
            </label>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {LOCK_TIERS.map((t, i) => (
                <button
                  key={t.value}
                  onClick={() => setTier(i)}
                  className={`px-2 py-2 rounded-md border font-mono text-[10px] transition-colors ${
                    tier === i
                      ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-200"
                      : "border-white/10 bg-white/[0.02] text-white/55 hover:text-white"
                  }`}
                >
                  <div className="uppercase tracking-widest">{t.label}</div>
                  <div className="text-cyan-300/80">{t.multiplier}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {needsApproval ? (
            <PrimaryButton
              onClick={() =>
                writeContract({
                  abi: VEXOR_TOKEN_ABI,
                  address: token,
                  functionName: "approve",
                  args: [staking, parsedAmount],
                })
              }
              loading={isPending || isMining}
              label={`1. Approve ${amount || "0"} $VEXOR`}
            />
          ) : (
            <PrimaryButton
              onClick={() =>
                writeContract({
                  abi: VEXOR_STAKING_ABI,
                  address: staking,
                  functionName: "stake",
                  args: [parsedAmount, tier],
                })
              }
              loading={isPending || isMining}
              label={`Stake ${amount || "0"} $VEXOR · ${LOCK_TIERS[tier].label}`}
              disabled={parsedAmount === 0n || (balance !== undefined && parsedAmount > balance)}
            />
          )}
          <div className="font-mono text-[10px] text-white/45">
            Allowance: {fmt(allowance)} $VEXOR
          </div>
        </div>
      </div>

      <PositionsList
        address={address}
        staking={staking}
        chainId={chainId}
        posCount={posCount}
        onTxQueued={() => {}}
      />

      <TxReceipt txHash={txHash} isMining={isMining} isMined={isMined} chainId={chainId} onReset={reset} />
    </div>
  );
}

function PositionsList({
  address,
  staking,
  chainId,
  posCount,
}: {
  address: Address;
  staking: Address;
  chainId: number;
  posCount: bigint | undefined;
  onTxQueued: () => void;
}) {
  const count = posCount ? Number(posCount) : 0;
  const indexCalls = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        abi: VEXOR_STAKING_ABI,
        address: staking,
        functionName: "positionIdAt" as const,
        args: [address, BigInt(i)] as const,
      })),
    [count, staking, address],
  );

  const idsRes = useReadContracts({
    contracts: indexCalls,
    query: { enabled: count > 0 },
  });

  const ids = (idsRes.data ?? [])
    .map((r) => r.result as bigint | undefined)
    .filter((v): v is bigint => typeof v === "bigint");

  if (count === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-5 font-mono text-xs text-white/45">
        No positions yet. Stake $VEXOR above to open one.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="font-mono text-xs uppercase tracking-widest text-white/45">
        Your positions ({count})
      </div>
      {ids.map((id) => (
        <PositionRow
          key={id.toString()}
          id={id}
          staking={staking}
          chainId={chainId}
        />
      ))}
    </div>
  );
}

function PositionRow({
  id,
  staking,
  chainId,
}: {
  id: bigint;
  staking: Address;
  chainId: number;
}) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining } = useWaitForTransactionReceipt({ hash: txHash });

  const pos = useReadContract({
    abi: VEXOR_STAKING_ABI,
    address: staking,
    functionName: "positions",
    args: [id],
    query: { refetchInterval: 8_000 },
  });
  const pending = useReadContract({
    abi: VEXOR_STAKING_ABI,
    address: staking,
    functionName: "pending",
    args: [id],
    query: { refetchInterval: 5_000 },
  });

  const raw = pos.data as readonly [bigint, bigint, bigint, bigint, number, bigint] | undefined;
  if (!raw) return null;
  const [amount, , , unlock, tier] = raw;
  if (amount === 0n) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const isUnlocked = Number(unlock) <= now;
  const remaining = isUnlocked ? 0 : Number(unlock) - now;
  const remainingLabel =
    remaining > 86400
      ? `${Math.floor(remaining / 86400)}d ${Math.floor((remaining % 86400) / 3600)}h`
      : `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 items-center">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Position #{id.toString()}</div>
        <div className="font-mono text-sm text-white">{fmt(amount)} $VEXOR</div>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Tier</div>
        <div className="font-mono text-sm text-cyan-200">{LOCK_TIERS[tier as 0|1|2|3].label}</div>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Unlocks</div>
        <div className="font-mono text-sm text-white">
          {isUnlocked ? <span className="text-emerald-300">unlocked</span> : <>in {remainingLabel}</>}
        </div>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Pending</div>
        <div className="font-mono text-sm text-white">
          {fmt(pending.data as bigint | undefined, 18, 4)} $VEXOR
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() =>
            writeContract({
              abi: VEXOR_STAKING_ABI,
              address: staking,
              functionName: "claim",
              args: [id],
            })
          }
          disabled={isPending || isMining}
          className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.04] text-xs font-mono text-white/80 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
        >
          {isPending || isMining ? <Loader2 className="h-3 w-3 animate-spin" /> : "Claim"}
        </button>
        <button
          onClick={() =>
            writeContract({
              abi: VEXOR_STAKING_ABI,
              address: staking,
              functionName: "withdraw",
              args: [id],
            })
          }
          disabled={!isUnlocked || isPending || isMining}
          className="px-3 py-1.5 rounded-md border border-cyan-300/30 bg-cyan-300/10 text-xs font-mono text-cyan-200 hover:bg-cyan-300/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Withdraw
        </button>
      </div>
      {txHash && (
        <div className="col-span-full font-mono text-[10px] text-white/45">
          tx{" "}
          <a
            href={explorerTx(chainId, txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 hover:text-cyan-200"
          >
            {txHash.slice(0, 10)}…
            <ExternalLink className="inline h-2.5 w-2.5 ml-0.5" />
          </a>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Govern panel
// =============================================================================

type GovProposal = {
  id: bigint;
  proposer: Address;
  description: string;
  voteStart: bigint;
  voteEnd: bigint;
  targets: readonly Address[];
  values: readonly bigint[];
  calldatas: readonly Hex[];
};

function GovernPanel({
  address,
  token,
  governor,
  chainId,
}: {
  address: Address;
  token: Address;
  governor: Address;
  chainId: number;
}) {
  const [desc, setDesc] = useState("");
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const publicClient = usePublicClient();

  const reads = useReadContracts({
    contracts: [
      { abi: VEXOR_GOVERNOR_ABI, address: governor, functionName: "proposalThreshold" },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "getVotes", args: [address] },
      { abi: VEXOR_TOKEN_ABI, address: token, functionName: "delegates", args: [address] },
    ],
    query: { refetchInterval: 10_000 },
  });
  const threshold = reads.data?.[0]?.result as bigint | undefined;
  const votes = reads.data?.[1]?.result as bigint | undefined;
  const delegatee = reads.data?.[2]?.result as Address | undefined;
  const isSelfDelegated = delegatee?.toLowerCase() === address.toLowerCase();
  const canPropose = votes !== undefined && threshold !== undefined && votes >= threshold;

  const [proposals, setProposals] = useState<GovProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    setLoadingProposals(true);
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        // Look back ~50k blocks (~28h on Base 2s blocks); enough for testnet demo.
        const from = latest > 50_000n ? latest - 50_000n : 0n;
        const logs = await publicClient.getContractEvents({
          abi: VEXOR_GOVERNOR_ABI,
          address: governor,
          eventName: "ProposalCreated",
          fromBlock: from,
          toBlock: latest,
        });
        const ps: GovProposal[] = logs.map((l) => {
          const a = (l as { args: Record<string, unknown> }).args;
          return {
            id: a.proposalId as bigint,
            proposer: a.proposer as Address,
            description: (a.description as string) || "(no description)",
            voteStart: a.voteStart as bigint,
            voteEnd: a.voteEnd as bigint,
            targets: a.targets as readonly Address[],
            values: a.values as readonly bigint[],
            calldatas: a.calldatas as readonly Hex[],
          };
        });
        if (!cancelled) setProposals(ps.reverse());
      } finally {
        if (!cancelled) setLoadingProposals(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, governor, isMined]);

  function createProposal() {
    if (!desc.trim()) return;
    // Simple proposal: no-op call to token totalSupply (read-only function, harmless)
    const targets = [token];
    const values = [0n];
    const calldatas = ["0x18160ddd" as Hex]; // totalSupply()
    writeContract({
      abi: VEXOR_GOVERNOR_ABI,
      address: governor,
      functionName: "propose",
      args: [targets, values, calldatas, desc],
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Your voting power" value={fmt(votes)} hint="getVotes" />
        <Stat label="Proposal threshold" value={fmt(threshold)} hint="100 $VEXOR" />
        <Stat
          label="Delegated"
          value={isSelfDelegated ? "yes" : "no"}
          hint={isSelfDelegated ? "self" : "required to vote"}
        />
      </div>

      {!isSelfDelegated && (
        <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.05] p-4 text-sm text-amber-100/80">
          You need to self-delegate before you can vote. Go to the{" "}
          <span className="font-mono text-amber-200">Wallet</span> tab and click
          "Self-delegate".
        </div>
      )}

      {/* Create proposal */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="font-mono text-xs uppercase tracking-widest text-white/45 mb-3">
          New proposal
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Describe your proposal — e.g. 'Enable Halo sub-agent for all tier-1 holders.'"
          className="w-full min-h-[80px] rounded-md border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-white/30"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="font-mono text-[10px] text-white/45">
            {canPropose
              ? "You meet the threshold and can propose."
              : `Need ${fmt(threshold)} voting power. You have ${fmt(votes)}.`}
          </div>
          <PrimaryButton
            onClick={createProposal}
            loading={isPending || isMining}
            label="Submit proposal"
            disabled={!desc.trim() || !canPropose}
          />
        </div>
      </div>

      {/* Active proposals */}
      <div className="space-y-3">
        <div className="font-mono text-xs uppercase tracking-widest text-white/45">
          Proposals {loadingProposals && <span className="text-white/30">(loading…)</span>}
        </div>
        {proposals.length === 0 && !loadingProposals ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-5 font-mono text-xs text-white/45">
            No proposals yet. Submit one above to kick off governance.
          </div>
        ) : (
          proposals.map((p) => (
            <ProposalRow
              key={p.id.toString()}
              p={p}
              governor={governor}
              chainId={chainId}
            />
          ))
        )}
      </div>

      <TxReceipt txHash={txHash} isMining={isMining} isMined={isMined} chainId={chainId} onReset={reset} />
    </div>
  );
}

function ProposalRow({
  p,
  governor,
  chainId,
}: {
  p: GovProposal;
  governor: Address;
  chainId: number;
}) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining } = useWaitForTransactionReceipt({ hash: txHash });

  const reads = useReadContracts({
    contracts: [
      { abi: VEXOR_GOVERNOR_ABI, address: governor, functionName: "state", args: [p.id] },
      { abi: VEXOR_GOVERNOR_ABI, address: governor, functionName: "proposalVotes", args: [p.id] },
    ],
    query: { refetchInterval: 8_000 },
  });
  const state = reads.data?.[0]?.result as number | undefined;
  const votes = reads.data?.[1]?.result as readonly [bigint, bigint, bigint] | undefined;
  const stateName = state !== undefined ? PROPOSAL_STATES[state] : "?";
  const isActive = state === 1;
  const totalCast = votes ? votes[0] + votes[1] + votes[2] : 0n;
  const forPct = votes && totalCast > 0n ? Number((votes[1] * 100n) / totalCast) : 0;

  function vote(support: 0 | 1 | 2) {
    writeContract({
      abi: VEXOR_GOVERNOR_ABI,
      address: governor,
      functionName: "castVote",
      args: [p.id, support],
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${
                isActive
                  ? "bg-emerald-300/10 text-emerald-300 border border-emerald-300/30"
                  : state === 4
                    ? "bg-cyan-300/10 text-cyan-300 border border-cyan-300/30"
                    : "bg-white/[0.04] text-white/55 border border-white/10"
              }`}
            >
              {stateName}
            </span>
            <span className="font-mono text-[10px] text-white/40">
              by {p.proposer.slice(0, 6)}…{p.proposer.slice(-4)}
            </span>
          </div>
          <div className="font-mono text-sm text-white whitespace-pre-wrap">
            {p.description}
          </div>
        </div>
        {isActive && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => vote(1)}
              disabled={isPending || isMining}
              className="px-3 py-1.5 rounded-md border border-emerald-300/30 bg-emerald-300/10 text-xs font-mono text-emerald-200 hover:bg-emerald-300/20 disabled:opacity-50 transition-colors"
            >
              For
            </button>
            <button
              onClick={() => vote(0)}
              disabled={isPending || isMining}
              className="px-3 py-1.5 rounded-md border border-rose-300/30 bg-rose-300/10 text-xs font-mono text-rose-200 hover:bg-rose-300/20 disabled:opacity-50 transition-colors"
            >
              Against
            </button>
            <button
              onClick={() => vote(2)}
              disabled={isPending || isMining}
              className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.04] text-xs font-mono text-white/70 hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
            >
              Abstain
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-[11px]">
        <div>
          <span className="text-emerald-300">For</span> {fmt(votes?.[1])}
        </div>
        <div>
          <span className="text-rose-300">Against</span> {fmt(votes?.[0])}
        </div>
        <div>
          <span className="text-white/55">Abstain</span> {fmt(votes?.[2])}
        </div>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-white/[0.04] overflow-hidden">
        <div className="h-full bg-emerald-300/70" style={{ width: `${forPct}%` }} />
      </div>
      {txHash && (
        <div className="mt-2 font-mono text-[10px] text-white/45">
          tx{" "}
          <a
            href={explorerTx(chainId, txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 hover:text-cyan-200"
          >
            {txHash.slice(0, 10)}…
            <ExternalLink className="inline h-2.5 w-2.5 ml-0.5" />
          </a>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tier panel
// =============================================================================

function TierPanel({
  address,
  token,
}: {
  address: Address;
  token: Address;
  chainId: number;
}) {
  const balance = useReadContract({
    abi: VEXOR_TOKEN_ABI,
    address: token,
    functionName: "balanceOf",
    args: [address],
    query: { refetchInterval: 8_000 },
  });
  const raw = balance.data as bigint | undefined;
  const tokens = raw ? Number(formatUnits(raw, 18)) : 0;

  const current = [...TIER_LADDER].reverse().find((t) => tokens >= t.threshold);
  const next = TIER_LADDER.find((t) => tokens < t.threshold);
  const progress = next
    ? Math.min(100, (tokens / next.threshold) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/[0.06] via-white/[0.02] to-transparent p-6">
        <div className="font-mono text-xs uppercase tracking-widest text-cyan-300/80">
          Your tier
        </div>
        <div className={`mt-2 font-mono text-4xl ${current?.color ?? "text-white/55"}`}>
          {current?.name ?? "—"}
        </div>
        <div className="mt-1 font-mono text-xs text-white/55">
          {current?.note ?? "Acquire 1,000 $VEXOR to reach Bronze."}
        </div>
        {next && (
          <div className="mt-5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-white/45">
              <span>{tokens.toFixed(2)} / {next.threshold.toLocaleString()} $VEXOR</span>
              <span className={next.color}>Next: {next.name}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full bg-cyan-300/70" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TIER_LADDER.map((t) => {
          const unlocked = tokens >= t.threshold;
          return (
            <div
              key={t.name}
              className={`rounded-xl border p-4 ${
                unlocked
                  ? "border-cyan-300/30 bg-cyan-300/[0.04]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className={`font-mono text-sm ${t.color}`}>{t.name}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/45">
                ≥ {t.threshold.toLocaleString()} $VEXOR
              </div>
              <div className="mt-2 text-xs text-white/60">{t.note}</div>
              <div className="mt-2 font-mono text-[10px] text-white/45">
                {unlocked ? <span className="text-emerald-300">unlocked</span> : "locked"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Shared primitives
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
      {hint && (
        <div className="font-mono text-[10px] text-white/35">{hint}</div>
      )}
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Coins;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start gap-3 flex-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cyan-300 shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="font-mono text-sm text-white">{title}</div>
          <div className="mt-1 text-xs text-white/55">{body}</div>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-300 font-mono text-[10px] uppercase tracking-widest">
      {children}
    </span>
  );
}

function ContractLink({
  label,
  addr,
  chainId,
}: {
  label: string;
  addr: Address;
  chainId: number;
}) {
  return (
    <a
      href={explorerAddr(chainId, addr)}
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
  chainId,
  onReset,
}: {
  txHash: Hex | undefined;
  isMining: boolean;
  isMined: boolean;
  chainId: number;
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
          href={explorerTx(chainId, txHash)}
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
