import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vexorterminal.xyz"),
  title: {
    default: "Vexor Terminal — Autonomous AI Orchestrator on Base",
    template: "%s · Vexor Terminal",
  },
  description:
    "Vexor Terminal is an autonomous AI orchestrator with 9 specialized sub-agents, powered by the $VEXOR token on Base. Stake $VEXOR for governance and earn from agent revenue.",
  keywords: [
    "AI agent",
    "on-chain agent",
    "Base",
    "Vexor",
    "orchestrator",
    "multi-agent",
    "web3 AI",
  ],
  openGraph: {
    title: "Vexor Terminal — Autonomous AI Orchestrator on Base",
    description:
      "9 specialized sub-agents. One terminal. Powered by $VEXOR on Base.",
    url: "https://vexorterminal.xyz",
    siteName: "Vexor Terminal",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vexor Terminal — Autonomous AI Orchestrator on Base",
    description:
      "9 specialized sub-agents. One terminal. Powered by $VEXOR on Base.",
    site: "@vexorterminal",
    creator: "@vexorterminal",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
