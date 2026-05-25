"use client";

import { motion } from "framer-motion";

type Stat = {
  value: string;
  label: string;
  hint?: string;
};

const STATS: Stat[] = [
  { value: "9", label: "Sub-Agents" },
  { value: "—", label: "RevShare APR", hint: "coming soon" },
  { value: "—", label: "Pool TVL", hint: "coming soon" },
  { value: "—", label: "$VT Price", hint: "coming soon" },
];

export function HeroStats() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
      className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
    >
      {STATS.map((s, i) => (
        <div
          key={i}
          className="group relative bg-background/40 px-4 py-5 sm:px-6 sm:py-7 flex flex-col gap-1"
        >
          <div className="flex items-baseline gap-2">
            <div className="font-mono text-3xl sm:text-4xl md:text-5xl tracking-tight text-white">
              {s.value}
            </div>
          </div>
          <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-white/55">
            {s.label}
          </div>
          {s.hint && (
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/30">
              {s.hint}
            </div>
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 group-hover:opacity-100"
          />
        </div>
      ))}
    </motion.div>
  );
}
