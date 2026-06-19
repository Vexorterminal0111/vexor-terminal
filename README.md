<div align="center">

<picture>
  <source srcset="docs/images/banner.png" type="image/png">
  <img src="docs/images/banner.svg" alt="Vexor Terminal — programmable AI orchestration on Solana" width="100%">
</picture>

<br>

**Programmable AI orchestration on [Solana](https://solana.com) — powered by $VEXOR.**
<br>
Nine specialized sub-agents, nine language models, one orchestrator.

<br>

[![Live site](https://img.shields.io/badge/live-vexorterminal.com-8b5cf6?style=flat-square&labelColor=0a1628)](https://vexorterminal.com)
[![Built for Solana](https://img.shields.io/badge/built%20for-Solana-9945ff?style=flat-square&labelColor=0a1628)](https://solana.com)
[![Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-f38020?style=flat-square&labelColor=0a1628)](https://workers.cloudflare.com)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&labelColor=0a1628)](https://nextjs.org)
[![Anchor](https://img.shields.io/badge/Anchor-Rust-e6522c?style=flat-square&labelColor=0a1628)](https://www.anchor-lang.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-8b5cf6?style=flat-square&labelColor=0a1628)](#license)

[**Live site** ↗](https://vexorterminal.com) ·
[Docs ↗](https://vexorterminal.com/docs) ·
[@Vexorterminal ↗](https://x.com/Vexorterminal)

<br>

<img src="docs/images/landing.png" alt="Vexor Terminal landing page" width="100%">

</div>

---

## Features

- **Vexor Orchestrator** — a single LLM that routes every request to one of 9 specialized sub-agents (Cipher, Atlas, Quill, Forge, Vector, Pulse, Halo, Prism, Nyx). Each agent runs on its own LLM and stays in lane.
- **$VEXOR token (Solana)** — SPL token on Solana mainnet (launching soon). 100B supply, 9 decimals. Hold to access elevated tiers, stake to earn pro-rata agent revenue, vote to direct protocol evolution.
- **Anchor programs** — revenue-share staking (`vexor-rev-share`), time-locked staking (`vexor-staking`), and SPL token mint (`vexor-token`) written in Rust/Anchor.
- **Wallet-gated console** — connect Phantom or Solflare, stake, govern — coming soon after token launch.
- **Production chat** — Groq Llama 3.3 70B proxied through a single Cloudflare Worker with strict CORS allowlist.
- **Static-first frontend** — Next.js 16 static export, hosted as Worker Assets — fast edge delivery worldwide, no Node runtime in production.
- **Vexor Intel** — daily autonomous market briefing at [`/intel`](https://vexorterminal.com/intel), powered by an [aeon-based agent](https://github.com/Vexorterminal0111/vexor-aeon). Five cards refresh on a UTC cadence: Morning Brief, Token Pulse, On-Chain Pulse, DeFi Overview, Evening Recap.
- **Vexor Pulse Premium** — per-token daily snapshots at [`/intel/<slug>`](https://vexorterminal.com/intel/vt) for Solana ecosystem tokens. Price, 24h %, volume, liquidity, FDV, plus an LLM Token Pulse card sourced from DexScreener.

---

## Quick start

```bash
git clone https://github.com/Vexorterminal0111/vexor-terminal.git
cd vexor-terminal
pnpm install
cp .env.example .env.local
pnpm dev          # → http://localhost:3000
```

Production build (always pass `--webpack` — see [Note on Next.js 16](#note-on-nextjs-16)):

```bash
pnpm build --webpack
```

The static site lands in `out/`. The Cloudflare Worker in `worker/` serves it through the `ASSETS` binding and routes `/api/chat` to the Groq proxy.

---

## On-chain

<div align="center">

<img src="docs/images/docs.png" alt="Vexor Terminal docs — contracts and architecture" width="100%">

</div>

### Solana mainnet · launching soon

| Program | Description | Status |
|---|---|---|
| `vexor-token` | SPL token mint — 100B supply, 9 decimals | Pre-launch |
| `vexor-rev-share` | Flat staking pool with pro-rata reward distribution | Pre-launch |
| `vexor-staking` | Time-locked staking with tier multipliers (30/90/180/365 days) | Pre-launch |

Anchor programs are in [`programs/`](./programs/). Build with:

```bash
anchor build
```

> $VEXOR is a utility token, not a security. Token launch and program deployment announcements will be posted on [@Vexorterminal](https://x.com/Vexorterminal).

---

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | Next.js 16 (App Router · static export) · TypeScript · Tailwind CSS v4 · Framer Motion · Geist / Geist Mono |
| **Web3** | @solana/wallet-adapter-react · @solana/web3.js · Phantom · Solflare |
| **Smart contracts** | Anchor (Rust) · SPL Token |
| **Chat backend (prod)** | Cloudflare Worker (TypeScript) · Groq (Llama 3.3 70B) |
| **Chat backend (local dev)** | FastAPI · Groq · `uv` |
| **Hosting** | Cloudflare Workers + Assets (static site + edge function in one Worker) |
| **CI / lint** | ESLint flat config · `npx tsc --noEmit` |

---

## Repo layout

```
.
├── src/                       # Next.js app (landing + /docs)
│   ├── app/                   # Routes, layout, static export config
│   ├── components/            # Nav, Hero, Console, Chat, Docs, ...
│   └── lib/contracts.ts       # Contract addresses + ABIs (frontend)
├── worker/                    # Cloudflare Worker (production runtime)
│   ├── index.ts               # Entry — routes /api/chat + serves assets
│   ├── chat.ts                # Groq proxy + CORS allowlist
│   ├── watchtower.ts          # Telegram bot (Watchtower)
│   ├── researcher.ts          # Telegram /research command
│   ├── rpc.ts                 # Solana JSON-RPC helpers
│   └── tsconfig.json
├── programs/                  # Anchor programs (Rust)
│   ├── vexor-token/           # SPL token mint
│   ├── vexor-rev-share/       # Revenue-share staking pool
│   └── vexor-staking/         # Time-locked staking
├── wrangler.jsonc             # Cloudflare Workers config
├── apps/chat-api/             # FastAPI chat proxy (local dev only)
├── docs/images/               # README screenshots + banner
└── public/                    # Static assets (favicons, OG, logo)
```

---

## Architecture

```
       ┌─────────────────┐         POST /api/chat        ┌─────────────────┐
       │   Browser        │ ───────────────────────────▶  │ Cloudflare      │
       │ (Next.js SSG)    │ ◀────────────────────────────│ Worker          │
       └────────┬─────────┘    {reply, cost_units, ...}  │   (worker/)     │
                │ wallet RPC                              │ ASSETS binding  │
                ▼                                         └────────┬────────┘
       ┌─────────────────┐                                         │ HTTPS
       │ Solana mainnet  │                                         ▼
       │  - $VEXOR (SPL) │                                ┌─────────────────┐
       │  - RevShare     │                                │ Groq            │
       │  - Staking      │                                │ Llama 3.3 70B   │
       └─────────────────┘                                └─────────────────┘
```

- Frontend is statically exported and served by the Worker `ASSETS` binding.
- `/api/chat` is the only dynamic route — handled by `worker/chat.ts`, talks to Groq.
- Wallet connects via `@solana/wallet-adapter-react` (Phantom / Solflare).
- Rate limiting is delegated to Cloudflare Rate Limiting Rules.

---

## Anchor programs

```bash
cd programs
anchor build
```

Three programs:

1. **vexor-token** — SPL token mint with authority controls. 100B supply, 9 decimals.
2. **vexor-rev-share** — flat staking pool. Stake $VEXOR, owner pushes rewards pro-rata to all stakers.
3. **vexor-staking** — time-locked staking with 4 tiers (30d/90d/180d/365d) and weighted multipliers for governance voting power.

All programs compile to `.so` via `anchor build`. Deployment instructions will be published at launch.

---

## Deploy — Cloudflare Workers

Production is a single Cloudflare Worker that:
1. Serves the Next.js static export via the `ASSETS` binding.
2. Routes `POST /api/chat` to `worker/chat.ts`.

Config lives in [`wrangler.jsonc`](./wrangler.jsonc).

**Workers Builds (GitHub-connected)** — set these in the Cloudflare dashboard:

| Setting | Value |
|---|---|
| Build command | `pnpm build --webpack` |
| Deploy command | `npx wrangler deploy` (auto, reads `wrangler.jsonc`) |
| Root directory | `/` |

**Secrets** (set in dashboard, not in repo):

| Name | Where | Notes |
|---|---|---|
| `GROQ_API_KEY` | Worker secret | Used by `worker/chat.ts` |
| `ALLOWED_ORIGINS` | Worker var | `https://vexorterminal.com,https://www.vexorterminal.com` |

Manual deploy from a local clone:

```bash
pnpm build --webpack
npx wrangler deploy
```

---

## Chat API

### Production — Cloudflare Worker

Lives in [`worker/chat.ts`](./worker/chat.ts), mounted by [`worker/index.ts`](./worker/index.ts) at `/api/chat`. Validates the wallet address (Solana base58), calls Groq (Llama 3.3 70B) with the Vexor orchestrator system prompt, returns the reply. CORS is strictly allowlisted via `ALLOWED_ORIGINS`.

Type-check locally:

```bash
npx tsc --noEmit -p worker/tsconfig.json
```

### Local dev — FastAPI

For a long-lived dev server (e.g. when iterating on prompt logic), use the Python mirror in [`apps/chat-api/`](apps/chat-api/):

```bash
cd apps/chat-api
uv sync
export GROQ_API_KEY=...
uvicorn vexor_chat.main:app --reload --port 8000
```

Then set `NEXT_PUBLIC_CHAT_API_URL=http://localhost:8000` in `.env.local`.

---

## Note on Next.js 16

Always build with `--webpack`:

```bash
pnpm build --webpack
```

Turbopack currently emits chunk filenames with double dots, which some static hosts (including Cloudflare's `ASSETS` binding) strip. See [`AGENTS.md`](./AGENTS.md) for details.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| 1. Landing | **Live** | Marketing site, branding, docs |
| 2. Chat | **Live (beta)** | Llama 3.3 70B routed by Vexor, rate-limited at the edge |
| 3. Intel | **Live** | Autonomous market briefing + per-token snapshots |
| 4. Token launch | Planned | $VEXOR SPL token on Solana mainnet |
| 5. Staking + RevShare | Planned | Anchor programs deployed to Solana mainnet |
| 6. Governance | Planned | On-chain governance weighted by staked balance |
| 7. Sub-agent runtime | Planned | Real orchestrator + 9 sub-agents on production hardware |

---

## Links

- **Live site** — https://vexorterminal.com
- **Docs** — https://vexorterminal.com/docs
- **X / Twitter** — [@Vexorterminal](https://x.com/Vexorterminal)
- **GitHub** — https://github.com/Vexorterminal0111/vexor-terminal

---

## License

MIT — see [`LICENSE`](./LICENSE) (or the SPDX identifier `MIT` in source headers).

<div align="center">

<sub>Programmable AI orchestration on Solana. $VEXOR launching soon.</sub>

</div>
