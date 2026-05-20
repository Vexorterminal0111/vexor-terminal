"use client";

import { useEffect, useState } from "react";
import {
  fetchPoolSummary,
  formatVtCompact,
  formatUsdCompact,
  type PoolSummary,
} from "@/lib/revshare";
import styles from "./widget.module.css";

const AUTO_REFRESH_MS = 300_000;

function formatApr(apr: number | null): string {
  if (apr === null || !isFinite(apr)) return "—";
  if (apr >= 1000) return apr.toFixed(0) + "%";
  return apr.toFixed(1) + "%";
}

function formatPrice(p: number | null): string {
  if (p === null) return "—";
  if (p < 0.000001) return "$" + p.toExponential(2);
  if (p < 0.01) return "$" + p.toFixed(8);
  if (p < 1) return "$" + p.toFixed(4);
  return "$" + p.toFixed(2);
}

export function StatsWidget() {
  const [data, setData] = useState<PoolSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const run = async () => {
      try {
        const s = await fetchPoolSummary();
        if (cancelled) return;
        setData(s);
        setErr(null);
        setNow(new Date());
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "fetch failed");
      }
    };
    void run();
    intervalId = setInterval(() => void run(), AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const apr = formatApr(data?.estimatedApr ?? null);
  const tvl = data ? formatVtCompact(data.totalStaked) + " VT" : "—";
  const price = formatPrice(data?.vtPriceUsd ?? null);
  const mcap = data?.fdvUsd ? formatUsdCompact(data.fdvUsd) : "—";

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.dot} />
          <span className={styles.brandName}>VEXOR.TERMINAL</span>
          <span className={styles.brandSep}>·</span>
          <span className={styles.brandSub}>$VT RevShare</span>
        </div>
        <a
          className={styles.more}
          href="https://vexorterminal.com/console"
          target="_blank"
          rel="noreferrer"
        >
          OPEN ↗
        </a>
      </div>
      <div className={styles.grid}>
        <div className={styles.cell}>
          <div className={styles.label}>APR</div>
          <div className={`${styles.value} ${styles.accent}`}>{apr}</div>
        </div>
        <div className={styles.cell}>
          <div className={styles.label}>POOL TVL</div>
          <div className={styles.value}>{tvl}</div>
        </div>
        <div className={styles.cell}>
          <div className={styles.label}>$VT PRICE</div>
          <div className={styles.value}>{price}</div>
        </div>
        <div className={styles.cell}>
          <div className={styles.label}>MARKET CAP</div>
          <div className={styles.value}>{mcap}</div>
        </div>
      </div>
      <div className={styles.footer}>
        <span>
          {err
            ? `error: ${err.slice(0, 40)}`
            : `last update ${now.toLocaleTimeString()}`}
        </span>
        <a
          href="https://vexorterminal.com"
          target="_blank"
          rel="noreferrer"
        >
          vexorterminal.com
        </a>
      </div>
    </div>
  );
}
