import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Docs } from "@/components/Docs";

export const metadata: Metadata = {
  title: "Docs — Vexor Terminal",
  description:
    "Quickstart, planned $VEXOR token economy, Console walkthrough, sub-agent reference, tier table, and FAQ for the Vexor Terminal protocol on Solana.",
};

export default function DocsPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Docs />
      </main>
      <Footer />
    </>
  );
}
