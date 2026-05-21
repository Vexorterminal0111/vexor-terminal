import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { INTEL_TOKENS, getIntelToken } from "@/lib/intel-tokens";
import { TokenFeed } from "./TokenFeed";

interface RouteParams {
  slug: string;
}

// `next.config.ts` has `output: "export"`, so every reachable URL has to
// be enumerated here at build time. Adding a token = update
// `src/lib/intel-tokens.ts` AND `tokens.json` on the aeon side.
export function generateStaticParams(): RouteParams[] {
  return INTEL_TOKENS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const token = getIntelToken(slug);
  if (!token) {
    return { title: "Token not found — Vexor Intel" };
  }
  return {
    title: `${token.symbol} — Vexor Pulse Premium`,
    description: `Daily ${token.symbol} pulse: price, volume, liquidity, and pool context. ${token.blurb} Refreshed by an aeon fork on GitHub Actions.`,
  };
}

export default async function IntelTokenPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const token = getIntelToken(slug);
  if (!token) {
    notFound();
  }
  return (
    <>
      <Nav />
      <main className="flex-1">
        <TokenFeed token={token} />
      </main>
      <Footer />
    </>
  );
}
