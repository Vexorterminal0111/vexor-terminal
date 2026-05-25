"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Wallet,
  Coins,
  Lock,
  Vote,
  Sparkles,
  MessageSquare,
  Terminal,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

type SectionId =
  | "overview"
  | "quickstart"
  | "contracts"
  | "console"
  | "tokenomics"
  | "subagents"
  | "tiers"
  | "architecture"
  | "faq";

const TOC: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "contracts", label: "Contracts" },
  { id: "console", label: "Console walkthrough" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "subagents", label: "Sub-agents" },
  { id: "tiers", label: "Tier table" },
  { id: "architecture", label: "Architecture" },
  { id: "faq", label: "FAQ" },
];

const SUB_AGENTS = [
  { name: "Cipher", role: "Cryptography & on-chain analysis", traits: "viem · forge · cast" },
  { name: "Atlas", role: "Routing & orchestration", traits: "dispatch · plan · supervise" },
  { name: "Quill", role: "Writing & docs", traits: "long-form · TLDR · summarize" },
  { name: "Forge", role: "Solidity & contracts", traits: "OZ · Foundry · audits" },
  { name: "Vector", role: "Retrieval & memory", traits: "embed · search · cite" },
  { name: "Pulse", role: "Markets & telemetry", traits: "ticks · alerts · feeds" },
  { name: "Halo", role: "Brand & visual", traits: "logos · banners · UI polish" },
  { name: "Prism", role: "Data viz & charts", traits: "render · explain · forecast" },
  { name: "Nyx", role: "Security & adversarial", traits: "red-team · sandbox · audit" },
];

const TIERS = [
  { name: "—", min: "0", note: "Connect wallet to read on-chain state" },
  { name: "Bronze", min: "1,000 $VEXOR", note: "Priority chat slot, 1-block latency" },
  { name: "Silver", min: "10,000 $VEXOR", note: "Private channels + early sub-agents" },
  { name: "Gold", min: "100,000 $VEXOR", note: "Beta sub-agents + private memory" },
  { name: "Black", min: "1,000,000 $VEXOR", note: "Revenue dashboard + governance lead" },
];

const LOCK_TIERS = [
  { lock: "30 days", multiplier: "1.0x" },
  { lock: "90 days", multiplier: "1.5x" },
  { lock: "180 days", multiplier: "2.0x" },
  { lock: "365 days", multiplier: "3.0x" },
];

const FAQ = [
  {
    q: "Is $VEXOR live on Base mainnet?",
    a: "Not yet. The $VEXOR contract has not been deployed and the on-chain staking pool is not active. Once the contract is verified on Basescan, the address and Console will be enabled on this site.",
  },
  {
    q: "When does the Console open?",
    a: "The on-chain Console (wallet, staking, governance) opens once $VEXOR is deployed to Base. Launch timing will be announced on @vexorterminal and via the Watchtower Telegram bot.",
  },
  {
    q: "Is $VEXOR available to purchase?",
    a: "No. There is no live $VEXOR contract. Any token marketed as $VEXOR prior to the official launch announcement is not associated with Vexor Terminal. Wait for the verified contract address before interacting with any market.",
  },
  {
    q: "How will staking yield work at launch?",
    a: "Stakers receive a pro-rata share of protocol revenue, denominated in $VEXOR. The current design is flat single-sided staking (no lock, withdraw any time) with rewards pushed by the protocol on a periodic schedule. Final economics will be published before launch.",
  },
  {
    q: "Is the orchestrator chat free during the pre-launch phase?",
    a: "Yes. The pre-launch chat runs on hosted Llama 3.3 70B via Groq, wallet-gated and rate-limited. Production billing in $VEXOR activates with the token launch.",
  },
  {
    q: "Where is the contract source code?",
    a: "Solidity source is in the contracts/ directory of the repository (VexorToken.sol, VexorStaking.sol, VexorGovernor.sol, VexorRevShare.sol). The codebase uses Foundry and OpenZeppelin v5. Verified mainnet addresses will be linked here once $VEXOR is deployed.",
  },
];

