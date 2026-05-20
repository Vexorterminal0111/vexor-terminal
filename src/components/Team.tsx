"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

function GithubIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.97c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.05.78 2.12v3.14c0 .31.21.68.8.56 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function XIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

type Agent = {
  name: string;
  role: string;
  title: string;
  traits: string[];
  color: string;
};

type Contributor = {
  name: string;
  handle: string;
  role: string;
  avatar: string;
  github?: string;
  x?: string;
};

const contributors: Contributor[] = [
  {
    name: "Cedric Ronvel",
    handle: "cronvel",
    role: "Contributor",
    avatar: "https://github.com/cronvel.png?size=240",
    github: "https://github.com/cronvel",
    x: "https://x.com/Cedricronvel",
  },
];

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

        <div className="mt-20 sm:mt-24 lg:mt-28">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                Humans behind the agents
              </div>
              <div className="mt-1 font-mono text-base sm:text-lg text-white">
                Core contributors
              </div>
            </div>
            <div className="hidden sm:block font-mono text-[10px] uppercase tracking-widest text-white/40">
              {contributors.length.toString().padStart(2, "0")} active
            </div>
          </div>

          <div className="mt-5 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {contributors.map((c, i) => (
              <motion.div
                key={c.handle}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <Image
                    src={c.avatar}
                    alt={`${c.name} avatar`}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 rounded-full border border-white/10 bg-white/5 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                      Contributor · {(i + 1).toString().padStart(2, "0")}
                    </div>
                    <div className="mt-1 font-mono text-base sm:text-lg text-white truncate">
                      {c.name}
                    </div>
                    <div className="mt-0.5 text-xs text-cyan-300/90 font-mono truncate">
                      @{c.handle} · {c.role}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {c.github && (
                    <a
                      href={c.github}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${c.name} on GitHub`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white hover:border-white/20 transition-colors"
                    >
                      <GithubIcon />
                      GitHub
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                  {c.x && (
                    <a
                      href={c.x}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${c.name} on X`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white hover:border-white/20 transition-colors"
                    >
                      <XIcon />
                      X / Twitter
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
