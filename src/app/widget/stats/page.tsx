import type { Metadata } from "next";
import { StatsWidget } from "./StatsWidget";

export const metadata: Metadata = {
  title: "$VT Stats — Vexor Terminal",
  description:
    "Embeddable $VT RevShare stats widget: live APR, pool TVL, $VT price, market cap. Auto-refresh every 5 minutes.",
  robots: { index: false, follow: false },
};

export default function StatsWidgetPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        padding: "12px",
      }}
    >
      <StatsWidget />
    </main>
  );
}
