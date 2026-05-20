"use client";

import { useCallback, useEffect, useState } from "react";
import {
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WalletButton } from "@/components/WalletButton";
import {
  VEXOR_GOVERNOR_ABI,
  VEXOR_TOKEN_ABI,
  getContracts,
} from "@/lib/contracts";

const BASESCAN_TESTNET = "https://sepolia.basescan.org";

// OZ Governor ProposalState enum
const STATE_LABELS = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
] as const;
type ProposalState = (typeof STATE_LABELS)[number];

const STATE_COLORS: Record<ProposalState, string> = {
  Pending: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  Active: "bg-cyan-500/15 text-cyan-200 border-cyan-400/40",
  Canceled: "bg-white/5 text-white/40 border-white/10",
  Defeated: "bg-red-500/10 text-red-300 border-red-500/30",
  Succeeded: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  Queued: "bg-purple-500/15 text-purple-200 border-purple-500/30",
  Expired: "bg-white/5 text-white/40 border-white/10",
  Executed: "bg-emerald-500/20 text-emerald-100 border-emerald-400/40",
};

// Block range to scan for ProposalCreated. Base Sepolia ~2s blocks, this is
// ~12 days of history. Plenty for a testnet demo.
const PROPOSAL_LOOKBACK_BLOCKS = 500_000n;
const LOG_CHUNK_SIZE = 9_000n;

interface ProposalLog {
  id: bigint;
  proposer: Address;
  targets: readonly Address[];
  values: readonly bigint[];
  calldatas: readonly Hex[];
  voteStart: bigint;
  voteEnd: bigint;
  description: string;
  blockNumber: bigint;
  transactionHash: Hex;
}

