"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const services = [
  {
    title: "Get Vexor",
    body: "Deploy Vexor as your own autonomous AI orchestrator. Handle workflows, research, and execution on autopilot.",
    cta: "Get started",
    href: "#get-vexor",
    highlight: true,
  },
  {
    title: "Mint Vexor NFT",
    body: "Anchor your Vexor instance on-chain. Agent-owned smart wallet, portable reputation, and provably persistent memory on Base.",
    cta: "Join waitlist",
    href: "#waitlist",
    badge: "Soon",
  },
  {
    title: "Vexor API",
    body: "Plug Vexor's orchestrator + 9 sub-agents into your own product. Streaming responses, tool calls, and on-chain payment ready.",
    cta: "Read docs",
    href: "#docs",
    badge: "Beta",
  },
];

export function Services() {
  return (
    <section
      id="services"
      className="relative scroll-mt-24 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <SectionHeader
          kicker="Services"
          title="Ways to deploy Vexor."
          description="Whether you want a personal orchestrator or you&apos;re building agentic features into your own product — Vexor scales with you."
        />

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          {services.map((s, i) => (
            <motion.a
              key={s.title}
              href={s.href}
              id={s.href === "#get-vexor" ? "get-vexor" : undefined}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className={`group relative overflow-hidden rounded-2xl p-7 border transition-colors ${
                s.highlight
                  ? "border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.07] via-white/[0.02] to-transparent hover:border-cyan-400/50"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              {s.badge && (
                <span
                  className={`absolute top-5 right-5 font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                    s.highlight
                      ? "border-cyan-400/30 text-cyan-300 bg-cyan-500/10"
                      : "border-white/10 text-white/55 bg-white/[0.02]"
                  }`}
                >
                  {s.badge}
                </span>
              )}

              <h3 className="font-mono text-2xl text-white">{s.title}</h3>
              <p className="mt-3 text-sm text-white/65 leading-relaxed min-h-[5rem]">
                {s.body}
              </p>

              <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-sm text-cyan-300 group-hover:gap-2 transition-all">
                {s.cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
