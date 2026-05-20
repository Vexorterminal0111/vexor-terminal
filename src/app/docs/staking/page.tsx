import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { StakingDocs } from "./StakingDocs";

export const metadata: Metadata = {
  title: "Staking Guide — Vexor Terminal",
  description:
    "Complete guide to $VT RevShare staking on Base mainnet: how it works, math, worked examples, contract addresses, risks, and FAQ.",
};

export default function StakingDocsPage() {
  const root = process.cwd();
  const en = fs.readFileSync(path.join(root, "src/content/staking-en.md"), "utf-8");
  const id = fs.readFileSync(path.join(root, "src/content/staking-id.md"), "utf-8");
  return <StakingDocs en={en} id={id} />;
}
