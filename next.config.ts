import type { NextConfig } from "next";

const DEV_TUNNEL_PATTERNS = [
  "trycloudflare.com",
  "ngrok.io",
  "ngrok-free.app",
  "ngrok.app",
  "lhr.life",
  "loca.lt",
];

function assertSafeChatApiUrl() {
  const raw = process.env.NEXT_PUBLIC_CHAT_API_URL?.trim();
  if (!raw) return;

  const lower = raw.toLowerCase();
  const matchedTunnel = DEV_TUNNEL_PATTERNS.find((p) => lower.includes(p));
  const isLocalhost =
    lower.includes("://localhost") ||
    lower.includes("://127.0.0.1") ||
    lower.includes("://0.0.0.0");

  if (!matchedTunnel && !isLocalhost) return;

  const reason = matchedTunnel
    ? `dev tunnel host "${matchedTunnel}"`
    : "localhost URL";
  throw new Error(
    [
      "",
      "  ✘ NEXT_PUBLIC_CHAT_API_URL points at a " + reason + ":",
      "    " + raw,
      "",
      "  This value gets baked into the static export and shipped to production.",
      "  All /api/chat calls from the browser would try to hit a dev-only host",
      "  that does not resolve from end users, breaking every chat surface.",
      "",
      "  Fix: clear the value in .env.local before building for production",
      "       so the frontend falls back to the same-origin /api/chat:",
      "",
      "    sed -i 's|^NEXT_PUBLIC_CHAT_API_URL=.*|NEXT_PUBLIC_CHAT_API_URL=|' .env.local",
      "",
    ].join("\n"),
  );
}

assertSafeChatApiUrl();

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
