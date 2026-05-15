"use client";

const items = [
  "ORCHESTRATOR ONLINE",
  "9 SUB-AGENTS",
  "$VEXOR ON BASE · SOON",
  "ALWAYS LEARNING",
  "MULTI-MODEL",
  "TOKEN-GATED ACCESS",
  "STAKE · EARN · GOVERN",
  "REVENUE SHARE",
  "SELF-IMPROVING",
];

export function Marquee() {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-white/[0.015]">
      <div className="flex marquee-track whitespace-nowrap py-3">
        {doubled.map((text, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-6 font-mono text-[11px] uppercase tracking-[0.22em] text-white/55"
          >
            <span>{text}</span>
            <span className="text-cyan-300/60">◇</span>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
