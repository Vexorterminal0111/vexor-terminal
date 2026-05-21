"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { INTEL_TOKENS } from "@/lib/intel-tokens";

const AUTO_REFRESH_MS = 120_000; // 2 min

type IntelItem = {
  title?: string;
  body?: string;
  url?: string;
};

type IntelSkill = {
  skill: string;
  title?: string;
  summary?: string;
  markdown?: string;
  produced_at?: string;
  run_id?: string | number;
  items?: IntelItem[];
};

type IntelPayload = {
  schema_version?: string;
  generated_at?: string;
  next_run_at?: string;
  source?: string;
  skills?: IntelSkill[];
};

type PremiumEntry = {
  slug?: string;
  symbol?: string;
  name?: string;
  ca?: string;
  network?: string;
  host?: boolean;
  blurb?: string | null;
  summary?: string | null;
  produced_at?: string;
  price_usd?: number | null;
  price_change_24h_pct?: number;
  volume_24h_usd?: number;
  liquidity_usd?: number;
  fdv_usd?: number;
};

type PremiumIndex = {
  schema_version?: string;
  generated_at?: string;
  next_run_at?: string | null;
  source?: string;
  tokens?: PremiumEntry[];
};

const CARD_ORDER: ReadonlyArray<{ slug: string; label: string; kicker: string; accent: string; gradient: string }> = [
  {
    slug: "morning-brief",
    label: "Morning Brief",
    kicker: "Top 3 priority items",
    accent: "#22d3ee",
    gradient: "from-cyan-400/40 via-cyan-500/20 to-transparent",
  },
  {
    slug: "token-report",
    label: "Token Pulse",
    kicker: "$VT + benchmark snapshot",
    accent: "#a78bfa",
    gradient: "from-violet-400/40 via-purple-500/20 to-transparent",
  },
  {
    slug: "on-chain-monitor",
    label: "On-Chain Pulse",
    kicker: "Stake / claim / reward events",
    accent: "#34d399",
    gradient: "from-emerald-400/40 via-emerald-500/20 to-transparent",
  },
  {
    slug: "defi-overview",
    label: "DeFi Overview",
    kicker: "Base ecosystem TVL snapshot",
    accent: "#f59e0b",
    gradient: "from-amber-400/40 via-amber-500/20 to-transparent",
  },
  {
    slug: "evening-recap",
    label: "Evening Recap",
    kicker: "What moved today",
    accent: "#f472b6",
    gradient: "from-pink-400/40 via-pink-500/20 to-transparent",
  },
];

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 0) {
    const ahead = Math.abs(diffSec);
    if (ahead < 60) return `in ${ahead}s`;
    if (ahead < 3600) return `in ${Math.round(ahead / 60)}m`;
    if (ahead < 86400) return `in ${Math.round(ahead / 3600)}h`;
    return `in ${Math.round(ahead / 86400)}d`;
  }
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

