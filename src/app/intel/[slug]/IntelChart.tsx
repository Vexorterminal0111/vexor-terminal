"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

// Timeframe presets exposed to the user as a button row. Each maps to a
// GeckoTerminal OHLCV path + candle count. `60d`/`90d` use the daily
// endpoint because the hourly endpoint caps at 1000 candles per call
// and would 429 us anyway on the shared free-tier bucket.
type Timeframe = "1D" | "7D" | "30D" | "90D";

const TF_CONFIG: Record<
  Timeframe,
  { path: "hour" | "day"; limit: number; label: string }
> = {
  "1D": { path: "hour", limit: 24, label: "1D" },
  "7D": { path: "hour", limit: 168, label: "7D" },
  "30D": { path: "day", limit: 30, label: "30D" },
  "90D": { path: "day", limit: 90, label: "90D" },
};

const OHLC_BASE = "https://api.geckoterminal.com/api/v2/networks";

interface GeckoOhlcResponse {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]>;
    };
  };
}

export function IntelChart({
  symbol,
  network,
  pool,
}: {
  symbol: string;
  network: string;
  pool: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [tf, setTf] = useState<Timeframe>("7D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candleCount, setCandleCount] = useState(0);

  // Bootstrap the chart once. lightweight-charts owns the canvas, so
  // we tear down on unmount instead of re-creating on every prop
  // change — series data is swapped via setData() in the fetch effect
  // below.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.55)",
        fontFamily:
          "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(103, 232, 249, 0.35)", width: 1 },
        horzLine: { color: "rgba(103, 232, 249, 0.35)", width: 1 },
      },
    });

    // Cyan up / rose down to match the rest of the Vexor brand palette
    // (see /docs/staking widget for the same colorway).
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#a78bfa",
      downColor: "#fb7185",
      borderUpColor: "#a78bfa",
      borderDownColor: "#fb7185",
      wickUpColor: "rgba(103, 232, 249, 0.75)",
      wickDownColor: "rgba(251, 113, 133, 0.75)",
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(103, 232, 249, 0.25)",
    });
    // Pin the volume histogram to the bottom 20% of the pane so it
    // sits under the candles without stealing too much real estate.
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    volumeSeriesRef.current = volume;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Fetch + load OHLC whenever the timeframe / pool changes.
  // setState calls are deferred into an async IIFE / `.then` handlers so
  // they run on a microtask instead of synchronously inside the effect
  // body — React 19's lint rule warns about the latter pattern.
  useEffect(() => {
    if (!pool || !network) return;
    let cancelled = false;
    const { path, limit } = TF_CONFIG[tf];
    const url = `${OHLC_BASE}/${network}/pools/${pool}/ohlcv/${path}?aggregate=1&limit=${limit}&currency=usd`;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as GeckoOhlcResponse;
        if (cancelled) return;

        const list = data?.data?.attributes?.ohlcv_list ?? [];
        if (list.length === 0) {
          throw new Error("no candles returned");
        }

        // GeckoTerminal returns DESC (newest first). lightweight-charts
        // requires ASC; sort + dedupe defensively because identical
        // timestamps would throw inside the engine.
        const seen = new Set<number>();
        const sorted = [...list]
          .filter(([t]) => {
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
          })
          .sort((a, b) => a[0] - b[0]);

        const candleData: CandlestickData<UTCTimestamp>[] = sorted.map(
          ([t, o, h, l, c]) => ({
            time: t as UTCTimestamp,
            open: o,
            high: h,
            low: l,
            close: c,
          }),
        );
        const volumeData: HistogramData<UTCTimestamp>[] = sorted.map(
          ([t, o, , , c, v]) => ({
            time: t as UTCTimestamp,
            value: v,
            color:
              c >= o
                ? "rgba(103, 232, 249, 0.45)"
                : "rgba(251, 113, 133, 0.45)",
          }),
        );

        candleSeriesRef.current?.setData(candleData);
        volumeSeriesRef.current?.setData(volumeData);
        chartRef.current?.timeScale().fitContent();
        setCandleCount(candleData.length);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tf, network, pool]);

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
          ${symbol} · OHLC · GeckoTerminal
        </div>
        <div className="flex gap-1">
          {(Object.keys(TF_CONFIG) as Timeframe[]).map((key) => {
            const active = key === tf;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTf(key)}
                className={
                  "rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors " +
                  (active
                    ? "border-violet-300/50 bg-violet-300/10 text-violet-200"
                    : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/85")
                }
              >
                {TF_CONFIG[key].label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={containerRef}
        className="mt-4 h-[360px] w-full sm:h-[420px]"
        aria-label={`${symbol} candlestick chart`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
        {loading && <span>loading…</span>}
        {!loading && error && (
          <span className="text-rose-300/85">chart error: {error}</span>
        )}
        {!loading && !error && (
          <span>
            {candleCount} candles · drag to pan · scroll to zoom · double-click
            to reset
          </span>
        )}
      </div>
    </div>
  );
}
