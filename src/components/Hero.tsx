"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { HeroStats } from "./HeroStats";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-24 pb-20 sm:pt-36 sm:pb-32">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid mask-radial opacity-70" aria-hidden />
      {/* Radial gradient glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[60vh] bg-violet-500/20 blur-[160px] rounded-full"
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
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
          Vexor Terminal · v0.1.0 · $VEXOR launching on Base
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mt-5 sm:mt-6 font-mono text-[2.6rem] xs:text-5xl sm:text-7xl md:text-8xl lg:text-[8.5rem] leading-[0.95] tracking-tight break-words"
        >
          <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
            Vexor
          </span>
          <span className="text-violet-300">.</span>
          <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
            Terminal
          </span>
          <span className="text-violet-300 caret">_</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="mt-6 sm:mt-8 max-w-2xl text-[15px] sm:text-lg md:text-xl text-white/70 leading-relaxed"
        >
          Programmable AI orchestration on Base. Vexor coordinates{" "}
          <span className="text-white font-medium">nine specialized sub-agents</span>{" "}
          across nine large language models, with model selection,
          wallet-scoped access, and accounting governed by the{" "}
          <span className="text-violet-300">$VEXOR</span> token on{" "}
          <span className="text-violet-300">Base</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
          className="mt-8 sm:mt-10 flex flex-wrap items-center gap-2.5 sm:gap-3"
        >
          <a
            href="#console"
            className="group inline-flex items-center gap-2 rounded-full bg-white text-black px-4 sm:px-5 py-2.5 sm:py-3 font-mono text-xs sm:text-sm hover:bg-violet-300 transition-colors"
          >
            Launch Console
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="/docs.html"
            className="group inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/[0.06] px-4 sm:px-5 py-2.5 sm:py-3 font-mono text-xs sm:text-sm text-violet-200 hover:text-white hover:border-violet-300/50 transition-colors"
          >
            Read Docs
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#about"
            className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-4 sm:px-5 py-2.5 sm:py-3 font-mono text-xs sm:text-sm text-white/80 hover:text-white hover:border-white/30 transition-colors"
          >
            Learn more
            <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-y-0.5" />
          </a>
        </motion.div>

        {/* Stats — 1 static + 3 live (APR / Pool TVL / $VEXOR Price) */}
        <HeroStats />
      </div>
    </section>
  );
}