export function IntelFeed() {
  const [payload, setPayload] = useState<IntelPayload | null>(null);
  const [premium, setPremium] = useState<PremiumIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [intelRes, premiumRes] = await Promise.all([
          fetch("/api/intel", { cache: "no-store" }),
          fetch("/api/intel/index", { cache: "no-store" }),
        ]);
        if (!intelRes.ok) throw new Error(`HTTP ${intelRes.status}`);
        const data: IntelPayload = await intelRes.json();
        const idx: PremiumIndex = premiumRes.ok
          ? await premiumRes.json()
          : { tokens: [] };
        if (cancelled) return;
        setPayload(data);
        setPremium(idx);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    const id = setInterval(() => void run(), AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshTick]);

  const bySlug: Record<string, IntelSkill> = {};
  for (const s of payload?.skills ?? []) {
    if (s && typeof s.skill === "string") bySlug[s.skill] = s;
  }

  return (
    <section className="relative scroll-mt-24 py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="max-w-3xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/85">
            Vexor Intel
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight">
            Autonomous briefings, on a schedule.
          </h1>
          <p className="mt-4 text-white/65 text-base sm:text-lg leading-relaxed">
            Five cron-driven briefings tuned for $VT — morning priority list,
            token pulse, on-chain events, DeFi overview, and an evening recap.
            Produced by an{" "}
            <a
              href="https://github.com/Vexorterminal0111/vexor-aeon"
              target="_blank"
              rel="noreferrer"
              className="text-white/85 underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              aeon fork
            </a>{" "}
            running on GitHub Actions. Read-only and public.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-[11px] font-mono uppercase tracking-widest text-white/55">
          <span>
            Generated{" "}
            <span className="text-white/85">
              {formatRelative(payload?.generated_at) ?? "—"}
            </span>
          </span>
          <span className="text-white/30">·</span>
          <span>
            Next run{" "}
            <span className="text-white/85">
              {formatRelative(payload?.next_run_at) ?? "—"}
            </span>
          </span>
          <span className="text-white/30">·</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRefreshTick((t) => t + 1);
            }}
            className="text-white/55 hover:text-white transition-colors"
          >
            Refresh →
          </button>
          {error && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-rose-300/85">feed error: {error}</span>
            </>
          )}
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {CARD_ORDER.map((card, i) => {
            const s = bySlug[card.slug];
            return (
              <article
                key={card.slug}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
              >
                <div
                  aria-hidden
                  className={`absolute -top-24 -right-24 h-56 w-56 bg-gradient-to-br ${card.gradient} rounded-full blur-3xl opacity-60`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                      {String(i + 1).padStart(2, "0")} · {card.slug}
                    </div>
                    <div
                      className="font-mono text-[10px] uppercase tracking-widest"
                      style={{ color: card.accent }}
                    >
                      {s?.produced_at ? formatRelative(s.produced_at) : "no data"}
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <h2 className="text-xl font-medium tracking-tight">
                      {s?.title ?? card.label}
                    </h2>
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: card.accent }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-white/45">
                    {card.kicker}
                  </div>

                  {s?.summary && (
                    <p className="mt-4 text-sm text-white/70 leading-relaxed">
                      {s.summary}
                    </p>
                  )}

                  {s?.markdown ? (
                    <div className="prose-vexor mt-4 max-h-[420px] overflow-y-auto pr-2 text-sm text-white/75">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {s.markdown}
                      </ReactMarkdown>
                    </div>
                  ) : s?.items && s.items.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {s.items.map((it, idx) => (
                        <li
                          key={idx}
                          className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                        >
                          {it.title && (
                            <div className="text-sm font-medium text-white/90">
                              {it.title}
                            </div>
                          )}
                          {it.body && (
                            <div className="mt-1 text-sm text-white/65 leading-relaxed">
                              {it.body}
                            </div>
                          )}
                          {it.url && (
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block font-mono text-[10px] uppercase tracking-widest text-white/55 hover:text-white"
                            >
                              {it.url} ↗
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
                        {loading
                          ? "Loading feed…"
                          : "No data yet"}
                      </div>
                      <p className="mt-1 text-sm text-white/55 leading-relaxed">
                        {loading
                          ? "Pulling latest brief from the aeon data branch."
                          : "Briefing will populate after the first scheduled run."}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4 font-mono text-[10px] uppercase tracking-widest text-white/45">
                    <span>
                      Run{" "}
                      <span className="text-white/65">
                        {s?.run_id ? String(s.run_id) : "—"}
                      </span>
                    </span>
                    <span>
                      Produced{" "}
                      <span className="text-white/65">
                        {formatTime(s?.produced_at)}
                      </span>
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Pulse Premium — per-token feeds */}
        <div className="mt-20 sm:mt-24">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet-300/85">
                Vexor Pulse Premium
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight">
                Per-token briefings
              </h2>
              <p className="mt-2 text-white/65 text-sm sm:text-base leading-relaxed max-w-2xl">
                Daily DexScreener snapshot per token — refreshed 12:00 UTC by a
                standalone aeon worker. {INTEL_TOKENS.length} tokens in V1; submit
                a token via PR or stay tuned for stake-gated subscriptions.
              </p>
            </div>
            <a
              href="/api/intel/index"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-white/55 hover:text-white"
            >
              GET /api/intel/index ↗
            </a>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {INTEL_TOKENS.map((meta) => {
              const live = premium?.tokens?.find((t) => t.slug === meta.slug);
              const pct = live?.price_change_24h_pct;
              const pctClass =
                pct === undefined || !Number.isFinite(pct)
                  ? "text-white/55"
                  : pct > 0
                    ? "text-emerald-300"
                    : pct < 0
                      ? "text-rose-300"
                      : "text-white/55";
              const pctText =
                pct === undefined || !Number.isFinite(pct)
                  ? "—"
                  : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
              const priceText =
                live?.price_usd === undefined || live?.price_usd === null
                  ? "—"
                  : live.price_usd >= 1
                    ? `$${live.price_usd.toFixed(4)}`
                    : `$${live.price_usd.toPrecision(4)}`;
              const fmtUsd = (n?: number) => {
                if (n === undefined || !Number.isFinite(n)) return "—";
                const abs = Math.abs(n);
                if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
                if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
                if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
                return `$${n.toFixed(2)}`;
              };
              return (
                <Link
                  key={meta.slug}
                  href={`/intel/${meta.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-xl font-medium tracking-tight">
                          ${meta.symbol}
                        </h3>
                        <span className="text-white/45 text-sm">
                          {meta.name}
                        </span>
                        {meta.host && (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-300/85 border border-cyan-300/30 rounded px-1.5 py-0.5">
                            host
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/45">
                        {live?.produced_at
                          ? formatRelative(live.produced_at) ?? "—"
                          : "no data"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-medium text-white/90">
                        {priceText}
                      </div>
                      <div className={`text-xs ${pctClass}`}>
                        {pctText} 24h
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-white/65 leading-relaxed line-clamp-2">
                    {meta.blurb}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
                    <div>
                      <div>vol 24h</div>
                      <div className="mt-0.5 text-white/75 normal-case tracking-normal text-xs">
                        {fmtUsd(live?.volume_24h_usd)}
                      </div>
                    </div>
                    <div>
                      <div>liq</div>
                      <div className="mt-0.5 text-white/75 normal-case tracking-normal text-xs">
                        {fmtUsd(live?.liquidity_usd)}
                      </div>
                    </div>
                    <div>
                      <div>fdv</div>
                      <div className="mt-0.5 text-white/75 normal-case tracking-normal text-xs">
                        {fmtUsd(live?.fdv_usd)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 font-mono text-[10px] uppercase tracking-widest text-white/45">
                    <span>open feed</span>
                    <span className="text-white/65 group-hover:text-white">
                      /intel/{meta.slug} →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
            How this works
          </div>
          <p className="mt-2 text-sm text-white/70 leading-relaxed">
            Vexor Intel is produced by a customized fork of{" "}
            <a
              href="https://github.com/aaronjmars/aeon"
              target="_blank"
              rel="noreferrer"
              className="text-white/85 underline decoration-white/20 underline-offset-4 hover:decoration-white"
            >
              aeon
            </a>{" "}
            at{" "}
            <a
              href="https://github.com/Vexorterminal0111/vexor-aeon"
              target="_blank"
              rel="noreferrer"
              className="text-white/85 underline decoration-white/20 underline-offset-4 hover:decoration-white"
            >
              Vexorterminal0111/vexor-aeon
            </a>
            . Each skill runs on its own GitHub Actions cron schedule and
            writes a single aggregated <span className="font-mono">intel.json</span>{" "}
            file to a public <span className="font-mono">data</span> branch.
            This page hits a Cloudflare Worker that proxies + edge-caches that
            file. No login, no token gate, no rate limits beyond the 60s edge
            cache.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest">
            <a
              href="/api/intel"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-white/65 hover:text-white hover:border-white/20"
            >
              GET /api/intel
            </a>
            <a
              href="https://github.com/Vexorterminal0111/vexor-aeon/tree/data"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-white/65 hover:text-white hover:border-white/20"
            >
              data branch
            </a>
            <a
              href="https://github.com/Vexorterminal0111/vexor-aeon/actions"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-white/65 hover:text-white hover:border-white/20"
            >
              skill runs
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
