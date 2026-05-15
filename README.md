# Vexor Terminal

> An autonomous AI orchestrator with 9 specialized sub-agents. On-chain identity on Base — coming soon.

This is the landing site for **Vexor Terminal**, an AI orchestrator agent inspired by personal AI systems like [thealeister.com](https://thealeister.com) but designed from day one to live on-chain on [Base](https://base.org).

## Stack

- **Next.js 16** (App Router, static export)
- **TypeScript** + **Tailwind CSS v4**
- **Framer Motion** for animations
- **Lucide** icons
- **Geist** + **Geist Mono** fonts

## Roadmap

This repository is currently **phase 1** — the marketing landing page. Upcoming phases:

| Phase | Status | Description |
|---|---|---|
| **1. Landing** | Live | Marketing site, branding, waitlist |
| **2. Smart Contracts** | Planned | `Vexor.sol` (ERC-721 orchestrator NFT), `SubAgent.sol` (ERC-1155 sub-agent NFTs), `ReputationSBT.sol` (ERC-5192 reputation), `AgentWallet` (ERC-4337 smart wallet per agent) |
| **3. dApp** | Planned | Mint flow, owner dashboard, public agent profile, chat interface |
| **4. Audit + Mainnet** | Planned | External audit → Base mainnet launch |

## Local Development

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

## Build & Static Export

```bash
pnpm build
```

The static site is emitted to `out/`. The site is fully static and can be deployed to any static host (Vercel, Cloudflare Pages, Netlify, S3, etc.).

## Project Structure

```
src/
├── app/                # Next.js App Router
│   ├── layout.tsx      # Root layout, metadata, fonts
│   ├── page.tsx        # Landing page composition
│   └── globals.css     # Tailwind + design tokens
├── components/         # Section components
│   ├── Nav.tsx
│   ├── Hero.tsx
│   ├── Marquee.tsx
│   ├── About.tsx
│   ├── Team.tsx
│   ├── UseCases.tsx
│   ├── Services.tsx
│   └── Footer.tsx
└── lib/
    └── utils.ts        # cn() helper
```

## License

MIT
