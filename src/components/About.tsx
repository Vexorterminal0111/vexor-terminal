"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Brain,
  Radio,
  Database,
  RefreshCw,
  Hexagon,
} from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const features = [
  {
    icon: Zap,
    title: "Orchestration Runtime",
    body: "Persistent orchestration gateway on dedicated Apple Silicon hardware. Low-latency dispatch across all nine sub-agents.",
    badge: "Always-on",
  },
  {
    icon: Brain,
    title: "Multi-Model Routing",
    body: "Routes across nine frontier LLMs — GPT-5.2, Claude Opus 4.5, Gemini 2.5 Pro, Grok 4, Kimi K2.5, Llama 3.1 405B, and more. Model selection is governed per task.",
    badge: "9 Models",
  },
  {
    icon: Radio,
    title: "Channels",
    body: "Telegram, iMessage, Discord, email, and Farcaster Frames. Elevated access is wallet-scoped and allowlist-controlled.",
    badge: "5 Surfaces",
  },
  {
    icon: Database,
    title: "Memory System",
    body: "Four-tier memory architecture with nightly consolidation, salience scoring, and active forgetting.",
    badge: "4-Tier",
  },
  {
    icon: RefreshCw,
    title: "Closed-Loop Improvement",
    body: "Six subsystems track error recognition, context efficiency, self-diagnosis, tool profiling, knowledge consolidation, and sub-agent performance.",
    badge: "6 Loops",
  },
  {
    icon: Hexagon,
    title: "$VEXOR Token",
    body: "Native ERC-20 utility token planned for Base. Holding $VEXOR unlocks elevated tiers; staking returns a pro-rata share of protocol revenue.",
    badge: "Coming soon",
    highlight: true,
  },
];

export function About() {
  return (
    <section id="about" className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Platform"
          title="An orchestration platform for on-chain workflows."
          description="Vexor coordinates nine specialized sub-agents across nine large language models. Every task is routed to the appropriate model, executed under wallet-scoped access, and accounted in the $VEXOR token economy on Base."
        />

        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`group relative bg-background/40 p-5 sm:p-7 lg:p-8 ${
                  f.highlight ? "ring-1 ring-inset ring-violet-400/20" : ""
                }`}
              >
                {f.highlight && (
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-transparent pointer-events-none"
                  />
                )}
                <div className="relative flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                      f.highlight
                        ? "border-violet-400/30 bg-violet-500/10 text-violet-300"
                        : "border-white/10 bg-white/[0.03] text-white/80"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                      f.highlight
                        ? "border-violet-400/30 text-violet-300 bg-violet-500/5"
                        : "border-white/10 text-white/55 bg-white/[0.02]"
                    }`}
                  >
                    {f.badge}
                  </span>
                </div>
                <h3 className="relative mt-5 sm:mt-6 font-mono text-base sm:text-lg text-white">
                  {f.title}
                </h3>
                <p className="relative mt-2 text-sm text-white/60 leading-relaxed">
                  {f.body}
                </p>
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
