import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "$VEXOR Stats — Vexor Terminal",
  description:
    "The $VEXOR stats widget will be enabled with the $VEXOR token launch.",
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
        color: "#ffffff",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          textAlign: "center",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 16,
          padding: "32px 24px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#a78bfa",
          }}
        >
          Pending token launch
        </div>
        <div style={{ marginTop: 12, fontSize: 22, color: "#ffffff" }}>
          $VEXOR stats widget — coming soon.
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.6,
          }}
        >
          This embed will display live RevShare APR, pool TVL, $VEXOR price, and
          market cap once $VEXOR launches on Solana.
        </div>
      </div>
    </main>
  );
}
