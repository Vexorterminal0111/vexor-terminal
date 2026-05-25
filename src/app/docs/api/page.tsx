import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Public API — Vexor Terminal",
  description:
    "Public JSON API for the $VT RevShare pool on Base mainnet. Pool stats, APR, and price data.",
};

const EXAMPLE_RESPONSE = `{
  "schema_version": "1",
  "fetched_at": "2026-05-20T11:53:55.123Z",
  "block_number": 46244445,
  "contract": {
    "revshare": "0x...",
    "token": "0x...",
    "owner": "0x...",
    "network": "base-mainnet",
    "chain_id": 8453
  },
  "pool": {
    "total_staked_wei": "669861700710000000000000000",
    "total_staked_vt": "669861700.7100",
    "pool_balance_wei": "735301301420000000000000000",
    "pool_balance_vt": "735301301.4200",
    "acc_reward_per_token": "2459213683715519901"
  },
  "rewards": {
    "total_distributed_wei": "85326412500000000000000000",
    "total_distributed_vt": "85326412.5000",
    "estimated_apr_percent": 154.98,
    "avg_push_interval_hours": 1.3,
    "window_blocks": 90000,
    "window_logs_count": 26
  },
  "market": {
    "vt_price_usd": 0.00000138,
    "volume_24h_usd": 116830.42,
    "market_cap_usd": 138470.12,
    "fdv_usd": 138470.12,
    "source": "dexscreener"
  },
  "links": {
    "site": "https://vexorterminal.com",
    "docs": "https://vexorterminal.com/docs/api",
    "basescan_revshare": "https://basescan.org/address/<revshare>",
    "basescan_token": "https://basescan.org/address/<token>",
    "github": "https://github.com/Vexorterminal0111/vexor-terminal"
  }
}`;

interface FieldRow {
  path: string;
  type: string;
  note: string;
}

const POOL_FIELDS: FieldRow[] = [
  { path: "schema_version", type: "string", note: "Bumped on breaking shape changes. Currently \"1\"." },
  { path: "fetched_at", type: "ISO-8601", note: "Server timestamp when this response was built (UTC)." },
  { path: "block_number", type: "integer", note: "Base mainnet head block at fetch time." },
  { path: "contract.revshare", type: "address", note: "VexorRevShare staking contract address." },
  { path: "contract.token", type: "address", note: "$VT ERC-20 token address." },
  { path: "contract.owner", type: "address", note: "RevShare owner (can call pushRewards; cannot withdraw user balances)." },
  { path: "contract.network", type: "string", note: "Always \"base-mainnet\"." },
  { path: "contract.chain_id", type: "integer", note: "EVM chain ID. Base mainnet = 8453." },
  { path: "pool.total_staked_wei", type: "string (uint256)", note: "Sum of every staker's balance, raw wei." },
  { path: "pool.total_staked_vt", type: "string (decimal)", note: "Same as above formatted with 4 decimals." },
  { path: "pool.pool_balance_wei", type: "string (uint256)", note: "$VT balance of the RevShare contract." },
  { path: "pool.pool_balance_vt", type: "string (decimal)", note: "Same as above formatted with 4 decimals." },
  { path: "pool.acc_reward_per_token", type: "string (uint256)", note: "Cumulative reward index (×1e18) — used to compute pending(user)." },
  { path: "rewards.total_distributed_wei", type: "string (uint256)", note: "Sum of RewardsPushed amounts in the last window_blocks." },
  { path: "rewards.total_distributed_vt", type: "string (decimal)", note: "Same as above formatted with 4 decimals." },
  { path: "rewards.estimated_apr_percent", type: "number | null", note: "Annualized APR (%) over the window. null if not enough data (window <1h)." },
  { path: "rewards.avg_push_interval_hours", type: "number | null", note: "Average hours between consecutive RewardsPushed events in the window." },
  { path: "rewards.window_blocks", type: "integer", note: "Number of blocks scanned (currently 90,000 ≈ 50h on Base)." },
  { path: "rewards.window_logs_count", type: "integer", note: "Number of RewardsPushed events found in the window." },
  { path: "market.vt_price_usd", type: "number | null", note: "Spot $VT/USD from DexScreener primary pair." },
  { path: "market.volume_24h_usd", type: "number | null", note: "24h trading volume from DexScreener." },
  { path: "market.market_cap_usd", type: "number | null", note: "Circulating market cap if available, else falls back to FDV." },
  { path: "market.fdv_usd", type: "number | null", note: "Fully diluted valuation." },
  { path: "market.source", type: "string", note: "Always \"dexscreener\"." },
];