function truncAddr(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function fmtVexor(raw: bigint | undefined): string {
  if (raw === undefined) return "—";
  const num = Number(raw / 10n ** 14n) / 10000;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(4);
}

function titleOf(description: string): string {
  const firstLine = description.split("\n", 1)[0]?.trim() ?? "";
  if (firstLine.startsWith("# ")) return firstLine.slice(2).trim();
  return firstLine || "(no title)";
}

export function Governance() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const onSepolia = chainId === baseSepolia.id;

  const { token, governance } = getContracts(baseSepolia.id);
  const governor = governance;

  const [proposals, setProposals] = useState<ProposalLog[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposalDescription, setProposalDescription] = useState("");

  // ----- governor stats -----
  const stats = useReadContracts({
    contracts:
      governor !== null
        ? [
            { address: governor, abi: VEXOR_GOVERNOR_ABI, functionName: "votingDelay" },
            { address: governor, abi: VEXOR_GOVERNOR_ABI, functionName: "votingPeriod" },
            { address: governor, abi: VEXOR_GOVERNOR_ABI, functionName: "proposalThreshold" },
          ]
        : [],
    query: { enabled: !!governor && onSepolia },
  });
  const votingDelay = stats.data?.[0]?.result as bigint | undefined;
  const votingPeriod = stats.data?.[1]?.result as bigint | undefined;
  const proposalThreshold = stats.data?.[2]?.result as bigint | undefined;

  // ----- user voting power + delegation -----
  const userInfo = useReadContracts({
    contracts:
      token !== null && address
        ? [
            { address: token, abi: VEXOR_TOKEN_ABI, functionName: "getVotes", args: [address] },
            { address: token, abi: VEXOR_TOKEN_ABI, functionName: "delegates", args: [address] },
            { address: token, abi: VEXOR_TOKEN_ABI, functionName: "balanceOf", args: [address] },
          ]
        : [],
    query: { enabled: !!token && !!address && onSepolia },
  });
  const userVotes = userInfo.data?.[0]?.result as bigint | undefined;
  const userDelegate = userInfo.data?.[1]?.result as Address | undefined;
  const userBalance = userInfo.data?.[2]?.result as bigint | undefined;
  const hasDelegatedToSelf =
    userDelegate !== undefined &&
    address !== undefined &&
    userDelegate.toLowerCase() === address.toLowerCase();

  // ----- write contract -----
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();
  const { isLoading: isMining, isSuccess: txMined } =
    useWaitForTransactionReceipt({ hash: txHash });

  // ----- fetch proposals via eth_getLogs -----
  const fetchProposals = useCallback(async () => {
    if (!publicClient || !governor) return;
    setProposalsLoading(true);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock =
        currentBlock > PROPOSAL_LOOKBACK_BLOCKS
          ? currentBlock - PROPOSAL_LOOKBACK_BLOCKS
          : 0n;

      const event = VEXOR_GOVERNOR_ABI.find(
        (i) => i.type === "event" && i.name === "ProposalCreated",
      );
      if (!event) throw new Error("ProposalCreated event missing in ABI");

      const ranges: { from: bigint; to: bigint }[] = [];
      for (let to = currentBlock; to > fromBlock; to -= LOG_CHUNK_SIZE) {
        const from =
          to - LOG_CHUNK_SIZE + 1n > fromBlock
            ? to - LOG_CHUNK_SIZE + 1n
            : fromBlock;
        ranges.push({ from, to });
      }

      type RawLog = {
        blockNumber: bigint;
        transactionHash: Hex;
        args: Record<string, unknown>;
      };

      const all: ProposalLog[] = [];
      for (const r of ranges) {
        const logs = (await publicClient
          .getLogs({
            address: governor,
            event: event as never,
            fromBlock: r.from,
            toBlock: r.to,
          })
          .catch(() => [])) as unknown as RawLog[];
        for (const log of logs) {
          const args = log.args;
          all.push({
            id: args.proposalId as bigint,
            proposer: args.proposer as Address,
            targets: args.targets as readonly Address[],
            values: args.values as readonly bigint[],
            calldatas: args.calldatas as readonly Hex[],
            voteStart: args.voteStart as bigint,
            voteEnd: args.voteEnd as bigint,
            description: args.description as string,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          });
        }
      }
      // Newest first
      all.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
      setProposals(all);
    } catch (err) {
      console.error("Failed to fetch proposals:", err);
    } finally {
      setProposalsLoading(false);
    }
  }, [publicClient, governor]);

  useEffect(() => {
    if (!onSepolia) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await fetchProposals();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [onSepolia, fetchProposals]);

  // Refresh proposals after a write transaction mines.
  useEffect(() => {
    if (txMined) {
      void fetchProposals();
      resetWrite();
    }
  }, [txMined, fetchProposals, resetWrite]);

  // ----- handlers -----
  const handleDelegate = useCallback(() => {
    if (!token || !address) return;
    writeContract({
      address: token,
      abi: VEXOR_TOKEN_ABI,
      functionName: "delegate",
      args: [address],
      chainId: baseSepolia.id,
    });
  }, [token, address, writeContract]);

  const handleVote = useCallback(
    (proposalId: bigint, support: 0 | 1 | 2) => {
      if (!governor) return;
      writeContract({
        address: governor,
        abi: VEXOR_GOVERNOR_ABI,
        functionName: "castVote",
        args: [proposalId, support],
        chainId: baseSepolia.id,
      });
    },
    [governor, writeContract],
  );

  const handlePropose = useCallback(() => {
    if (!governor) return;
    const desc = proposalDescription.trim();
    if (!desc) return;
    // Signal-only proposal: no-op call to self with empty calldata.
    writeContract({
      address: governor,
      abi: VEXOR_GOVERNOR_ABI,
      functionName: "propose",
      args: [
        [governor as Address],
        [0n],
        ["0x" as Hex],
        desc,
      ],
      chainId: baseSepolia.id,
    });
  }, [governor, proposalDescription, writeContract]);

  const handleExecute = useCallback(
    (p: ProposalLog) => {
      if (!governor) return;
      const descriptionHash = keccak256(toBytes(p.description));
      writeContract({
        address: governor,
        abi: VEXOR_GOVERNOR_ABI,
        functionName: "execute",
        args: [
          p.targets as Address[],
          p.values as bigint[],
          p.calldatas as Hex[],
          descriptionHash,
        ],
        chainId: baseSepolia.id,
        value: 0n,
      });
    },
    [governor, writeContract],
  );

  // ----- guard panels -----
  if (!governor) {
    return (
      <PageShell>
        <PanelMissing />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Header
        onSepolia={onSepolia}
        isConnected={isConnected}
        chainId={chainId}
        onSwitchChain={() =>
          switchChain({ chainId: baseSepolia.id })
        }
        isSwitching={isSwitching}
      />

      {/* Wallet gate */}
      {!isConnected ? (
        <GateBox text="CONNECT WALLET TO VIEW VOTING POWER AND PARTICIPATE IN GOVERNANCE." />
      ) : !onSepolia ? (
        <GateBox text="WRONG NETWORK. SWITCH TO BASE SEPOLIA TO PARTICIPATE." />
      ) : (
        <>
          <UserVotesPanel
            userVotes={userVotes}
            userBalance={userBalance}
            hasDelegatedToSelf={hasDelegatedToSelf}
            userDelegate={userDelegate}
            onDelegate={handleDelegate}
            isPending={isWritePending || isMining}
          />
        </>
      )}

      <StatsRow
        votingDelay={votingDelay}
        votingPeriod={votingPeriod}
        proposalThreshold={proposalThreshold}
        proposalCount={proposals.length}
      />

      {/* Proposal list */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-mono text-sm uppercase tracking-widest text-cyan-300">
            Proposals
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchProposals()}
              disabled={proposalsLoading || !onSepolia}
              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
            >
              {proposalsLoading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => setShowProposeForm((v) => !v)}
              disabled={!isConnected || !onSepolia}
              className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
            >
              {showProposeForm ? "Cancel" : "+ Propose"}
            </button>
          </div>
        </div>

        {showProposeForm && (
          <ProposeForm
            description={proposalDescription}
            setDescription={setProposalDescription}
            onSubmit={handlePropose}
            onCancel={() => {
              setShowProposeForm(false);
              setProposalDescription("");
            }}
            isPending={isWritePending || isMining}
            userVotes={userVotes}
            proposalThreshold={proposalThreshold}
          />
        )}

        {proposals.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="font-mono text-sm text-white/55">
              {proposalsLoading
                ? "Scanning RPC for ProposalCreated events…"
                : "No proposals found in the last 500,000 blocks (~12 days)."}
            </p>
            {!proposalsLoading && (
              <p className="mt-2 font-mono text-xs text-white/35">
                Be the first — connect a wallet, delegate to self, and submit a
                proposal.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => (
              <ProposalRow
                key={p.id.toString()}
                proposal={p}
                governor={governor}
                userAddress={address}
                expanded={expanded === p.id.toString()}
                onToggle={() =>
                  setExpanded((cur) =>
                    cur === p.id.toString() ? null : p.id.toString(),
                  )
                }
                onVote={handleVote}
                onExecute={handleExecute}
                isPending={isWritePending || isMining}
              />
            ))}
          </div>
        )}
      </section>

      {txHash && (
        <div className="mt-6 rounded-md border border-cyan-400/30 bg-cyan-500/5 px-4 py-3 font-mono text-xs text-cyan-200">
          {isMining ? "Mining tx…" : "Tx submitted."}{" "}
          <a
            href={`${BASESCAN_TESTNET}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-cyan-100"
          >
            {truncAddr(txHash)} ↗
          </a>
        </div>
      )}
    </PageShell>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-16 sm:py-24">
          <div className="mb-8">
            <a
              href="/"
              className="font-mono text-xs text-white/55 hover:text-white transition-colors"
            >
              ← Back to home
            </a>
          </div>
          <header className="mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 mb-3">
              Governance · Base Sepolia testnet
            </p>
            <h1 className="text-3xl sm:text-4xl font-mono font-medium text-white mb-3">
              Vexor Governor
            </h1>
            <p className="text-white/65 leading-relaxed">
              On-chain voting over the $VEXOR (testnet) token. Stake $VEXOR
              via 4-tier locks to earn weighted voting power, delegate to
              yourself, then vote on or submit proposals. Voting period
              ~4 hours · proposal threshold 100 $VEXOR · quorum 4% of supply.
            </p>
          </header>
          {children}
        </article>
      </main>
      <Footer />
    </>
  );
}

function Header({
  onSepolia,
  isConnected,
  chainId,
  onSwitchChain,
  isSwitching,
}: {
  onSepolia: boolean;
  isConnected: boolean;
  chainId: number;
  onSwitchChain: () => void;
  isSwitching: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="font-mono text-[11px] text-white/60">
        Network:{" "}
        <span
          className={onSepolia ? "text-cyan-300" : isConnected ? "text-red-300" : "text-white/40"}
        >
          {onSepolia
            ? "base-sepolia ✓"
            : isConnected
              ? `wrong-chain (${chainId})`
              : "disconnected"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isConnected && !onSepolia && (
          <button
            type="button"
            onClick={onSwitchChain}
            disabled={isSwitching}
            className="rounded-md border border-yellow-400/40 bg-yellow-500/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-yellow-200 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
          >
            {isSwitching ? "Switching…" : "Switch to Base Sepolia"}
          </button>
        )}
        <WalletButton compact />
      </div>
    </div>
  );
}

function StatsRow({
  votingDelay,
  votingPeriod,
  proposalThreshold,
  proposalCount,
}: {
  votingDelay: bigint | undefined;
  votingPeriod: bigint | undefined;
  proposalThreshold: bigint | undefined;
  proposalCount: number;
}) {
  const periodHours =
    votingPeriod !== undefined
      ? ((Number(votingPeriod) * 2) / 3600).toFixed(1) // Base ~2s blocks
      : "—";
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <StatCard
        label="Voting delay"
        value={votingDelay !== undefined ? `${votingDelay} blk` : "—"}
        sub="before voting opens"
      />
      <StatCard
        label="Voting period"
        value={periodHours === "—" ? "—" : `~${periodHours}h`}
        sub={
          votingPeriod !== undefined ? `(${votingPeriod} blocks)` : "—"
        }
      />
      <StatCard
        label="Propose threshold"
        value={
          proposalThreshold !== undefined
            ? `${fmtVexor(proposalThreshold)} VEXOR`
            : "—"
        }
        sub="min voting power"
      />
      <StatCard
        label="Proposals"
        value={proposalCount.toString()}
        sub="in scan window"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-white/45 mb-1">
        {label}
      </div>
      <div className="font-mono text-base text-white">{value}</div>
      {sub && (
        <div className="font-mono text-[10px] text-white/40 mt-1">{sub}</div>
      )}
    </div>
  );
}

function GateBox({ text }: { text: string }) {
  return (
    <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-white/55">
        {text}
      </p>
      <div className="mt-4 flex justify-center">
        <WalletButton />
      </div>
    </div>
  );
}

function PanelMissing() {
  return (
    <div className="mt-6 rounded-lg border border-yellow-400/30 bg-yellow-500/5 p-6">
      <p className="font-mono text-sm text-yellow-200">
        Governor contract address is not configured. Set{" "}
        <code className="text-yellow-100">NEXT_PUBLIC_VEXOR_GOVERNANCE_TESTNET</code>{" "}
        in the build environment.
      </p>
    </div>
  );
}

function UserVotesPanel({
  userVotes,
  userBalance,
  hasDelegatedToSelf,
  userDelegate,
  onDelegate,
  isPending,
}: {
  userVotes: bigint | undefined;
  userBalance: bigint | undefined;
  hasDelegatedToSelf: boolean;
  userDelegate: Address | undefined;
  onDelegate: () => void;
  isPending: boolean;
}) {
  const ZERO = "0x0000000000000000000000000000000000000000";
  const noDelegate =
    !userDelegate || userDelegate.toLowerCase() === ZERO;

  return (
    <div className="mb-8 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-200/70 mb-1">
            Your voting power
          </div>
          <div className="font-mono text-xl text-white">
            {userVotes !== undefined ? fmtVexor(userVotes) : "—"} VEXOR
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-200/70 mb-1">
            Your $VEXOR balance
          </div>
          <div className="font-mono text-xl text-white">
            {userBalance !== undefined ? fmtVexor(userBalance) : "—"}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-200/70 mb-1">
            Delegate
          </div>
          <div className="font-mono text-sm text-white">
            {noDelegate
              ? "(none — must delegate before voting)"
              : hasDelegatedToSelf
                ? "self ✓"
                : truncAddr(userDelegate ?? "")}
          </div>
        </div>
      </div>

      {!hasDelegatedToSelf && userBalance !== undefined && userBalance > 0n && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
          <p className="font-mono text-xs text-white/60">
            You hold $VEXOR but cannot vote yet — delegate voting weight to
            yourself first (one-time tx).
          </p>
          <button
            type="button"
            onClick={onDelegate}
            disabled={isPending}
            className="rounded-md border border-cyan-400/50 bg-cyan-500/20 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-100 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
          >
            {isPending ? "Submitting…" : "Delegate to self"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProposeForm({
  description,
  setDescription,
  onSubmit,
  onCancel,
  isPending,
  userVotes,
  proposalThreshold,
}: {
  description: string;
  setDescription: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  userVotes: bigint | undefined;
  proposalThreshold: bigint | undefined;
}) {
  const enough =
    userVotes !== undefined &&
    proposalThreshold !== undefined &&
    userVotes >= proposalThreshold;
  return (
    <div className="mb-4 rounded-lg border border-cyan-400/30 bg-cyan-500/5 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-mono text-sm uppercase tracking-widest text-cyan-200">
          New signal proposal
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">
          Off-chain action · on-chain vote
        </span>
      </div>
      <p className="mb-3 font-mono text-xs text-white/55 leading-relaxed">
        Submit a markdown-formatted proposal. The first line (use{" "}
        <code className="text-white/80">{`# Title`}</code>) becomes the title.
        Body can contain rationale, links, and references. The tx itself
        records a no-op call to the governor; the proposal&apos;s &quot;decision&quot; is
        what the community votes on.
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={`# Increase reward push cadence to 1h\n\nRationale:\n- Stakers reported …\n- Recent metrics show …\n\nProposed: change off-chain bot schedule from 4h to 1h cadence.`}
        rows={10}
        className="w-full rounded-md border border-white/10 bg-black/50 p-3 font-mono text-xs text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
      />
      {!enough && (
        <p className="mt-2 font-mono text-[11px] text-yellow-300/90">
          Insufficient voting power. Need{" "}
          <span className="text-yellow-100">
            {proposalThreshold !== undefined
              ? fmtVexor(proposalThreshold)
              : "—"}{" "}
            VEXOR
          </span>{" "}
          to propose; you have{" "}
          <span className="text-yellow-100">
            {userVotes !== undefined ? fmtVexor(userVotes) : "—"}
          </span>
          . Stake $VEXOR + delegate to self to acquire voting weight.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={
            isPending || description.trim().length === 0 || !enough
          }
          className="rounded-md border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-100 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit proposal"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ProposalRow({
  proposal,
  governor,
  userAddress,
  expanded,
  onToggle,
  onVote,
  onExecute,
  isPending,
}: {
  proposal: ProposalLog;
  governor: Address;
  userAddress: Address | undefined;
  expanded: boolean;
  onToggle: () => void;
  onVote: (id: bigint, support: 0 | 1 | 2) => void;
  onExecute: (p: ProposalLog) => void;
  isPending: boolean;
}) {
  const stateRead = useReadContract({
    address: governor,
    abi: VEXOR_GOVERNOR_ABI,
    functionName: "state",
    args: [proposal.id],
    chainId: baseSepolia.id,
  });
  const votesRead = useReadContract({
    address: governor,
    abi: VEXOR_GOVERNOR_ABI,
    functionName: "proposalVotes",
    args: [proposal.id],
    chainId: baseSepolia.id,
  });
  const hasVotedRead = useReadContract({
    address: governor,
    abi: VEXOR_GOVERNOR_ABI,
    functionName: "hasVoted",
    args: userAddress ? [proposal.id, userAddress] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!userAddress },
  });

  const stateIdx = stateRead.data as number | undefined;
  const stateLabel: ProposalState | undefined =
    stateIdx !== undefined ? STATE_LABELS[stateIdx] : undefined;
  const votes = votesRead.data as
    | readonly [bigint, bigint, bigint]
    | undefined;
  const [against, forV, abstain] = votes ?? [0n, 0n, 0n];
  const total = against + forV + abstain;
  const forPct =
    total > 0n ? Number((forV * 10000n) / total) / 100 : 0;

  const userHasVoted = hasVotedRead.data === true;
  const title = titleOf(proposal.description);
  const body = proposal.description.includes("\n")
    ? proposal.description.split("\n").slice(1).join("\n").trim()
    : "";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${stateLabel ? STATE_COLORS[stateLabel] : "border-white/10 text-white/40"}`}
        >
          {stateLabel ?? "…"}
        </span>
        <span className="grow min-w-0">
          <span className="block font-mono text-sm text-white truncate">
            {title}
          </span>
          <span className="block font-mono text-[10px] text-white/40 mt-0.5">
            ID {truncAddr("0x" + proposal.id.toString(16).padStart(40, "0"))}{" "}
            · by {truncAddr(proposal.proposer)}
          </span>
        </span>
        <span className="shrink-0 hidden sm:block font-mono text-[10px] text-white/55 tabular-nums">
          {fmtVexor(forV)} FOR · {fmtVexor(against)} AGAINST
        </span>
        <span className="shrink-0 font-mono text-white/40">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-4 space-y-4">
          {body && (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-white/70 leading-relaxed">
              {body}
            </pre>
          )}

          <div className="grid grid-cols-3 gap-3">
            <VoteStat label="For" value={forV} pct={forPct} color="emerald" />
            <VoteStat
              label="Against"
              value={against}
              pct={total > 0n ? Number((against * 10000n) / total) / 100 : 0}
              color="red"
            />
            <VoteStat
              label="Abstain"
              value={abstain}
              pct={total > 0n ? Number((abstain * 10000n) / total) / 100 : 0}
              color="white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="font-mono text-[10px] text-white/45">
              {userHasVoted ? "You voted ✓" : "Cast your vote:"}
            </div>
            <button
              type="button"
              onClick={() => onVote(proposal.id, 1)}
              disabled={isPending || stateLabel !== "Active" || userHasVoted}
              className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
            >
              For
            </button>
            <button
              type="button"
              onClick={() => onVote(proposal.id, 0)}
              disabled={isPending || stateLabel !== "Active" || userHasVoted}
              className="rounded-md border border-red-500/50 bg-red-500/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-red-100 hover:bg-red-500/25 transition-colors disabled:opacity-40"
            >
              Against
            </button>
            <button
              type="button"
              onClick={() => onVote(proposal.id, 2)}
              disabled={isPending || stateLabel !== "Active" || userHasVoted}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              Abstain
            </button>

            {stateLabel === "Succeeded" && (
              <button
                type="button"
                onClick={() => onExecute(proposal)}
                disabled={isPending}
                className="rounded-md border border-purple-400/50 bg-purple-500/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-purple-100 hover:bg-purple-500/25 transition-colors disabled:opacity-40"
              >
                Execute
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-white/40 pt-2 border-t border-white/5">
            <span>vote start: blk {proposal.voteStart.toString()}</span>
            <span>·</span>
            <span>vote end: blk {proposal.voteEnd.toString()}</span>
            <span>·</span>
            <a
              href={`${BASESCAN_TESTNET}/tx/${proposal.transactionHash}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-300 underline"
            >
              creation tx ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function VoteStat({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: bigint;
  pct: number;
  color: "emerald" | "red" | "white";
}) {
  const colors: Record<typeof color, { bar: string; text: string }> = {
    emerald: { bar: "bg-emerald-500/60", text: "text-emerald-200" },
    red: { bar: "bg-red-500/60", text: "text-red-200" },
    white: { bar: "bg-white/40", text: "text-white/70" },
  };
  return (
    <div className="rounded-md border border-white/10 bg-black/40 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className={`font-mono text-[10px] uppercase tracking-widest ${colors[color].text}`}>
          {label}
        </span>
        <span className="font-mono text-[10px] text-white/50 tabular-nums">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="font-mono text-sm text-white tabular-nums">
        {fmtVexor(value)}
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${colors[color].bar}`}
          style={{ width: `${Math.min(pct, 100).toFixed(2)}%` }}
        />
      </div>
    </div>
  );
}

