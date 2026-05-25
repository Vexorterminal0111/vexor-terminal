import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RevShare Console — Vexor Terminal",
  description:
    "The $VEXOR RevShare staking console will open with the $VEXOR token launch.",
};

export default function ConsolePage() {
  return (
    <main className="min-h-screen bg-background text-white flex items-center justify-center px-4 py-24">
      <div className="max-w-xl w-full text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
          Pending token launch
        </div>
        <h1 className="mt-4 font-mono text-3xl sm:text-4xl text-white">
          RevShare Console — coming soon.
        </h1>
        <p className="mt-4 text-sm sm:text-[15px] text-white/65 leading-relaxed">
          The on-chain $VEXOR staking console will open alongside the $VEXOR token
          launch on Base. Until then, the contract has not been deployed and
          there is no pool to interact with.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 py-2.5 font-mono text-sm hover:bg-cyan-300 transition-colors"
          >
            ← Back to home
          </Link>
          <a
            href="https://x.com/vexorterminal"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/[0.06] px-5 py-2.5 font-mono text-sm text-cyan-200 hover:text-white hover:border-cyan-300/50 transition-colors"
          >
            Follow on X →
          </a>
        </div>
      </div>
    </main>
  );
}
