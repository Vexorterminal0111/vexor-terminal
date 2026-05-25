"use client";

const items = [
  "ORCHESTRATION LAYER",
  "NINE SUB-AGENTS",
  "$VEXOR · BASE · COMING SOON",
  "CONTINUOUS LEARNING",
  "MULTI-MODEL ROUTING",
  "TOKEN-GATED ACCESS",
  "STAKE · EARN · VOTE",
  "REVENUE DISTRIBUTION",
  "CLOSED-LOOP IMPROVEMENT",
];

export function Marquee() {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-white/[0.015]">
      <div className="flex marquee-track whitespace-nowrap py-3">
        {doubled.map((text, i) => (
          <div
            key={i}
            className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-white/55"
          >
            <span>{text}</span>
            <span className="text-violet-300/60">◇</span>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
