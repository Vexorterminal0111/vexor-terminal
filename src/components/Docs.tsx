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

const VT_ADDRESS = "0x2c684D666998436634EcEde1527EdA7975427Ba3";
const REVSHARE_ADDRESS = "0xE25f6243f848523c4577639e975B9F3E0fA57186";
const BASESCAN = "https://basescan.org/address";
const BASESCAN_TESTNET = "https://sepolia.basescan.org/address";
const STAKING_ADDRESS_TESTNET = "0x6a345b8390a67681764521d146853211dd089062";
const GOVERNOR_ADDRESS_TESTNET = "0xd1850b4c2e663b45a49330d00637db78197be31c";

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
  { name: "Bronze", min: "1,000 $VT", note: "Priority chat slot, 1-block latency" },
  { name: "Silver", min: "10,000 $VT", note: "Private channels + early sub-agents" },
  { name: "Gold", min: "100,000 $VT", note: "Beta sub-agents + private memory" },
  { name: "Black", min: "1,000,000 $VT", note: "Revenue dashboard + governance lead" },
];

const LOCK_TIERS = [
  { lock: "30 days", multiplier: "1.0x" },
  { lock: "90 days", multiplier: "1.5x" },
  { lock: "180 days", multiplier: "2.0x" },
  { lock: "365 days", multiplier: "3.0x" },
];