export default function ApiDocsPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-16 sm:py-24">
          <div className="mb-8">
            <a
              href="/docs.html"
              className="font-mono text-xs text-white/55 hover:text-white transition-colors"
            >
              ← Back to docs
            </a>
          </div>

          <header className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 mb-4">
              Public API · v1
            </p>
            <h1 className="text-3xl sm:text-4xl font-mono font-medium text-white mb-4">
              GET /api/pool
            </h1>
            <p className="text-white/70 leading-relaxed">
              Public, read-only JSON endpoint returning the live state of the
              $VT RevShare pool on Base mainnet. Aggregates on-chain reads,
              RewardsPushed event history, and DexScreener price data into a
              single normalized response. No auth, no rate limit headers,
              open CORS.
            </p>
          </header>

          <section className="mb-12">
            <h2 className="text-lg font-mono text-cyan-300 mb-3 uppercase tracking-widest">
              Endpoint
            </h2>
            <pre className="bg-black/60 border border-white/10 rounded-md p-4 overflow-x-auto font-mono text-xs text-cyan-200">
              <code>{`GET https://vexorterminal.com/api/pool`}</code>
            </pre>
            <ul className="mt-4 space-y-1 text-sm text-white/60 font-mono">
              <li>· <span className="text-white/80">Method:</span> GET / HEAD / OPTIONS</li>
              <li>· <span className="text-white/80">Auth:</span> none (public)</li>
              <li>· <span className="text-white/80">CORS:</span> Access-Control-Allow-Origin: *</li>
              <li>· <span className="text-white/80">Cache:</span> public, s-maxage=60 (60s edge cache)</li>
              <li>· <span className="text-white/80">Content-Type:</span> application/json; charset=utf-8</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-lg font-mono text-cyan-300 mb-3 uppercase tracking-widest">
              Example
            </h2>
            <p className="text-sm text-white/60 mb-3 font-mono">
              curl -s https://vexorterminal.com/api/pool
            </p>
            <pre className="bg-black/60 border border-white/10 rounded-md p-4 overflow-x-auto font-mono text-[11px] text-white/80">
              <code>{EXAMPLE_RESPONSE}</code>
            </pre>
          </section>

          <section className="mb-12">
            <h2 className="text-lg font-mono text-cyan-300 mb-3 uppercase tracking-widest">
              Fields
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-cyan-300/80">
                    <th className="text-left py-2 pr-4 font-normal">Path</th>
                    <th className="text-left py-2 pr-4 font-normal">Type</th>
                    <th className="text-left py-2 font-normal">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {POOL_FIELDS.map((f) => (
                    <tr key={f.path} className="border-b border-white/[0.04] align-top">
                      <td className="py-2 pr-4 text-white/90 whitespace-nowrap">{f.path}</td>
                      <td className="py-2 pr-4 text-cyan-200/80 whitespace-nowrap">{f.type}</td>
                      <td className="py-2 text-white/55">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-lg font-mono text-cyan-300 mb-3 uppercase tracking-widest">
              Errors
            </h2>
            <ul className="text-sm text-white/70 space-y-2 font-mono">
              <li>
                <span className="text-white/90">405</span> — Method not allowed.
                Only GET / HEAD / OPTIONS are accepted.
              </li>
              <li>
                <span className="text-white/90">502</span> — Upstream RPC
                failure. Response shape: <code className="text-cyan-200/80">{`{ "error": "upstream_failure", "detail": string }`}</code>
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-lg font-mono text-cyan-300 mb-3 uppercase tracking-widest">
              Use cases
            </h2>
            <ul className="text-sm text-white/70 space-y-1.5 list-disc pl-5">
              <li>Power your own dashboard widgets without re-implementing RPC + DexScreener fetch logic.</li>
              <li>Drive Telegram / Discord / X bots posting periodic pool snapshots.</li>
              <li>Run alerts when APR / push interval crosses a threshold.</li>
              <li>Backfill historical totals into your own indexer or BI tool.</li>
            </ul>
          </section>

          <section className="mb-4">
            <h2 className="text-lg font-mono text-cyan-300 mb-3 uppercase tracking-widest">
              Notes
            </h2>
            <ul className="text-sm text-white/55 space-y-2">
              <li>
                Reward aggregation uses the last 90,000 blocks (~50h on Base).
                For full lifetime data, run your own indexer.
              </li>
              <li>
                Market data is best-effort from DexScreener. If their API is
                down, those fields will be <code className="text-cyan-200/80">null</code>.
              </li>
              <li>
                Cache TTL is 60s. If you need sub-minute freshness, run your
                own RPC client against Base mainnet.
              </li>
            </ul>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
