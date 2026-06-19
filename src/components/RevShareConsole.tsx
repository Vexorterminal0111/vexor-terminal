"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

export function RevShareConsole() {
  return (
    <section
      id="revshare"
      className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32 border-t border-white/5"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Coming soon"
          title="Revenue Share."
          description="Single-sided $VEXOR staking on Solana. No lock, no tier — withdraw any time. Pool rewards are funded from protocol revenue and distributed pro-rata to stakers."
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
                vexor@revshare — pending-launch
              </span>
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/40 shrink-0 ml-2">
              COMING SOON
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-14 min-h-[420px] flex flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/[0.06] text-violet-300">
              <Lock className="h-6 w-6" />
            </div>
            <div className="mt-5 font-mono text-xs uppercase tracking-[0.22em] text-violet-300">
              Pending token launch
            </div>
            <h3 className="mt-3 font-mono text-2xl sm:text-3xl text-white">
              RevShare staking opens with the $VEXOR launch.
            </h3>
            <p className="mt-3 max-w-xl text-sm sm:text-[15px] text-white/60 leading-relaxed">
              The single-sided $VEXOR staking pool will deploy alongside
              the $VEXOR token. Stakers will receive a pro-rata share of
              every orchestrator task fee — flat staking, no lock,
              withdraw any time.
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
