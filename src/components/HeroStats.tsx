"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchPoolSummary, formatVtCompact, type PoolSummary } from "@/lib/revshare";

const AUTO_REFRESH_MS = 300_000; // 5 min

type Stat = {
  value: string;
  label: string;
  hint?: string;
};

const FALLBACK: Stat[] = [
  { value: "9", label: "Sub-Agents" },
  { value: "—", label: "RevShare APR" },
  { value: "—", label: "Pool TVL" },
  { value: "—", label: "$VT Price" },
];

function formatApr(apr: number | null): string {
  if (apr === null || !isFinite(apr)) return "—";
  if (apr >= 1000) return apr.toFixed(0) + "%";
  return apr.toFixed(1) + "%";
}

function formatPrice(p: number | null): string {
  if (p === null) return "—";
  if (p < 0.000001) return "$" + p.toExponential(2);
  if (p < 0.01) return "$" + p.toFixed(8);
  if (p < 1) return "$" + p.toFixed(4);
  return "$" + p.toFixed(2);
}

export function HeroStats() {
  const [stats, setStats] = useState<Stat[]>(FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      try {
        const s: PoolSummary = await fetchPoolSummary();
        if (cancelled) return;
        setStats([
          { value: "9", label: "Sub-Agents" },
          { value: formatApr(s.estimatedApr), label: "RevShare APR", hint: "annualized last window" },
          { value: formatVtCompact(s.totalStaked), label: "Pool TVL ($VT)" },
          { value: formatPrice(s.vtPriceUsd), label: "$VT Price" },
        ]);
        setLive(true);
      } catch {
        // keep fallback
      }
    };

    void run();
    intervalId = setInterval(() => void run(), AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
      className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="group relative bg-background/40 px-4 py-5 sm:px-6 sm:py-7 flex flex-col gap-1"
        >
          <div className="flex items-baseline gap-2">
            <div className="font-mono text-3xl sm:text-4xl md:text-5xl tracking-tight text-white">
              {s.value}
            </div>
            {live && i > 0 && (
              <span
                aria-label="live"
                className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.7)] pulse-dot"
              />
            )}
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