function Anchor({ id }: { id: SectionId }) {
  return <a id={id} className="block relative -top-24" aria-hidden />;
}

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id: SectionId;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-16 pb-4">
      <Anchor id={id} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-3"
      >
        <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300/80">
          <span className="h-px w-8 bg-violet-300/40" />
          {kicker}
        </div>
        <h2 className="font-mono text-xl sm:text-2xl md:text-3xl text-white tracking-tight break-words">
          {title}
        </h2>
      </motion.div>
      <div className="mt-5 sm:mt-6 text-white/75 leading-relaxed text-[14.5px] sm:text-[15px] space-y-4">
        {children}
      </div>
    </section>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="absolute -top-3 left-5 font-mono text-[10px] uppercase tracking-widest text-violet-300 bg-background px-2 py-0.5 border border-violet-300/30 rounded">
        Step {n}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-violet-300">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-mono text-base text-white">{title}</h3>
      </div>
      <div className="mt-3 text-sm text-white/65 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function Docs() {
  return (
    <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24">
      <div
        aria-hidden
        className="absolute left-1/2 top-32 -translate-x-1/2 w-[60vw] h-[40vh] bg-violet-500/10 blur-[160px] rounded-full pointer-events-none"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
            Docs · v0.1.0 · $VEXOR coming soon
          </div>
          <h1 className="font-mono text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-white max-w-3xl break-words">
            Platform <span className="text-violet-300">documentation</span>.
          </h1>
          <p className="max-w-2xl text-[15px] sm:text-base md:text-lg text-white/65 leading-relaxed">
            Vexor Terminal coordinates nine specialized sub-agents across
            nine large language models. The protocol layer — token,
            staking, governance — deploys to Base alongside the $VEXOR
            launch. This page documents the orchestrator design, the
            sub-agent roster, and the planned token economy.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href="/#console"
              className="inline-flex items-center gap-2 rounded-full bg-violet-300 text-black px-4 py-2 font-mono text-xs hover:bg-violet-200 transition-colors"
            >
              Open Console <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="/#chat"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-mono text-xs text-white/80 hover:text-white hover:border-white/30 transition-colors"
            >
              Open Chat
            </a>
            <a
              href="https://github.com/Vexorterminal0111"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-mono text-xs text-white/80 hover:text-white hover:border-white/30 transition-colors"
            >
              GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </motion.div>

        {/* Mobile TOC */}
        <details className="mt-10 lg:hidden rounded-xl border border-white/10 bg-white/[0.02] open:bg-white/[0.04]">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">
              On this page
            </span>
            <span className="font-mono text-violet-300 text-lg leading-none">+</span>
          </summary>
          <nav className="flex flex-col px-2 pb-2">
            {TOC.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="font-mono text-xs text-white/65 hover:text-violet-300 transition-colors px-3 py-2 border-t border-white/5"
              >
                {t.label}
              </a>
            ))}
          </nav>
        </details>

        <div className="mt-8 sm:mt-10 lg:mt-14 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8 lg:gap-10">
          {/* Sidebar TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/45 mb-3">
                On this page
              </div>
              <nav className="flex flex-col gap-1.5">
                {TOC.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="font-mono text-xs text-white/55 hover:text-violet-300 transition-colors py-1"
                  >
                    {t.label}
                  </a>
                ))}
              </nav>
              <div className="mt-8 rounded-lg border border-violet-400/30 bg-violet-500/[0.06] p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-violet-300">
                  $VEXOR · coming soon
                </div>
                <p className="mt-2 text-[11px] text-white/70 leading-snug">
                  Planned ERC-20 on Base. 100B supply, 18 decimals.
                </p>
                <p className="mt-3 text-[10px] text-white/45 leading-relaxed">
                  The token contract has not been deployed yet. The Console
                  and on-chain governance will open with the $VEXOR launch.
                </p>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0">
            <Section id="overview" kicker="01" title="What is Vexor Terminal?">
              <p>
                Vexor Terminal is a programmable AI orchestration platform.
                The orchestrator routes every request to one or more of{" "}
                <span className="text-violet-300">nine specialized sub-agents</span>
                : Cipher, Atlas, Quill, Forge, Vector, Pulse, Halo, Prism, and
                Nyx. Each sub-agent runs on its own LLM tier and is scoped to
                a single domain.
              </p>
              <p>
                The protocol is governed by{" "}
                <span className="text-violet-300">$VEXOR</span>, an ERC-20Votes
                token on Base. Hold $VEXOR to access elevated tiers, stake to
                receive a pro-rata share of protocol revenue, and vote on
                protocol direction.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Chain
                  </div>
                  <div className="mt-1 font-mono text-white">Base</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Token
                  </div>
                  <div className="mt-1 font-mono text-white">$VEXOR — soon</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Status
                  </div>
                  <div className="mt-1 font-mono text-white text-xs">
                    Pre-launch
                  </div>
                </div>
              </div>
            </Section>

            <Section id="quickstart" kicker="02" title="Quickstart">
              <p>
                The on-chain Console (stake / govern) is not yet live — it
                opens once the $VEXOR contract is deployed and verified on
                Base. The flow below describes the launch-ready user path.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Step n={1} icon={Wallet} title="Connect wallet on Base">
                  At launch, the Console will prompt a wallet connect and
                  auto-switch the active chain to Base. MetaMask, Rainbow,
                  and Coinbase Wallet will be supported.
                </Step>
                <Step n={2} icon={Coins} title="Acquire $VEXOR">
                  Once $VEXOR deploys on Base, the verified contract address
                  will be posted on this site and on @vexorterminal. $VEXOR
                  will be obtainable from the listed liquidity venues.
                </Step>
                <Step n={3} icon={Vote} title="Self-delegate for voting power">
                  $VEXOR is ERC-20Votes. A one-time self-delegate transaction
                  activates voting power for governance proposals.
                </Step>
                <Step n={4} icon={Lock} title="Stake $VEXOR, earn revenue">
                  The RevShare pool accepts $VEXOR deposits. Stakers receive
                  a pro-rata share of protocol revenue — flat staking,
                  withdraw any time.
                </Step>
                <Step n={5} icon={MessageSquare} title="Use the orchestrator">
                  The orchestrator chat is live during the pre-launch
                  phase. Connect a wallet on the home page; each prompt is
                  routed to the appropriate sub-agent.
                </Step>
                <Step n={6} icon={Terminal} title="Subscribe to launch updates">
                  Launch will be announced via{" "}
                  <a
                    href="https://x.com/vexorterminal"
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-300 hover:underline"
                  >
                    @vexorterminal
                  </a>{" "}
                  on X and the Watchtower Telegram bot.
                </Step>
              </div>
            </Section>

            <Section id="contracts" kicker="03" title="Smart contract addresses">
              <p>
                The $VEXOR token and the revenue-share staking pool are not yet
                deployed on Base. Once the contracts ship, this section will
                list the verified mainnet addresses with direct links to
                Basescan.
              </p>
              <div className="mt-6 rounded-xl border border-violet-400/20 bg-violet-500/[0.04] p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-violet-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs text-violet-200 uppercase tracking-widest">
                    Pre-launch
                  </div>
                  <p className="mt-1 text-sm text-white/70">
                    The $VEXOR contract address has not been published. Follow{" "}
                    <a
                      href="https://x.com/vexorterminal"
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet-300 hover:underline"
                    >
                      @vexorterminal
                    </a>{" "}
                    for the launch announcement — the address will be posted
                    there and added to this page once verified on Basescan.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="console" kicker="04" title="Console walkthrough">
              <p className="text-white/65">
                The following describes the on-chain Console flow that will
                open at $VEXOR launch. None of these actions are live yet — the
                token contract has not been deployed.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-violet-300" /> Wallet tab
                  </h3>
                  <p className="mt-2">
                    Displays the connected address, current chain, $VEXOR
                    balance, and voting power. Two actions are exposed:
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-white/65 space-y-1 ml-2">
                    <li>
                      <span className="text-violet-300">Connect wallet</span> —
                      pick MetaMask, Rainbow, or Coinbase Wallet on Base.
                    </li>
                    <li>
                      <span className="text-violet-300">Self-delegate</span> —
                      one-time tx that activates voting power for ERC-20Votes.
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-300" /> Stake tab
                  </h3>
                  <p className="mt-2">
                    Stakes $VEXOR under one of four lock tiers. Longer locks
                    carry higher reward weight. The reward share for any
                    position equals its weighted stake divided by total
                    weighted stake.
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="font-mono text-[10px] uppercase tracking-widest text-white/45 border-b border-white/10">
                          <th className="text-left py-2 pr-4">Lock</th>
                          <th className="text-left py-2">Reward multiplier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {LOCK_TIERS.map((t) => (
                          <tr
                            key={t.lock}
                            className="border-b border-white/5 last:border-0"
                          >
                            <td className="py-2 pr-4 font-mono text-white">
                              {t.lock}
                            </td>
                            <td className="py-2 font-mono text-violet-300">
                              {t.multiplier}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-sm text-white/65">
                    Pending rewards will stream in real time and can be
                    claimed any time. Principal will unlock at the timestamp
                    shown on each position.
                  </p>
                </div>

                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Vote className="h-4 w-4 text-violet-300" /> Govern tab
                  </h3>
                  <p className="mt-2">
                    Uses OpenZeppelin Governor v5. Proposals require ≥100
                    $VEXOR voting power. Voters select{" "}
                    <span className="text-violet-300">For</span> /{" "}
                    <span className="text-violet-300">Against</span> /{" "}
                    <span className="text-violet-300">Abstain</span>.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-white/65 space-y-1 ml-2">
                    <li>Voting delay: 1 block</li>
                    <li>Voting period: 7,200 blocks (~4 hours)</li>
                    <li>Quorum: 4% of total supply</li>
                    <li>Proposal threshold: 100 $VEXOR</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-300" /> Tier tab
                  </h3>
                  <p className="mt-2">
                    Displays the current tier and progress to the next,
                    derived from $VEXOR balance. See the full table below.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="tokenomics" kicker="05" title="$VEXOR tokenomics">
              <p>
                <span className="text-violet-300">$VEXOR</span> is an ERC-20Votes
                + EIP-2612 Permit token. Voting power requires self-delegation
                (one-time, no fee beyond gas).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <Stat label="Standard" value="ERC-20Votes" />
                <Stat label="Permit" value="EIP-2612" />
                <Stat label="Total supply" value="100,000,000,000" />
                <Stat label="Decimals" value="18" />
              </div>
              <p className="mt-2">
                Utility on the protocol (at launch):
              </p>
              <ul className="list-disc list-inside text-sm text-white/70 space-y-1 ml-2">
                <li>
                  <span className="text-white">Pay for Runtime</span> — burn
                  $VEXOR per chat / task. Premium dispatch will cost more.
                </li>
                <li>
                  <span className="text-white">Stake to Earn</span> — receive
                  a pro-rata share of the staking pool, scaled by lock
                  multiplier.
                </li>
                <li>
                  <span className="text-white">Governance</span> — vote on new
                  sub-agents, model whitelisting, treasury spend, upgrades.
                </li>
                <li>
                  <span className="text-white">Token-Gated Tiers</span> —
                  Bronze / Silver / Gold / Black will unlock an elevated
                  experience.
                </li>
              </ul>
              <p className="mt-2 text-sm text-white/55">
                $VEXOR will be deployed on Base with 100B total supply at 18
                decimals. The token has not launched yet — the verified
                contract address will be linked in the Contracts section
                once it ships. Distribution and launch venue will be
                announced before any liquidity is seeded.
              </p>
            </Section>

            <Section id="subagents" kicker="06" title="Sub-agent reference">
              <p>
                Vexor exposes a single orchestrator interface. Routing is
                resolved across{" "}
                <span className="text-violet-300">nine specialist sub-agents</span>,
                each scoped to a single domain and bound to a specific LLM
                tier.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                {SUB_AGENTS.map((a) => (
                  <div
                    key={a.name}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-violet-400/30 transition-colors"
                  >
                    <div className="font-mono text-white text-lg">{a.name}</div>
                    <div className="mt-1 text-sm text-white/70">{a.role}</div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-violet-300/70">
                      {a.traits}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="tiers" kicker="07" title="Tier table">
              <p>
                Tiers are computed from the connected wallet&apos;s $VEXOR
                balance at read time. They are not enforced on-chain (no
                NFT) — the protocol layer applies them as a soft access
                ladder.
              </p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="font-mono text-[10px] uppercase tracking-widest text-white/45 border-b border-white/10">
                      <th className="text-left py-3 px-4">Tier</th>
                      <th className="text-left py-3 px-4">Minimum balance</th>
                      <th className="text-left py-3 px-4">Unlocks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map((t) => (
                      <tr
                        key={t.name + t.min}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="py-3 px-4 font-mono text-white">
                          {t.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-violet-300">
                          {t.min}
                        </td>
                        <td className="py-3 px-4 text-white/70">{t.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="architecture" kicker="08" title="Architecture">
              <p>
                Vexor Terminal consists of a static frontend, a thin LLM
                proxy, and a Solidity protocol layer that deploys to Base
                alongside the $VEXOR launch.
              </p>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-5 font-mono text-xs text-white/70 leading-relaxed overflow-x-auto">
                <pre className="whitespace-pre">{`┌──────────────────────────────────────────────┐
│  Next.js 16 (static export, App Router)       │
│  · wagmi v2 + viem + RainbowKit               │
│  · Tailwind v4 + Framer Motion + Geist Mono   │
└─────────────┬──────────────────┬──────────────┘
              │                  │
              │ JSON-RPC         │ HTTPS
              ▼                  ▼
  ┌─────────────────────┐   ┌──────────────────┐
  │ Base mainnet RPC    │   │ Chat API         │
  │ mainnet.base.org    │   │ FastAPI + Groq   │
  └──────────┬──────────┘   │ Llama 3.3 70B    │
             │              └──────────────────┘
             ▼
  ┌─────────────────────────────────┐
  │ VexorToken     ERC-20Votes      │
  │ VexorStaking   4-tier lock      │
  │ VexorGovernor  OZ Governor v5   │
  └─────────────────────────────────┘`}</pre>
              </div>
              <p className="mt-2 text-sm text-white/65">
                The frontend and chat backend are live during the pre-launch
                phase. The protocol layer (~600 lines of audited-pattern
                Solidity) deploys to Base alongside the $VEXOR launch.
              </p>
            </Section>

            <Section id="faq" kicker="09" title="FAQ">
              <div className="space-y-3">
                {FAQ.map((f) => (
                  <details
                    key={f.q}
                    className="group rounded-xl border border-white/10 bg-white/[0.02] open:border-violet-400/20 open:bg-violet-500/[0.03] transition-colors"
                  >
                    <summary className="cursor-pointer list-none p-5 flex items-start justify-between gap-4">
                      <span className="font-mono text-white text-sm sm:text-base">
                        {f.q}
                      </span>
                      <span className="font-mono text-violet-300 text-lg leading-none transition-transform group-open:rotate-45 shrink-0">
                        +
                      </span>
                    </summary>
                    <div className="px-5 pb-5 text-white/70 text-sm leading-relaxed">
                      {f.a}
                    </div>
                  </details>
                ))}
              </div>
            </Section>

            <div className="mt-16 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.02] to-transparent p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300/80">
                  Launch updates
                </div>
                <div className="mt-2 font-mono text-2xl text-white">
                  Subscribe for launch announcements.
                </div>
                <div className="mt-1 text-sm text-white/65">
                  The Console activates with the $VEXOR launch on Base.
                  Updates are posted to @vexorterminal.
                </div>
              </div>
              <a
                href="https://x.com/vexorterminal"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-violet-300 text-black px-5 py-2.5 font-mono text-sm hover:bg-violet-200 transition-colors whitespace-nowrap"
              >
                Follow on X <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </div>
      <div className="mt-1 font-mono text-white text-sm sm:text-base">
        {value}
      </div>
    </div>
  );
}
