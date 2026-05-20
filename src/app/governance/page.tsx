import type { Metadata } from "next";
import { Governance } from "./Governance";

export const metadata: Metadata = {
  title: "Governance — Vexor Terminal",
  description:
    "On-chain governance for Vexor Terminal — vote on proposals and submit new ones using $VEXOR voting weight (4-tier staking demo on Base Sepolia).",
};

export default function GovernancePage() {
  return <Governance />;
}
