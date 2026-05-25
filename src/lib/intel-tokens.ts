/**
 * Vexor Pulse Premium — token roster
 *
 * Source of truth for the static set of tokens that get per-token feeds
 * at `/intel/<slug>`. Mirrors the `tokens` array in `tokens.json` on the
 * companion aeon fork (`github.com/Vexorterminal0111/vexor-aeon`). Both
 * must stay in sync — add a token here AND in vexor-aeon's `tokens.json`.
 *
 * Used by:
 * - `src/app/intel/[slug]/page.tsx` — `generateStaticParams()` prerenders
 *   one static HTML shell per slug (required for `next.config.ts`'s
 *   `output: "export"`).
 * - `src/app/intel/IntelFeed.tsx` — index "Premium tokens" section.
 * - `worker/intel-token.ts` — slug validation guard.
 *
 * `slug` is the URL key and MUST be stable forever (search engines and
 * external links will reference `vexorterminal.com/intel/<slug>`).
 */

export interface IntelTokenMeta {
  /** Lowercase URL slug. Never rename after launch. */
  slug: string;
  /** Display ticker, e.g. "VEXOR", "AERO". */
  symbol: string;
  /** Full token name, e.g. "Vexor Terminal". */
  name: string;
  /** EVM contract address (checksummed). */
  ca: string;
  /** Chain key — currently always "base" for V1. */
  network: "base";
  /** Marks the project's own token. Rendered with a "host" badge. */
  host?: boolean;
  /** Short tagline shown on the index card. */
  blurb: string;
}

export const INTEL_TOKENS: ReadonlyArray<IntelTokenMeta> = [
  {
    // Slug stays `vt` because the vexor-aeon `data` branch keys all
    // CDN snapshots / sentiment JSONs by `vt` (`ds-vt.json`,
    // `sentiments/vt.json`, etc.). Only the display `symbol` was
    // renamed VT → VEXOR — slug is an internal/URL key.
    slug: "vt",
    symbol: "VEXOR",
    name: "Vexor Terminal",
    ca: "0x2c684D666998436634EcEde1527EdA7975427Ba3",
    network: "base",
    host: true,
    blurb: "Native token of the Vexor Terminal protocol.",
  },
  {
    slug: "aero",
    symbol: "AERO",
    name: "Aerodrome",
    ca: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    network: "base",
    blurb: "Base's flagship AMM. Liquidity layer for the ecosystem.",
  },
  {
    slug: "brett",
    symbol: "BRETT",
    name: "Brett",
    ca: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    network: "base",
    blurb: "Base memecoin OG. Frog #2 of the original Boy's Club cast.",
  },
  {
    slug: "degen",
    symbol: "DEGEN",
    name: "Degen",
    ca: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    network: "base",
    blurb: "Farcaster-native tipping token. Powers /degen channel.",
  },
  {
    slug: "toshi",
    symbol: "TOSHI",
    name: "Toshi",
    ca: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4",
    network: "base",
    blurb: "Base's mascot cat. First memecoin launched on Base mainnet.",
  },
  {
    slug: "aeon",
    symbol: "AEON",
    name: "aeon",
    ca: "0xBf8E8f0e8866a7052F948C16508644347c57aba3",
    network: "base",
    blurb: "Token associated with the aeon autonomous-agent framework.",
  },
  {
    slug: "bnkr",
    symbol: "BNKR",
    name: "BankrCoin",
    ca: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b",
    network: "base",
    blurb:
      "Native token of the Bankr LLM gateway (the same gateway routing aeon's Claude calls).",
  },
] as const;

const BY_SLUG: Record<string, IntelTokenMeta> = Object.fromEntries(
  INTEL_TOKENS.map((t) => [t.slug, t]),
);

export function getIntelToken(slug: string): IntelTokenMeta | undefined {
  return BY_SLUG[slug.toLowerCase()];
}

export function isIntelTokenSlug(slug: string): boolean {
  return slug.toLowerCase() in BY_SLUG;
}
