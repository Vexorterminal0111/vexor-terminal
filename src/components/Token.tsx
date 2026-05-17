"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Coins, Lock, Vote, Sparkles, Copy, Check, ExternalLink } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const VT_ADDRESS = "0x2c684D666998436634EcEde1527EdA7975427Ba3";
const VT_BASESCAN = `https://basescan.org/address/${VT_ADDRESS}`;
const VT_DEXSCREENER = `https://dexscreener.com/base/${VT_ADDRESS}`;
// Deepest VT/WETH pool (Uniswap v4 on Base). GeckoTerminal renders v4 candles reliably;
// DexScreener's chart aggregator was stuck on "No data here" for this very new pool.
const VT_POOL = "0xf398631aaecded97003cba4e9ed2a1b30885c863fd328e56029c9da757f2c1f0";
const VT_CHART_EMBED = `https://www.geckoterminal.com/base/pools/${VT_POOL}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0`;

const utility = [
  {
    icon: Coins,
    title: "Pay for Runtime",
    body: "Every Vexor task burns $VT. Premium chat, priority dispatch, and dedicated sub-agent slots are all priced in $VT.",
  },
  {
    icon: Lock,
    title: "Stake to Earn",
    body: "Lock $VT and receive a pro-rata share of all task revenue. Longer locks earn higher multipliers.",
  },
  {
    icon: Vote,
    title: "Governance",
    body: "$VT holders vote on new sub-agents, model whitelisting, treasury spend, and protocol upgrades.",
  },
  {
    icon: Sparkles,
    title: "Token-Gated Access",
    body: "Holding above a threshold unlocks elevated tiers — private channels, beta sub-agents, and revenue dashboards.",
  },
];

const stats = [
  { label: "Token", value: "$VT" },
  { label: "Standard", value: "ERC-20" },
  { label: "Network", value: "Base" },
  { label: "Supply", value: "100B" },
];

export function Token() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(VT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (older browser / insecure context)
    }
  };

  return (
    <section id="token" className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Tokenomics"
          title="$VT — the economy that runs the orchestrator."
          description="The Vexor Terminal economy is governed entirely by $VT. Holders pay for runtime, earn from revenue, and steer protocol direction."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-10 sm:mt-12 relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.06] via-white/[0.02] to-transparent p-6 sm:p-8 lg:p-10"
        >
          <div
            aria-hidden
            className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                Live on Base · Mainnet
              </div>
              <div className="mt-4 sm:mt-5 font-mono text-4xl sm:text-5xl md:text-6xl text-white leading-none">
                $VT
              </div>
              <p className="mt-4 max-w-xl text-sm sm:text-[15px] text-white/65 leading-relaxed">
                The native ERC-20 token of the Vexor Terminal protocol on
                Base mainnet. $VT is the unit of account for runtime, staking,
                and governance — 100B total supply, 18 decimals.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:max-w-md">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                    {s.label}
                  </div>
                  <div className="mt-1 font-mono text-base sm:text-xl text-white">
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-6 sm:mt-8 rounded-xl border border-cyan-400/30 bg-cyan-500/[0.06] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
                Contract address · Base mainnet
              </div>
              <a
                href={VT_BASESCAN}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:text-white transition-colors"
              >
                Basescan
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <code className="flex-1 font-mono text-xs sm:text-sm md:text-base text-white break-all bg-black/40 rounded-md border border-white/10 px-3 py-2.5 select-all">
                {VT_ADDRESS}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy $VT contract address"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2.5 font-mono text-[11px] uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/20 hover:text-white transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-6 sm:mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 px-4 sm:px-5 py-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              Live price · $VT / WETH · Base
            </div>
            <a
              href={VT_DEXSCREENER}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-cyan-300 hover:text-white transition-colors"
            >
              Open in DexScreener
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
            <iframe
              src={VT_CHART_EMBED}
              title="$VT live price chart on GeckoTerminal"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0 bg-black"
              allow="clipboard-write"
            />
          </div>
        </motion.div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {utility.map((u, i) => {
            const Icon = u.icon;
            return (
              <motion.div
                key={u.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group relative bg-background/40 p-5 sm:p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 sm:mt-5 font-mono text-base sm:text-lg text-white">{u.title}</h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">
                  {u.body}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 sm:mt-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              Disclaimer
            </div>
            <p className="mt-2 max-w-2xl text-sm text-white/55 leading-relaxed">
              $VT is a utility token for the Vexor Terminal protocol. It is
              not a security, an investment, or a promise of return. The
              interactive console runs on Base Sepolia testnet during beta —
              staking and governance will migrate to mainnet alongside
              production launch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="#console"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 text-black px-5 py-2.5 font-mono text-sm hover:bg-cyan-200 transition-colors whitespace-nowrap"
            >
              Open Console →
            </a>
            <a
              href="/docs.html"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 font-mono text-sm text-white/80 hover:text-white hover:border-white/30 transition-colors whitespace-nowrap"
            >
              Read Docs
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
