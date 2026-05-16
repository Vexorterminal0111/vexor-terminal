"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

type Agent = {
  name: string;
  role: string;
  title: string;
  traits: string[];
  color: string;
};

const agents: Agent[] = [
  {
    name: "Cipher",
    role: "Coder",
    title: "Senior Software Engineer",
    traits: ["detail-oriented", "efficient", "test-driven"],
    color: "from-cyan-500/30 to-cyan-500/0",
  },
  {
    name: "Atlas",
    role: "Researcher",
    title: "Knowledge & Market Analyst",
    traits: ["curious", "analytical", "thorough"],
    color: "from-violet-500/30 to-violet-500/0",
  },
  {
    name: "Quill",
    role: "Writer",
    title: "Technical & Creative Content",
    traits: ["articulate", "creative", "meticulous"],
    color: "from-rose-500/30 to-rose-500/0",
  },
  {
    name: "Forge",
    role: "DevOps",
    title: "Infrastructure & Deployment",
    traits: ["security-focused", "methodical", "proactive"],
    color: "from-orange-500/30 to-orange-500/0",
  },
  {
    name: "Vector",
    role: "Designer",
    title: "UI/UX & Visual Systems",
    traits: ["creative", "systematic", "user-centric"],
    color: "from-emerald-500/30 to-emerald-500/0",
  },
  {
    name: "Pulse",
    role: "SMM",
    title: "Distribution & Engagement",
    traits: ["strategic", "social", "trend-aware"],
    color: "from-pink-500/30 to-pink-500/0",
  },
  {
    name: "Halo",
    role: "Scrum Master",
    title: "Data-Driven Project Management",
    traits: ["observant", "resilient", "systematic"],
    color: "from-amber-500/30 to-amber-500/0",
  },
  {
    name: "Prism",
    role: "Analytics",
    title: "Data Analysis & Growth Strategy",
    traits: ["strategic", "analytical", "insightful"],
    color: "from-sky-500/30 to-sky-500/0",
  },
  {
    name: "Nyx",
    role: "Music Producer",
    title: "Audio & Distribution Coordination",
    traits: ["visionary", "organized", "upbeat"],
    color: "from-fuchsia-500/30 to-fuchsia-500/0",
  },
];

export function Team() {
  return (
    <section id="team" className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="The Team"
          title="9 sub-agents. One terminal."
          description="Vexor dispatches tasks to specialized sub-agents. Each has a personality, a role, and a verifiable performance record on-chain."
        />

        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {agents.map((a, i) => (
            <motion.a
              key={a.name}
              href={`#${a.name.toLowerCase()}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.05 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 hover:border-white/20 transition-colors"
            >
              <div
                aria-hidden
                className={`absolute -top-20 -right-20 h-48 w-48 bg-gradient-to-br ${a.color} rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity`}
              />
              <div className="relative flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                    Sub-Agent · 0{i + 1}
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl text-white">
                    {a.name}
                  </div>
                  <div className="mt-1 text-sm text-cyan-300/90 font-mono">
                    {a.role}
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>

              <p className="relative mt-5 text-sm text-white/65 leading-relaxed">
                {a.title}
              </p>

              <div className="relative mt-5 flex flex-wrap gap-1.5">
                {a.traits.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[10px] uppercase tracking-wider text-white/50 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03]"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="relative mt-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-white/40">
                <span>Tasks · 0</span>
                <span>Rep · —</span>
                <span className="text-cyan-300/80">View profile →</span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
