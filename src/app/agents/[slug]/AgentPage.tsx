"use client";

import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AgentChat } from "@/components/AgentChat";
import { AGENTS, type AgentPersona } from "@/lib/agents";
import Link from "next/link";

export function AgentPage({ agent }: { agent: AgentPersona }) {
  const others = AGENTS.filter((a) => a.slug !== agent.slug);
  return (
    <>
      <Nav />
      <main className="flex-1">
        <section className="relative scroll-mt-24 py-16 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-8">
            <div className="mb-8 flex flex-wrap items-center gap-4">
              <Link
                href="/agents"
                className="font-mono text-xs text-white/55 hover:text-white transition-colors"
              >
                ← All agents
              </Link>
              <span className="text-white/20">·</span>
              <Link
                href="/#chat"
                className="font-mono text-xs text-white/55 hover:text-white transition-colors"
              >
                Use orchestrator instead
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <div
                aria-hidden
                className={`absolute -top-24 -right-24 h-64 w-64 bg-gradient-to-br ${agent.color} rounded-full blur-3xl opacity-70`}
              />
              <div className="relative">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">
                  <span style={{ color: agent.accent }}>●</span>
                  {agent.role} · Dispatch Console
                </div>
                <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight">
                  {agent.name}
                </h1>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-white/55">
                  {agent.title}
                </div>
                <p className="mt-4 max-w-2xl text-white/75 text-base leading-relaxed">
                  {agent.bio}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {agent.traits.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <AgentChat agent={agent} />
            </div>

            <div className="mt-10">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                Other agents
              </div>
              <div className="flex flex-wrap gap-2">
                {others.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/agents/${a.slug}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/25 hover:text-white"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: a.accent }}
                    />
                    <span>{a.name}</span>
                    <span className="font-mono text-[10px] text-white/40 group-hover:text-white/60">
                      {a.role}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
