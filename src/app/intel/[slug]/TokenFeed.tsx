"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { IntelTokenMeta } from "@/lib/intel-tokens";
import { IntelChart } from "./IntelChart";

const AUTO_REFRESH_MS = 120_000; // 2 min, matches /intel index cadence

type Card = {
  card: string;
  title?: string;
  summary?: string;
  markdown?: string;
  produced_at?: string;
  run_id?: string | number;
};

type MarketSnapshot = {
  price_usd?: number | null;
  volume_24h_usd?: number;
  liquidity_usd?: number;
  fdv_usd?: number;
  market_cap_usd?: number;
  price_change_1h_pct?: number;
  price_change_6h_pct?: number;
  price_change_24h_pct?: number;
  txns_24h?: { buys?: number; sells?: number };
  top_pool?: { address?: string; dex?: string; url?: string };
};

type TokenMetaPayload = {
  slug?: string;
  symbol?: string;
  name?: string;
  ca?: string;
  network?: string;
  host?: boolean;
  blurb?: string | null;
  basescan_url?: string;
  dex_url?: string;
};

type Payload = {
  schema_version?: string;
  generated_at?: string;
  next_run_at?: string | null;
  source?: string;
  token?: TokenMetaPayload;
  market_snapshot?: MarketSnapshot;
  cards?: Card[];
};

function formatRelative(iso: string | undefined | null): string | null {
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

function fmtUsd(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  // sub-dollar — keep up to 6 sig figs, drop trailing zeros
  return `$${n.toPrecision(4)}`;
}

function fmtPct(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pctTone(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "text-white/55";
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-rose-300";
  return "text-white/55";
}

function shortAddr(addr: string | undefined): string {
  if (!addr) return "—";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TokenFeed({ token }: { token: IntelTokenMeta }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/intel/${token.slug}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Payload = await res.json();
        if (cancelled) return;
        setPayload(data);
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
  }, [refreshTick, token.slug]);

  const market = payload?.market_snapshot ?? {};
  const cards = payload?.cards ?? [];

  return (
    <section className="relative scroll-mt-24 py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="max-w-3xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet-300/85">
            Vexor Pulse Premium ·{" "}
            <Link
              href="/intel"
              className="text-white/85 hover:text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              ← back to Intel
            </Link>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight">
            ${token.symbol}
            <span className="ml-3 text-white/40 text-2xl sm:text-3xl lg:text-4xl">
              {token.name}
            </span>
            {token.host && (
              <span className="ml-3 inline-block align-middle font-mono text-[10px] uppercase tracking-widest text-violet-300/85 border border-violet-300/30 rounded px-2 py-1">
                host
              </span>
            )}
          </h1>
          <p className="mt-4 text-white/65 text-base sm:text-lg leading-relaxed">
            {token.blurb} Daily pulse refreshed at 12:00 UTC by the Vexor
            Pulse Premium aeon worker — DexScreener data, edge-cached 60s.
          </p>
          <div className="mt-4 font-mono text-[11px] text-white/55 flex flex-wrap items-center gap-2">
            <span>contract:</span>
            <a
              href={`https://basescan.org/token/${token.ca}`}
              target="_blank"
              rel="noreferrer"
              className="text-white/85 underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              {token.ca}
            </a>
            <span className="text-white/30">·</span>
            <span>chain: {token.network}</span>
          </div>
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
          {!error && !loading && cards.length === 0 && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-amber-300/85">no data yet</span>
            </>
          )}
        </div>

        {/* Stat strip */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat
            label="Price"
            value={
              market.price_usd === null || market.price_usd === undefined
                ? "—"
                : market.price_usd >= 1
                  ? `$${market.price_usd.toFixed(4)}`
                  : `$${market.price_usd.toPrecision(4)}`
            }
            sub={`${fmtPct(market.price_change_24h_pct)} 24h`}
            subClass={pctTone(market.price_change_24h_pct)}
          />
          <Stat
            label="1h"
            value={fmtPct(market.price_change_1h_pct)}
            valueClass={pctTone(market.price_change_1h_pct)}
          />
          <Stat
            label="6h"
            value={fmtPct(market.price_change_6h_pct)}
            valueClass={pctTone(market.price_change_6h_pct)}
          />
          <Stat
            label="Volume 24h"
            value={fmtUsd(market.volume_24h_usd)}
            sub={
              market.txns_24h
                ? `${market.txns_24h.buys ?? 0} / ${market.txns_24h.sells ?? 0} buy·sell`
                : undefined
            }
          />
          <Stat label="Liquidity" value={fmtUsd(market.liquidity_usd)} />
          <Stat label="FDV" value={fmtUsd(market.fdv_usd)} />
        </div>

        {/* Interactive candlestick chart. Skipped until we know the pool
            address — without it the GeckoTerminal endpoint 404s. */}
        {market.top_pool?.address && (
          <IntelChart
            symbol={token.symbol}
            network={token.network}
            pool={market.top_pool.address}
          />
        )}

        {/* Cards (V1: token-pulse only; future: on-chain etc) */}
        <div className="mt-10 grid grid-cols-1 gap-4">
          {cards.length === 0 && !loading && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
              No briefing produced for{" "}
              <span className="text-white/85">{token.symbol}</span> yet. The
              pulse worker runs daily at 12:00 UTC — check back after the next
              run.
            </div>
          )}
          {cards.map((c, i) => (
            <article
              key={c.card + i}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
            >
              <div
                aria-hidden
                className="absolute -top-24 -right-24 h-56 w-56 bg-gradient-to-br from-violet-400/30 via-violet-500/15 to-transparent rounded-full blur-3xl opacity-60"
              />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
                    {String(i + 1).padStart(2, "0")} · {c.card}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-violet-300/85">
                    {formatRelative(c.produced_at) ?? "—"}
                  </div>
                </div>
                <h2 className="mt-3 text-xl font-medium tracking-tight">
                  {c.title ?? c.card}
                </h2>
                {c.summary && (
                  <p className="mt-4 text-sm text-white/70 leading-relaxed">
                    {c.summary}
                  </p>
                )}
                {c.markdown && (
                  <div className="prose-vexor mt-4 max-h-[420px] overflow-y-auto pr-2 text-sm text-white/75">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {c.markdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Pool footer */}
        {market.top_pool?.address && (
          <div className="mt-10 font-mono text-[11px] text-white/55 flex flex-wrap items-center gap-2">
            <span>top pool:</span>
            <a
              href={
                market.top_pool.url ??
                `https://dexscreener.com/${token.network}/${market.top_pool.address}`
              }
              target="_blank"
              rel="noreferrer"
              className="text-white/85 underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              {shortAddr(market.top_pool.address)}
            </a>
            {market.top_pool.dex && (
              <>
                <span className="text-white/30">·</span>
                <span>{market.top_pool.dex}</span>
              </>
            )}
            <span className="text-white/30">·</span>
            <a
              href={
                payload?.source ??
                `https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel/tokens/${token.slug}.json`
              }
              target="_blank"
              rel="noreferrer"
              className="text-white/55 hover:text-white"
            >
              raw json ↗
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  valueClass,
  sub,
  subClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
        {label}
      </div>
      <div className={`mt-1 text-lg font-medium ${valueClass ?? "text-white/90"}`}>
        {value}
      </div>
      {sub && (
        <div className={`mt-0.5 text-xs ${subClass ?? "text-white/55"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
