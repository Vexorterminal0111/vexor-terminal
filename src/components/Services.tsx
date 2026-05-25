"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const services = [
  {
    title: "Protocol Console",
    body: "Wallet-connected dashboard for $VEXOR staking, governance, and tier status. Opens with the $VEXOR token launch on Base.",
    cta: "View console",
    href: "#console",
    badge: "Coming soon",
    highlight: true,
  },
  {
    title: "Orchestrator chat",
    body: "Wallet-gated orchestrator chat. Each prompt is dispatched to one of nine sub-agents. Hosted Llama 3.3 70B during the pre-launch phase.",
    cta: "Open chat",
    href: "#chat",
    badge: "Beta",
  },
  {
    title: "Documentation",
    body: "Architecture, planned token economy, sub-agent reference, and tier table. Detailed protocol design.",
    cta: "View docs",
    href: "/docs.html",
  },
];

export function Services() {
  return (
    <section
      id="services"
      className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Services"
          title="Deployment options."
          description="Use Vexor as a personal orchestrator, integrate agentic workflows into existing stacks, or hold $VEXOR for protocol exposure."
        />

        <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {services.map((s, i) => (
            <motion.a
              key={s.title}
              href={s.href}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className={`group relative overflow-hidden rounded-2xl p-5 sm:p-7 border transition-colors ${
                s.highlight
                  ? "border-violet-400/30 bg-gradient-to-br from-violet-500/[0.07] via-white/[0.02] to-transparent hover:border-violet-400/50"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              {s.badge && (
                <span
                  className={`absolute top-4 right-4 sm:top-5 sm:right-5 font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                    s.highlight
                      ? "border-violet-400/30 text-violet-300 bg-violet-500/10"
                      : "border-white/10 text-white/55 bg-white/[0.02]"
                  }`}
                >
                  {s.badge}
                </span>
              )}

              <h3 className="font-mono text-xl sm:text-2xl text-white pr-16">{s.title}</h3>
              <p className="mt-2.5 sm:mt-3 text-sm text-white/65 leading-relaxed md:min-h-[5rem]">
                {s.body}
              </p>

              <span className="mt-5 sm:mt-6 inline-flex items-center gap-1.5 font-mono text-sm text-violet-300 group-hover:gap-2 transition-all">
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