const FAQ = [
  {
    q: "Is $VT live on Base mainnet?",
    a: "Yes — $VT is deployed on Base mainnet as a verified ERC-20. Total supply 100B, 18 decimals. The mainnet revenue-share staking pool (VexorRevShare) is also live — flat staking with no lock and manual pro-rata reward distribution. See the Contracts section above for direct Basescan links. The 4-tier governance demo still runs on Base Sepolia testnet so anyone can interact with the console without spending real gas.",
  },
  {
    q: "Is the token I claim from the faucet worth anything?",
    a: "No. The faucet on Base Sepolia hands out free testnet $VT for trying the Console. The testnet $VT is not the same token as the mainnet $VT — it has no monetary value and cannot be bridged or traded.",
  },
  {
    q: "Do I need real ETH to use the Console?",
    a: "You need Base Sepolia ETH (free, available from public faucets) to pay gas. No mainnet ETH or $VT purchase required.",
  },
  {
    q: "Can I propose anything via the Governor?",
    a: "You need ≥100 $VT voting power (self-delegated balance at the proposal's block) to submit a proposal. Any holder with voting power can vote. Quorum is 4% of total supply.",
  },
  {
    q: "Why does my balance not give me voting power?",
    a: "ERC-20Votes requires a one-time self-delegation. Open the Wallet tab in the Console and click 'Self-delegate' — after the transaction confirms, your balance counts toward voting power.",
  },
  {
    q: "How does staking yield work?",
    a: "Rewards stream from a 1M $VT pool over 30 days. Your position's share = (your weighted stake) / (total weighted stake). Weighted stake = amount × lock multiplier (1.0x → 3.0x).",
  },
  {
    q: "Can I withdraw my stake early?",
    a: "No — lock periods are hard locks enforced on-chain. The earliest withdraw is at the unlock timestamp shown on each position. Pending rewards can be claimed at any time.",
  },
  {
    q: "Is the chat free?",
    a: "Yes during beta — hosted Llama 3.3 70B via Groq, wallet-gated and rate-limited. Production billing in mainnet $VT will be activated once staking and governance migrate to mainnet.",
  },
  {
    q: "Where can I see all contract source code?",
    a: "Source is in the contracts/ directory of the repo (VexorToken.sol, VexorStaking.sol, VexorGovernor.sol, VexorRevShare.sol). Built with Foundry + OpenZeppelin v5. VexorRevShare is verified on Basescan mainnet.",
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
        <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
          <span className="h-px w-8 bg-cyan-300/40" />
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

function CodeRow({
  label,
  href,
}: {
  label: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-cyan-200">
        {label}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-white/60 hover:text-cyan-300 transition-colors shrink-0"
        >
          View on Basescan
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
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
      <div className="absolute -top-3 left-5 font-mono text-[10px] uppercase tracking-widest text-cyan-300 bg-background px-2 py-0.5 border border-cyan-300/30 rounded">
        Step {n}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cyan-300">
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
        className="absolute left-1/2 top-32 -translate-x-1/2 w-[60vw] h-[40vh] bg-cyan-500/10 blur-[160px] rounded-full pointer-events-none"
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
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            Docs · v0.1.0 · $VT live on Base
          </div>
          <h1 className="font-mono text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-white max-w-3xl break-words">
            Drive the <span className="text-cyan-300">terminal</span>.
          </h1>
          <p className="max-w-2xl text-[15px] sm:text-base md:text-lg text-white/65 leading-relaxed">
            Vexor Terminal is a personal AI orchestrator commanding 9
            specialized sub-agents, owned and governed by $VT on Base. This
            page is everything you need to use the Console, talk to the
            orchestrator, and understand the token economics.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href="/#console"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 text-black px-4 py-2 font-mono text-xs hover:bg-cyan-200 transition-colors"
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
            <span className="font-mono text-cyan-300 text-lg leading-none">+</span>
          </summary>
          <nav className="flex flex-col px-2 pb-2">
            {TOC.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="font-mono text-xs text-white/65 hover:text-cyan-300 transition-colors px-3 py-2 border-t border-white/5"
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
                    className="font-mono text-xs text-white/55 hover:text-cyan-300 transition-colors py-1"
                  >
                    {t.label}
                  </a>
                ))}
              </nav>
              <div className="mt-8 rounded-lg border border-cyan-400/30 bg-cyan-500/[0.06] p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">
                  $VT · Base mainnet
                </div>
                <p className="mt-2 text-[11px] text-white/70 leading-snug">
                  Verified ERC-20 on Base. 100B supply, 18 decimals.
                </p>
                <a
                  href={`${BASESCAN}/${VT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:text-white transition-colors"
                >
                  View on Basescan ↗
                </a>
                <p className="mt-3 text-[10px] text-white/45 leading-relaxed">
                  Console demo (claim / stake / govern) still runs on Base
                  Sepolia testnet during beta.
                </p>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0">
            <Section id="overview" kicker="01" title="What is Vexor Terminal?">
              <p>
                Vexor is an autonomous AI orchestrator — not a chatbot. The
                orchestrator routes every request to one or more of{" "}
                <span className="text-cyan-300">9 specialized sub-agents</span>
                : Cipher, Atlas, Quill, Forge, Vector, Pulse, Halo, Prism, and
                Nyx. Each runs on its own LLM and stays in lane.
              </p>
              <p>
                The terminal is owned and governed by{" "}
                <span className="text-cyan-300">$VT</span>, an ERC-20Votes
                token on Base. Hold it to access elevated tiers, stake it to
                earn a pro-rata share of agent revenue, vote with it to direct
                protocol evolution.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Chain
                  </div>
                  <div className="mt-1 font-mono text-white">Base Sepolia</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    Chain ID
                  </div>
                  <div className="mt-1 font-mono text-white">84532</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    RPC
                  </div>
                  <div className="mt-1 font-mono text-white text-xs">
                    sepolia.base.org
                  </div>
                </div>
              </div>
            </Section>

            <Section id="quickstart" kicker="02" title="Quickstart">
              <p>
                Five steps from zero to a real on-chain transaction on Base
                Sepolia.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Step n={1} icon={Wallet} title="Get testnet ETH">
                  Visit a Base Sepolia faucet (e.g.{" "}
                  <a
                    href="https://www.alchemy.com/faucets/base-sepolia"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 hover:underline"
                  >
                    Alchemy
                  </a>
                  ) and claim ~0.01 ETH. You'll need it to pay gas.
                </Step>
                <Step n={2} icon={Terminal} title="Connect your wallet">
                  Click <span className="text-cyan-300">Connect Wallet</span>{" "}
                  in the nav. Pick MetaMask, Rainbow, or Coinbase Wallet. The
                  Console auto-prompts you to switch to Base Sepolia.
                </Step>
                <Step n={3} icon={Coins} title="Claim $VT from the faucet">
                  Open the <span className="text-cyan-300">Wallet</span> tab
                  → click <span className="text-cyan-300">Claim 1,000 $VT</span>
                  . Confirm in your wallet. (1 claim per address, ever.)
                </Step>
                <Step n={4} icon={Vote} title="Self-delegate for voting power">
                  Click <span className="text-cyan-300">Self-delegate</span>{" "}
                  in the Wallet tab. This is a one-time ERC-20Votes
                  requirement before you can propose or vote.
                </Step>
                <Step n={5} icon={Lock} title="Stake, vote, repeat">
                  Open <span className="text-cyan-300">Stake</span> → pick an
                  amount + lock tier → approve + stake. Open{" "}
                  <span className="text-cyan-300">Govern</span> to propose or
                  vote. Every action is a real on-chain tx.
                </Step>
                <Step n={6} icon={MessageSquare} title="Talk to Vexor">
                  Scroll back to <span className="text-cyan-300">Chat</span>{" "}
                  on the home page. Connect wallet, then ask anything — the
                  orchestrator routes to the right sub-agent.
                </Step>
              </div>
            </Section>

            <Section id="contracts" kicker="03" title="Smart contract addresses">
              <p>
                $VT and the revenue-share staking pool (VexorRevShare) are both
                live on Base mainnet. The 4-tier governance demo still runs on
                Base Sepolia testnet so anyone can interact with the console
                without spending real gas.
              </p>
              <div className="mt-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300/80 mb-2">
                  Base mainnet · live
                </div>
                <div className="flex flex-col gap-2">
                  <CodeRow
                    label="$VT token"
                    href={`${BASESCAN}/${VT_ADDRESS}`}
                  />
                  <CodeRow
                    label="VexorRevShare"
                    href={`${BASESCAN}/${REVSHARE_ADDRESS}`}
                  />
                </div>
              </div>
              <div className="mt-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/45 mb-2">
                  Base sepolia · testnet demo
                </div>
                <div className="flex flex-col gap-2">
                  <CodeRow
                    label="Staking (sepolia)"
                    href={`${BASESCAN_TESTNET}/${STAKING_ADDRESS_TESTNET}`}
                  />
                  <CodeRow
                    label="Governor (sepolia)"
                    href={`${BASESCAN_TESTNET}/${GOVERNOR_ADDRESS_TESTNET}`}
                  />
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/[0.04] p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs text-amber-200 uppercase tracking-widest">
                    Testnet disclaimer
                  </div>
                  <p className="mt-1 text-sm text-white/70">
                    The console (claim / stake / govern) runs against Base
                    Sepolia testnet contracts. The testnet $VT has no monetary
                    value and cannot be bridged to mainnet $VT.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="console" kicker="04" title="Console walkthrough">
              <div className="space-y-6">
                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-cyan-300" /> Wallet tab
                  </h3>
                  <p className="mt-2">
                    Shows your address, current chain, $VT balance, voting
                    power, and faucet status. Two actions:
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-white/65 space-y-1 ml-2">
                    <li>
                      <span className="text-cyan-300">Claim 1,000 $VT</span>{" "}
                      — pulls from the public faucet (1x per address).
                    </li>
                    <li>
                      <span className="text-cyan-300">Self-delegate</span> —
                      activates voting power for ERC-20Votes (required once).
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Lock className="h-4 w-4 text-cyan-300" /> Stake tab
                  </h3>
                  <p className="mt-2">
                    Stake $VT under one of four lock tiers. Longer lock =
                    higher reward weight. Your share of the 30-day reward
                    stream = your weighted stake ÷ total weighted stake.
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
                            <td className="py-2 font-mono text-cyan-300">
                              {t.multiplier}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-sm text-white/65">
                    Pending rewards stream in real time and can be claimed any
                    time. Principal unlocks at the timestamp shown on each
                    position.
                  </p>
                </div>

                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Vote className="h-4 w-4 text-cyan-300" /> Govern tab
                  </h3>
                  <p className="mt-2">
                    OpenZeppelin Governor v5. Submit proposals with ≥100
                    $VT voting power. Vote with{" "}
                    <span className="text-cyan-300">For</span> /{" "}
                    <span className="text-cyan-300">Against</span> /{" "}
                    <span className="text-cyan-300">Abstain</span>.
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-white/65 space-y-1 ml-2">
                    <li>Voting delay: 1 block</li>
                    <li>Voting period: 7,200 blocks (~4 hours)</li>
                    <li>Quorum: 4% of total supply</li>
                    <li>Proposal threshold: 100 $VT</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-mono text-white text-lg flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" /> Tier tab
                  </h3>
                  <p className="mt-2">
                    Shows your current tier and progress to the next based on
                    $VT balance. See the full table below.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="tokenomics" kicker="05" title="$VT tokenomics">
              <p>
                <span className="text-cyan-300">$VT</span> is an ERC-20Votes
                + EIP-2612 Permit token. Voting power requires self-delegation
                (one-time, no fee beyond gas).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <Stat label="Standard" value="ERC-20Votes" />
                <Stat label="Permit" value="EIP-2612" />
                <Stat label="Testnet supply" value="10,000,000" />
                <Stat label="Decimals" value="18" />
              </div>
              <p className="mt-2">
                Utility on the protocol:
              </p>
              <ul className="list-disc list-inside text-sm text-white/70 space-y-1 ml-2">
                <li>
                  <span className="text-white">Pay for Runtime</span> — burn
                  $VT per chat / task. Premium dispatch costs more.
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
                  Bronze / Silver / Gold / Black unlocks elevated experience.
                </li>
              </ul>
              <p className="mt-2 text-sm text-white/55">
                Mainnet $VT is deployed as a verified ERC-20 on Base with
                100B total supply at 18 decimals — see the Contracts
                section for the Basescan link. Distribution and launch
                venue will be announced before any liquidity is seeded.
                Testnet console supply is provisional and exists solely
                for protocol testing.
              </p>
            </Section>

            <Section id="subagents" kicker="06" title="Sub-agent reference">
              <p>
                The orchestrator is a single agent. Behind it sit{" "}
                <span className="text-cyan-300">9 specialists</span>, each
                tuned to one domain and bound to one LLM tier.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                {SUB_AGENTS.map((a) => (
                  <div
                    key={a.name}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-cyan-400/30 transition-colors"
                  >
                    <div className="font-mono text-white text-lg">{a.name}</div>
                    <div className="mt-1 text-sm text-white/70">{a.role}</div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-cyan-300/70">
                      {a.traits}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="tiers" kicker="07" title="Tier table">
              <p>
                Token-gated tiers are computed from your $VT balance at
                read time. They are not enforced on-chain (no NFT) — they're
                a soft access ladder applied by the protocol layer.
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
                        <td className="py-3 px-4 font-mono text-cyan-300">
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
                Vexor Terminal is a static frontend + a thin LLM proxy +
                3 contracts. No indexer required for testnet.
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
  │ Base Sepolia RPC    │   │ Chat API         │
  │ sepolia.base.org    │   │ FastAPI + Groq   │
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
                Live RPC reads happen through public Base endpoints. The chat
                backend is rate-limited and stateless. The protocol layer is
                ~600 lines of audited-pattern Solidity.
              </p>
            </Section>

            <Section id="faq" kicker="09" title="FAQ">
              <div className="space-y-3">
                {FAQ.map((f) => (
                  <details
                    key={f.q}
                    className="group rounded-xl border border-white/10 bg-white/[0.02] open:border-cyan-400/20 open:bg-cyan-500/[0.03] transition-colors"
                  >
                    <summary className="cursor-pointer list-none p-5 flex items-start justify-between gap-4">
                      <span className="font-mono text-white text-sm sm:text-base">
                        {f.q}
                      </span>
                      <span className="font-mono text-cyan-300 text-lg leading-none transition-transform group-open:rotate-45 shrink-0">
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

            <div className="mt-16 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-transparent p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
                  Ready?
                </div>
                <div className="mt-2 font-mono text-2xl text-white">
                  Open the Console.
                </div>
                <div className="mt-1 text-sm text-white/65">
                  Real on-chain transactions on Base Sepolia. Free testnet
                  ETH required.
                </div>
              </div>
              <a
                href="/#console"
                className="inline-flex items-center gap-2 rounded-full bg-cyan-300 text-black px-5 py-2.5 font-mono text-sm hover:bg-cyan-200 transition-colors whitespace-nowrap"
              >
                Launch Console <ArrowRight className="h-4 w-4" />
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
