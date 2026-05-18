import type { Metadata } from "next";
import RevShareTerminal from "./RevShareTerminal";

export const metadata: Metadata = {
  title: "RevShare Console — Vexor Terminal",
  description:
    "Real-time on-chain dashboard for the $VT RevShare staking pool on Base mainnet. Pool stats, top stakers leaderboard, APR estimate, and recent reward pushes.",
};

export default function ConsolePage() {
  return <RevShareTerminal />;
}
