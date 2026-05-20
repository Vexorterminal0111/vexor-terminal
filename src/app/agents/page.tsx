import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AGENTS } from "@/lib/agents";

export const metadata: Metadata = {
  title: "Sub-Agents — Dispatch Console",
  description:
    "Chat directly with one of the 9 Vexor sub-agents — each with its own specialization, voice, and system prompt. Wallet-gated on Base.",
};

export default function AgentsIndexPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <section className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <div className="mb-8">
              <Link
                href="/#team"
                className="font-mono text-xs text-white/55 hover:text-white transition-colors"
              >
                ← Back to landing
              </Link>
            </div>

            <div className="max-w-3xl">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/85">
                Dispatch Console
              </div>
              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight">
                Pick an agent. Talk directly.
              </h1>
              <p className="mt-4 text-white/65 text-base sm:text-lg leading-relaxed">
                Vexor normally routes for you. Sometimes you want the specialist
                straight away. Click a card to open a dedicated chat with that
                sub-agent — same wallet gate, same retry logic, but the system
                prompt is wired to that persona.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {AGENTS.map((a, i) => (
                <Link
                  key={a.slug}
                  href={`/agents/${a.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 hover:border-white/20 transition-colors"
                >
                  <div
                    aria-hidden
                    className={`absolute -top-20 -right-20 h-48 w-48 bg-gradient-to-br ${a.color} rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity`}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-white/55">
                        {a.role}
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <div className="text-xl font-medium tracking-tight">
                        {a.name}
                      </div>
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: a.accent }}
                      />
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-white/45">
                      {a.title}
                    </div>
                    <p className="mt-4 text-sm text-white/70 leading-relaxed">
                      {a.pitch}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {a.traits.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/55">
                        /agents/{a.slug}
                      </span>
                      <span
                        className="font-mono text-[10px] uppercase tracking-widest transition-colors"
                        style={{ color: a.accent }}
                      >
                        Dispatch →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                How dispatch works
              </div>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                Each agent shares the same Vexor orchestrator backbone — Groq
                inference, retries, wallet-gated rate limit. The difference is
                the system prompt: when you open <code>/agents/cipher</code>,
                requests carry an <code>agent=&quot;cipher&quot;</code> field
                that swaps in the Cipher persona suffix (coding specialist,
                fenced code blocks, test-plan after every snippet). Same for
                every other agent. If you want general orchestration instead,
                use the <Link href="/#chat" className="underline decoration-white/30 hover:decoration-white">main chat</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
