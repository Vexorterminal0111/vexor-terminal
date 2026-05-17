"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";

const stats = [
  { value: "9", label: "Sub-Agents" },
  { value: "9", label: "LLM Models" },
  { value: "6", label: "ASIA Systems" },
  { value: "5", label: "Channels" },
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-24 pb-20 sm:pt-36 sm:pb-32">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid mask-radial opacity-70" aria-hidden />
      {/* Radial gradient glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[60vh] bg-cyan-500/20 blur-[160px] rounded-full"
      />
      {/* Bottom fade */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background pointer-events-none"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
          Vexor.Terminal · v0.1.0 · $VT launching on Base
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mt-5 sm:mt-6 font-mono text-[2.6rem] xs:text-5xl sm:text-7xl md:text-8xl lg:text-[8.5rem] leading-[0.95] tracking-tight break-words"
        >
          I&apos;m{" "}
          <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
            Vexor
          </span>
          <span className="text-cyan-300 caret">_</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="mt-6 sm:mt-8 max-w-2xl text-[15px] sm:text-lg md:text-xl text-white/70 leading-relaxed"
        >
          An autonomous AI orchestrator commanding{" "}
          <span className="text-white font-medium">9 specialized sub-agents</span>{" "}
          across 9 large language models. Not a chatbot, not an assistant — a
          self-improving multi-agent system powered by{" "}
          <span className="text-cyan-300">$VT</span> on{" "}
          <span className="text-cyan-300">Base</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
          className="mt-8 sm:mt-10 flex flex-wrap items-center gap-2.5 sm:gap-3"
        >
          <a
            href="#console"
            className="group inline-flex items-center gap-2 rounded-full bg-white text-black px-4 sm:px-5 py-2.5 sm:py-3 font-mono text-xs sm:text-sm hover:bg-cyan-300 transition-colors"
          >
            Launch Console
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="/docs.html"
            className="group inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] px-4 sm:px-5 py-2.5 sm:py-3 font-mono text-xs sm:text-sm text-cyan-200 hover:text-white hover:border-cyan-300/50 transition-colors"
          >
            Read Docs
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#about"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-4 sm:px-5 py-2.5 sm:py-3 font-mono text-xs sm:text-sm text-white/80 hover:text-white hover:border-white/30 transition-colors"
          >
            Discover More
            <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-y-0.5" />
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className="relative bg-background/40 px-4 py-5 sm:px-6 sm:py-7 flex flex-col gap-1"
            >
              <div className="font-mono text-3xl sm:text-4xl md:text-5xl tracking-tight text-white">
                {s.value}
              </div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-white/55">
                {s.label}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 group-hover:opacity-100"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
