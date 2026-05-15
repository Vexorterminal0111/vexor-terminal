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
| **2. $VEXOR Token** | Planned | `VexorToken.sol` (ERC-20 on Base), `VexorStaking.sol` (lock + revenue share), `VexorGovernor.sol` (token-weighted voting), `VexorTreasury.sol` (revenue collection) |
| **3. dApp** | Planned | Token dashboard, stake/unstake flow, governance interface, agent chat with $VEXOR metering |
| **4. Audit + Launch** | Planned | External audit → token launch on Base (venue and model TBA) |

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
