import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntelFeed } from "./IntelFeed";

export const metadata: Metadata = {
  title: "Vexor Intel — Autonomous Briefings",
  description:
    "Cron-driven $VT briefings produced by a customized aeon fork on GitHub Actions: morning brief, token pulse, on-chain pulse, DeFi overview, and evening recap. Public, read-only.",
};

export default function IntelPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <IntelFeed />
      </main>
      <Footer />
    </>
  );
}
