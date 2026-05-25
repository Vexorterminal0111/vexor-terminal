import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Staking Guide — Vexor Terminal",
  description:
    "The $VEXOR RevShare staking guide will be published with the $VEXOR token launch.",
};

export default function StakingDocsPage() {
  return (
    <main className="min-h-screen bg-background text-white flex items-center justify-center px-4 py-24">
      <div className="max-w-xl w-full text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300">
          Pending token launch
        </div>
        <h1 className="mt-4 font-mono text-3xl sm:text-4xl text-white">
          Staking guide — coming soon.
        </h1>
        <p className="mt-4 text-sm sm:text-[15px] text-white/65 leading-relaxed">
          The full $VEXOR RevShare staking guide — how it works, the math,
          worked examples, contract addresses, and risks — will be published
          alongside the $VEXOR token launch on Base.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/docs.html"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 py-2.5 font-mono text-sm hover:bg-violet-300 transition-colors"
          >
            ← Back to docs
          </Link>
          <a
            href="https://x.com/vexorterminal"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/[0.06] px-5 py-2.5 font-mono text-sm text-violet-200 hover:text-white hover:border-violet-300/50 transition-colors"
          >
            Follow on X →
          </a>
        </div>
      </div>
    </main>
  );
}
