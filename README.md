# Vexor Terminal

> An autonomous AI orchestrator commanding 9 specialized sub-agents, powered by **$VEXOR** on **Base**.

- **Production**: https://vexorterminal.com (Cloudflare Pages)
- **X / Twitter**: [@vexorterminal](https://x.com/vexorterminal)

This monorepo contains the marketing site, the Console dApp (wallet connect + claim / stake / govern), a chat backend (Cloudflare Pages Function in production, FastAPI for local dev), and the smart contracts deployed on Base Sepolia.

## Stack

- **Frontend** — Next.js 16 (App Router, static export) · TypeScript · Tailwind CSS v4 · Framer Motion · wagmi v2 + viem + RainbowKit · Geist / Geist Mono.
- **Smart contracts** — Solidity 0.8.26 · Foundry · OpenZeppelin v5.
- **Chat backend (prod)** — Cloudflare Worker (TypeScript) · Groq (Llama 3.3 70B).
- **Chat backend (local dev)** — FastAPI · Groq.

## Live on Base Sepolia

| Contract | Address | Basescan |
|---|---|---|
| `VexorToken` (ERC-20Votes + Permit + faucet) | `0x200b75db62fa66f325191b34ef784ade26321570` | [view](https://sepolia.basescan.org/address/0x200b75db62fa66f325191b34ef784ade26321570) |
| `VexorStaking` (4-tier lock) | `0x6a345b8390a67681764521d146853211dd089062` | [view](https://sepolia.basescan.org/address/0x6a345b8390a67681764521d146853211dd089062) |
| `VexorGovernor` (OZ Governor v5) | `0xd1850b4c2e663b45a49330d00637db78197be31c` | [view](https://sepolia.basescan.org/address/0xd1850b4c2e663b45a49330d00637db78197be31c) |

## Repo layout

```
.
├── src/                       # Next.js app (landing + /docs)
│   ├── app/                   # Routes + layout + static export config
│   ├── components/            # Nav, Hero, Console, Chat, Docs, ...
│   └── lib/contracts.ts       # Contract addresses + ABIs (frontend)
├── worker/                    # Cloudflare Worker (production)
│   ├── index.ts               # Entry point — routes /api/chat + assets
│   └── chat.ts                # Groq proxy handler
├── wrangler.jsonc             # Cloudflare Workers config
├── contracts/                 # Foundry project (Token / Staking / Governor)
├── apps/chat-api/             # FastAPI chat proxy (local dev only)
└── public/                    # Static assets (favicons, OG, logo)
```

## Frontend — local dev

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

Environment (`.env.local`):

```
# In production (Cloudflare Worker) leave empty — frontend uses /api/chat
# on same origin (served by worker/index.ts → worker/chat.ts).
NEXT_PUBLIC_CHAT_API_URL=http://localhost:8000
NEXT_PUBLIC_VEXOR_TOKEN_TESTNET=0x200b75db62fa66f325191b34ef784ade26321570
NEXT_PUBLIC_VEXOR_STAKING_TESTNET=0x6a345b8390a67681764521d146853211dd089062
NEXT_PUBLIC_VEXOR_GOVERNANCE_TESTNET=0xd1850b4c2e663b45a49330d00637db78197be31c
```

## Frontend — build

```bash
pnpm build --webpack
```

Static site lands in `out/`. Deploy to any static host (Cloudflare Pages, Vercel, Netlify, S3).

> **Note (Next.js 16):** use `--webpack` for production builds — Turbopack currently emits filenames with double dots that some static hosts strip. See `AGENTS.md`.

## Deploy — Cloudflare Workers

Production is a single Cloudflare Worker that serves the Next.js static export
via the ASSETS binding and routes `/api/chat` to the Groq proxy in
`worker/chat.ts`. Configuration is in `wrangler.jsonc` at the repo root.

Workers Builds (GitHub-connected) settings:

- **Build command**: `pnpm build --webpack`
- **Deploy command**: `npx wrangler deploy` (auto, picks up wrangler.jsonc)
- **Root directory**: `/`
- **Environment variables** (set as Worker secrets / vars in the dashboard):
  - `GROQ_API_KEY` — secret, used by `worker/chat.ts`
  - `ALLOWED_ORIGINS` — `https://vexorterminal.com,https://www.vexorterminal.com`
  - `NEXT_PUBLIC_VEXOR_TOKEN_TESTNET`, `NEXT_PUBLIC_VEXOR_STAKING_TESTNET`, `NEXT_PUBLIC_VEXOR_GOVERNANCE_TESTNET` — baked into the build, set on the build environment, not as Worker runtime vars

Rate limiting is intentionally NOT done in the Worker (module-scope state
doesn't survive isolate recycles). Use Cloudflare's Rate Limiting Rules on the
`/api/chat` path in the dashboard instead.

## Smart contracts

See [`contracts/README.md`](contracts/README.md) for setup, test, and deploy instructions.

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge build
forge test -vv      # 9/9 passing
```

## Chat API (production)

The production handler lives at `worker/chat.ts`, mounted by
`worker/index.ts` at `/api/chat`. It validates the wallet address, calls
Groq (Llama 3.3 70B) with the Vexor orchestrator system prompt, and returns
the reply. CORS is strictly allowlisted via `ALLOWED_ORIGINS`.

Type-check locally:

```bash
npx tsc --noEmit -p worker/tsconfig.json
```

## Chat API — local dev (FastAPI)

For local development against a long-lived dev server, see [`apps/chat-api/README.md`](apps/chat-api/README.md). The Python server in `apps/chat-api/main.py` mirrors the TypeScript handler.

```bash
cd apps/chat-api
uv sync
export GROQ_API_KEY=...
uvicorn main:app --reload --port 8000
```

In `.env.local` set `NEXT_PUBLIC_CHAT_API_URL=http://localhost:8000`.

## Roadmap

| Phase | Status | Description |
|---|---|---|
| 1. Landing | **Live** | Marketing site, branding, docs |
| 2. Console | **Live (testnet)** | Wallet connect + claim / stake / govern / tier on Base Sepolia |
| 3. Chat | **Live (beta)** | Llama 3.3 70B routed by Vexor, wallet-gated |
| 4. Mainnet token | Planned | $VEXOR launch on Base (venue + tokenomics TBA) |
| 5. Sub-agent runtime | Planned | Real orchestrator + 9 sub-agents on production hardware |

## License

MIT
