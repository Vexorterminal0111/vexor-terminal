"use client";

import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

export function Console() {
  return (
    <section
      id="console"
      className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Coming soon"
          title="Protocol Console."
          description="Unified on-chain dashboard for wallet, staking, and governance on Base. Opens with the $VEXOR token launch."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-10 sm:mt-12 overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3 sm:px-4 py-2 sm:py-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-red-400/70 shrink-0" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-yellow-400/70 shrink-0" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400/70 shrink-0" />
              <span className="ml-2 sm:ml-3 font-mono text-[10px] sm:text-[11px] text-white/60 truncate">
                vexor@console — pending-launch
              </span>
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/40 shrink-0 ml-2">
              COMING SOON
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-14 min-h-[420px] flex flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/[0.06] text-violet-300">
              <Terminal className="h-6 w-6" />
            </div>
            <div className="mt-5 font-mono text-xs uppercase tracking-[0.22em] text-violet-300">
              Pending token launch
            </div>
            <h3 className="mt-3 font-mono text-2xl sm:text-3xl text-white">
              Console opens with the $VEXOR launch.
            </h3>
            <p className="mt-3 max-w-xl text-sm sm:text-[15px] text-white/60 leading-relaxed">
              The on-chain Console — wallet, staking, and governance —
              will be enabled once $VEXOR is deployed and verified on
              Base. Subscribe to launch updates through the channels below.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <a
                href="https://x.com/vexorterminal"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 py-2.5 font-mono text-sm hover:bg-violet-300 transition-colors"
              >
                Follow on X →
              </a>
              <a
                href="https://t.me/VexorAeonWatchtowerbot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/[0.06] px-5 py-2.5 font-mono text-sm text-violet-200 hover:text-white hover:border-violet-300/50 transition-colors"
              >
                Watchtower bot →
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
