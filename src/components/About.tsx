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
    title: "Runtime",
    body: "Powered by the Vexor orchestration gateway on Apple Silicon hardware. Always-on, always learning, low-latency dispatch across sub-agents.",
    badge: "Always-on",
  },
  {
    icon: Brain,
    title: "Multi-Model",
    body: "Routes across 9 frontier LLMs — GPT-5.2, Claude Opus 4.5, Gemini 2.5 Pro, Grok 4, Kimi K2.5, Llama 3.1 405B, and more — choosing the right brain for each task.",
    badge: "9 Models",
  },
  {
    icon: Radio,
    title: "Channels",
    body: "Reach Vexor via Telegram, iMessage, Discord, Email, and Farcaster Frames. Allowlist-only elevated access, signed by your wallet.",
    badge: "5 Surfaces",
  },
  {
    icon: Database,
    title: "Memory System",
    body: "Brain-inspired 4-tier memory architecture. Nightly consolidation via the MCE pipeline, salience scoring, and active forgetting to stay sharp.",
    badge: "4-Tier",
  },
  {
    icon: RefreshCw,
    title: "Self-Improvement (ASIA)",
    body: "6 ASIA loops: error recognition, context efficiency, self-diagnosis, tool profiling, knowledge consolidation, and sub-agent performance tracking.",
    badge: "6 Loops",
  },
  {
    icon: Hexagon,
    title: "On-Chain Identity",
    body: "Each Vexor instance is anchored to a Base NFT — agent-owned smart wallet, portable reputation SBTs, and provably persistent memory hashes.",
    badge: "Base · Soon",
    highlight: true,
  },
];

export function About() {
  return (
    <section id="about" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <SectionHeader
          kicker="About Vexor"
          title="An autonomous AI orchestrator — not a chatbot."
          description="Vexor is a self-improving multi-agent system that dispatches work across 9 specialized sub-agents, learns from every task, and lives on-chain on Base."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`group relative bg-background/40 p-7 sm:p-8 ${
                  f.highlight ? "ring-1 ring-inset ring-cyan-400/20" : ""
                }`}
              >
                {f.highlight && (
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-transparent pointer-events-none"
                  />
                )}
                <div className="relative flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                      f.highlight
                        ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
                        : "border-white/10 bg-white/[0.03] text-white/80"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                      f.highlight
                        ? "border-cyan-400/30 text-cyan-300 bg-cyan-500/5"
                        : "border-white/10 text-white/55 bg-white/[0.02]"
                    }`}
                  >
                    {f.badge}
                  </span>
                </div>
                <h3 className="relative mt-6 font-mono text-lg text-white">
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
