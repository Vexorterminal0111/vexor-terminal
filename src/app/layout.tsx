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
  metadataBase: new URL("https://vexorterminal.com"),
  title: {
    default: "Vexor Terminal — AI Orchestration Platform on Solana",
    template: "%s · Vexor Terminal",
  },
  description:
    "Vexor Terminal is a programmable AI orchestration platform coordinating nine specialized sub-agents on Solana. The $VEXOR token governs runtime, staking, and protocol governance — launching soon.",
  keywords: [
    "AI agent",
    "on-chain agent",
    "Solana",
    "Vexor",
    "orchestrator",
    "multi-agent",
    "web3 AI",
  ],
  openGraph: {
    title: "Vexor Terminal — AI Orchestration Platform on Solana",
    description:
      "Programmable AI orchestration on Solana. Nine specialized sub-agents governed by the $VEXOR token — launching soon.",
    url: "https://vexorterminal.com",
    siteName: "Vexor Terminal",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1280,
        height: 320,
        alt: "Vexor Terminal — AI orchestration platform on Solana",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vexor Terminal — AI Orchestration Platform on Solana",
    description:
      "Programmable AI orchestration on Solana. Nine sub-agents governed by the $VEXOR token — launching soon.",
    site: "@vexorterminal",
    creator: "@vexorterminal",
    images: ["/og-image.png"],
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
