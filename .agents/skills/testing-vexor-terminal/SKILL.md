---
name: testing-vexor-terminal
description: End-to-end test the live Vexor Terminal deploy at https://vexorterminal.com (Cloudflare Workers + Assets, Next.js static export, /api/chat Groq proxy). Use when verifying any change that ships to production or when the user asks for a smoke test of the live site.
---

# Testing Vexor Terminal in production

Live URL: https://vexorterminal.com (apex + www).
Backup Worker URL: https://vexor-terminal.habibullahsuteja.workers.dev

The production deploy is a single Cloudflare Worker (`vexor-terminal`) that
- serves the Next.js static export from `./out` via the `ASSETS` binding (configured in `wrangler.jsonc`), and
- handles `POST /api/chat` in `worker/chat.ts` by proxying to Groq.

## The four high-signal checks

These four assertions together prove the deploy is healthy. Run all four whenever a change ships.

### 1. Landing page (apex domain serves Next.js export)
```
curl -s -o /dev/null -w '%{http_code}\n' https://vexorterminal.com/
# expect 200
curl -s https://vexorterminal.com/ | grep -c "I&#39;m\|I'm Vexor"
# expect >= 1
```
If 0, the `assets` binding in `wrangler.jsonc` or the fall-through in `worker/index.ts` is broken — the URL is serving the Worker JS or a Cloudflare placeholder.

### 2. /docs resolves via auto-trailing-slash
```
curl -s https://vexorterminal.com/docs | grep -o '0x2c684D666998436634EcEde1527EdA7975427Ba3' | head -1
# expect the mainnet $VT address echoed back
```
Proves `html_handling: "auto-trailing-slash"` is wired and the multi-page export is being served. The mainnet $VT CA (`0x2c684D666998436634EcEde1527EdA7975427Ba3`) is hard-coded in `src/components/Docs.tsx` and `src/components/Footer.tsx`.

### 3. /api/chat returns a real Groq reply
```
curl -s -X POST https://vexorterminal.com/api/chat \
  -H 'content-type: application/json' \
  -H 'origin: https://vexorterminal.com' \
  -d '{"wallet":"0x0000000000000000000000000000000000000001","messages":[{"role":"user","content":"Reply with one short sentence."}]}'
# expect JSON: {"reply": "<non-empty>", "model": "llama-3.3-70b-versatile", "cost_units": 0.1}
```
If `{"detail": "GROQ_API_KEY is not configured on the server."}` is returned, the Worker secret is missing — set it with `wrangler secret put GROQ_API_KEY`.

### 4. CORS strict allowlist (regression check)
```
# Untrusted origin: must NOT echo allow-origin
curl -s -i -X OPTIONS https://vexorterminal.com/api/chat \
  -H 'origin: https://evil-attacker.pages.dev' \
  -H 'access-control-request-method: POST' | grep -i 'access-control-allow-origin'
# expect: empty (no match)

# Trusted origin: MUST echo allow-origin
curl -s -i -X OPTIONS https://vexorterminal.com/api/chat \
  -H 'origin: https://vexorterminal.com' \
  -H 'access-control-request-method: POST' | grep -i 'access-control-allow-origin'
# expect: access-control-allow-origin: https://vexorterminal.com
```
If the untrusted origin gets `access-control-allow-origin` echoed back, the strict allowlist in `worker/chat.ts`'s `parseAllowedOrigins` has regressed — likely someone re-added a regex fallback.

## Deploy + secret management

Workers Builds CI on the GitHub side is known to be environmentally broken on this project (the Cloudflare build token has been rolled). Don't rely on CI for production deploys. Instead deploy directly with the wrangler CLI from the repo:

```
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN pnpm install
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN pnpm build --webpack   # NOTE: --webpack is required, Turbopack output is broken on static hosts
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN npx wrangler deploy
```

Worker secrets (set once, persist across deploys):
- `GROQ_API_KEY` — Groq API key (server-side only, never `NEXT_PUBLIC_*`).
- `ALLOWED_ORIGINS` — comma-separated allowlist, currently `https://vexorterminal.com,https://www.vexorterminal.com`.

Update via:
```
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN npx wrangler secret put GROQ_API_KEY
```

If the user wants auto-deploy on push to main, they must manually reconnect the Workers Builds GitHub integration in the Cloudflare dashboard at `Workers → vexor-terminal → Settings → Builds → Reconnect`. There's no way to fix this from inside a Devin session.

## What to do for full UI testing

If the task requires UI screenshots / a recording:
1. Maximize the browser: `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz` (install `wmctrl` if missing).
2. Open `https://vexorterminal.com/` and `https://vexorterminal.com/docs` and capture full screenshots.
3. Use devtools `fetch('/api/chat', {...})` to exercise `/api/chat` end-to-end and capture the response — easier than scripting RainbowKit (which requires MetaMask).

### Wallet-connect and on-chain Console actions

The Console tab uses RainbowKit + wagmi and needs a real wallet. The test browser does not have MetaMask, so claim / stake / govern / faucet flows cannot be UI-tested from a fresh Devin session.

**Chain split is intentional** — marketing surfaces (Docs, Footer, Hero) point at the mainnet $VT token, while the interactive Console runs on Base Sepolia testnet so anyone can try it without paying real gas:

- **$VT (Base mainnet, chainId 8453)**: `0x2c684D666998436634EcEde1527EdA7975427Ba3` — production token, 100B supply, 18 decimals. Hard-coded in `src/components/Docs.tsx` and `src/components/Footer.tsx`.
- **Console demo (Base Sepolia, chainId 84532)** — still loaded from `src/lib/contracts.ts`, validated in prior sessions:
  - Token: `0x200b75db62fa66f325191b34ef784ade26321570`
  - Staking: `0x6a345b8390a67681764521d146853211dd089062`
  - Governor: `0xd1850b4c2e663b45a49330d00637db78197be31c`

If a UI test of the console flows is required, ask the user to walk through them themselves in their own browser and send screenshots, or to install MetaMask in the test browser ahead of time and pre-import a test wallet funded with Sepolia ETH and faucet testnet $VT.

### Mobile-viewport regression

Forcing a 375px viewport in the test browser is not reliable: `wmctrl -e` to resize the Chrome window doesn't always shrink the framebuffer that screenshots capture. If a real mobile rendering test is needed, prefer Chrome DevTools device mode opened by hand, or have the user verify on their actual phone and send a screenshot.

## Devin secrets needed

- `CLOUDFLARE_API_TOKEN` — required to redeploy or update Worker secrets. Token must have Account → Workers Scripts → Edit, plus Zone → DNS → Edit (for attaching custom domains). Watch out for the `start_date` field when creating tokens — leave it empty or the token won't be usable until that date.
- `GROQ_API_KEY` — only needed if redeploying the Worker secret. Server-side only.

No wallet/private-key secret is needed for the four health checks above.
