"use client";

import { motion } from "framer-motion";
import { Coins, Lock, Vote, Sparkles } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const utility = [
  {
    icon: Coins,
    title: "Pay for Runtime",
    body: "Every Vexor task will burn $VEXOR. Premium chat, priority dispatch, and dedicated sub-agent slots will all be priced in $VEXOR.",
  },
  {
    icon: Lock,
    title: "Stake to Earn",
    body: "Lock $VEXOR to receive a pro-rata share of all task revenue. Longer locks will earn higher multipliers.",
  },
  {
    icon: Vote,
    title: "Governance",
    body: "$VEXOR holders will vote on new sub-agents, model whitelisting, treasury spend, and protocol upgrades.",
  },
  {
    icon: Sparkles,
    title: "Token-Gated Access",
    body: "Holding above a threshold will unlock elevated tiers — private channels, beta sub-agents, and revenue dashboards.",
  },
];

const stats = [
  { label: "Token", value: "$VEXOR" },
  { label: "Standard", value: "ERC-20" },
  { label: "Network", value: "Base" },
  { label: "Supply", value: "100B" },
];

export function Token() {
  return (
    <section id="token" className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Tokenomics"
          title="$VEXOR — the economy that will run the orchestrator."
          description="The Vexor Terminal economy will be governed entirely by $VEXOR. Holders will pay for runtime, earn from revenue, and steer protocol direction."
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
                Coming soon · Base
              </div>
              <div className="mt-4 sm:mt-5 font-mono text-4xl sm:text-5xl md:text-6xl text-white leading-none">
                $VEXOR
              </div>
              <p className="mt-4 max-w-xl text-sm sm:text-[15px] text-white/65 leading-relaxed">
                The native ERC-20 utility token planned for the Vexor
                Terminal protocol on Base. $VEXOR will be the unit of
                account for runtime, staking, and governance — 100B
                planned supply, 18 decimals.
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

          <div className="relative mt-6 sm:mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              $VEXOR token launch
            </div>
            <div className="mt-2 font-mono text-sm sm:text-base text-white">
              Coming soon
            </div>
            <p className="mt-2 max-w-2xl mx-auto text-xs sm:text-sm text-white/55 leading-relaxed">
              The $VEXOR contract has not been published yet. Follow{" "}
              <a
                href="https://x.com/vexorterminal"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 hover:text-white transition-colors"
              >
                @vexorterminal
              </a>{" "}
              or the{" "}
              <a
                href="https://t.me/VexorAeonWatchtowerbot"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 hover:text-white transition-colors"
              >
                Watchtower bot
              </a>{" "}
              for the launch announcement.
            </p>
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
              $VEXOR is a utility token planned for the Vexor Terminal
              protocol. It is not a security, an investment, or a promise
              of return. The token, staking, and on-chain governance are
              not yet live — this page describes the design that will
              ship at launch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
