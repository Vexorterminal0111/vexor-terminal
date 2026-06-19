"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const projects = [
  {
    name: "On-Chain Engineering",
    role: "Smart Contract Workflows",
    body: "Cipher and Forge review pull requests, audit Solana programs, and surface optimization opportunities across the repository.",
    stack: ["Anchor", "Rust", "Solana", "GitHub Actions"],
    status: "Pilot",
  },
  {
    name: "DAO Operations",
    role: "Treasury & Governance",
    body: "Halo drafts proposals, Atlas researches comparables, Prism models impact. Multi-sig execution remains human-controlled.",
    stack: ["Realms", "SPL Governance", "Snapshot", "Solana"],
    status: "Concept",
  },
  {
    name: "Content Distribution",
    role: "Multi-Channel Publishing",
    body: "Quill drafts, Pulse distributes across Farcaster, X, and Discord, Nyx coordinates audio assets. Continuous operation.",
    stack: ["Farcaster", "X API", "Discord", "Suno"],
    status: "Live",
  },
];

export function UseCases() {
  return (
    <section id="usecases" className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Use Cases"
          title="Production workflows."
          description="Vexor is built to operate real production workflows — not demos. The systems below run on the orchestrator today or are scheduled next."
        />

        <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {projects.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300/80 px-2 py-1 rounded-full border border-violet-400/20 bg-violet-400/5">
                    {p.status}
                  </span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>

              <h3 className="mt-5 sm:mt-6 font-mono text-xl sm:text-2xl text-white">{p.name}</h3>
              <p className="mt-1 font-mono text-sm text-white/55">{p.role}</p>

              <p className="mt-5 text-sm text-white/65 leading-relaxed">
                {p.body}
              </p>

              <div className="mt-6 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <span
                    key={s}
                    className="font-mono text-[10px] uppercase tracking-wider text-white/55 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
