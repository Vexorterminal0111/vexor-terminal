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

### 2. /docs resolves via auto-trailing-slash + mainnet CAs are present
```
curl -s https://vexorterminal.com/docs | grep -o '0x2c684D666998436634EcEde1527EdA7975427Ba3' | head -1
# expect the mainnet $VT address echoed back
curl -s https://vexorterminal.com/docs | grep -o '0xE25f6243f848523c4577639e975B9F3E0fA57186' | head -1
# expect the mainnet VexorRevShare address echoed back
```
Proves `html_handling: "auto-trailing-slash"` is wired and the multi-page export is being served. The mainnet $VT CA (`0x2c684D666998436634EcEde1527EdA7975427Ba3`) and VexorRevShare CA (`0xE25f6243f848523c4577639e975B9F3E0fA57186`) are hard-coded in `src/components/Docs.tsx` and `src/components/Footer.tsx`.

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

## Verifying that an on-chain contract is verified on Basescan

Whenever testing a PR that surfaces a new contract address on the site (e.g., `VexorRevShare`, future staking V2, future Governor mainnet), assert that the address (a) is a real deployed contract on Base mainnet and (b) has source code verified.

First preference would be to click the Basescan link from the site and look for the green "Contract Source Code Verified" badge. However, **Basescan's UI often returns a Cloudflare anti-bot challenge for headless browsers** (including the Devin test browser), so the contract page may never render.

Workaround: fetch the same verified status from the **Etherscan V2 unified API**, which is the same source of truth that powers the green-verified badge and works without the anti-bot challenge:

```
curl -s "https://api.etherscan.io/v2/api?chainid=8453&module=contract&action=getsourcecode&address=0xE25f6243f848523c4577639e975B9F3E0fA57186&apikey=${BASESCAN_API_KEY}"
```

What to assert in the JSON response:
- `result[0].ContractName` matches the expected contract name (e.g. `VexorRevShare`, `VexorToken`).
- `result[0].SourceCode` is non-empty.
- `result[0].CompilerVersion` is non-empty.
- `result[0].Proxy == "0"` (or `"1"` if expecting a proxy).

A single Etherscan V2 API key (one free key from https://etherscan.io/myapikey) works for all 60+ chains via the `chainid` query param — Base mainnet is `8453`, Base Sepolia is `84532`, Ethereum mainnet is `1`. This is the migration target from the deprecated per-chain Basescan API. The Devin secret `BASESCAN_API_KEY` is reusable across sessions.

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

### .env.local gotcha — clear `NEXT_PUBLIC_CHAT_API_URL` before every prod build

Next.js loads `.env.local` for **every** build, including production. If a previous session set `NEXT_PUBLIC_CHAT_API_URL=https://<some>.trycloudflare.com` (e.g. for local Worker tunnelling), that value gets **baked into the static export** and shipped to production — every `/api/chat` call from the browser then tries to hit the (long-dead) dev tunnel and fails with `net::ERR_NAME_NOT_RESOLVED`.

Before running `pnpm build --webpack`, **always** ensure the env var is empty so the frontend falls back to the same-origin `/api/chat`:

```
grep -n NEXT_PUBLIC_CHAT_API_URL /home/ubuntu/repos/vexor-terminal/.env.local
# expect: NEXT_PUBLIC_CHAT_API_URL=     (empty value after =)
```

If it's not empty, blank it out before building:
```
sed -i 's|^NEXT_PUBLIC_CHAT_API_URL=.*|NEXT_PUBLIC_CHAT_API_URL=|' /home/ubuntu/repos/vexor-terminal/.env.local
```

After deploy, verify the production bundle does NOT reference any `trycloudflare`/`ngrok` URL:
```
curl -s https://vexorterminal.com/agents/cipher | grep -oE 'page-[a-f0-9]{16}\.js' | head -1
# then download that chunk and grep for trycloudflare — should return nothing
```

This same `.env.local` value also affects the main `/chat` orchestrator (`Chat.tsx`) and every `/agents/<slug>` page (`AgentChat.tsx`) — both modules use `process.env.NEXT_PUBLIC_CHAT_API_URL` with same-origin `/api/chat` as the fallback.

## What to do for full UI testing

If the task requires UI screenshots / a recording:
1. Maximize the browser: `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz` (install `wmctrl` if missing).
2. Open `https://vexorterminal.com/` and `https://vexorterminal.com/docs` and capture full screenshots.
3. Use devtools `fetch('/api/chat', {...})` to exercise `/api/chat` end-to-end and capture the response — easier than scripting RainbowKit (which requires MetaMask).
4. For headless DOM-level assertions (anchor `href`, attribute existence, button presence) prefer `browser_console` over screenshot-only verification — the runtime DOM after hydration may differ from the static HTML.

### Wallet-connect and on-chain Console actions

The Console + RevShare tabs use RainbowKit + wagmi and need a real wallet. The test browser does not have MetaMask, so claim / stake / govern / faucet / withdraw flows cannot be UI-tested end-to-end from a fresh Devin session.

**Chain split is intentional** — marketing surfaces (Docs, Footer, Hero) and the new RevShare Console point at mainnet contracts, while the legacy interactive Console runs on Base Sepolia testnet so anyone can try it without paying real gas:

- **$VT (Base mainnet, chainId 8453)**: `0x2c684D666998436634EcEde1527EdA7975427Ba3` — production token, 100B supply, 18 decimals.
- **VexorRevShare (Base mainnet, chainId 8453)**: `0xE25f6243f848523c4577639e975B9F3E0fA57186` — production single-sided staking pool, flat (no tier, no lock), manual pro-rata reward push via `pushRewards(amount)`. Owner: same as deployer (`0x0259abb884050E19e787cF7E271b6984E13BD79B`).
- **Console demo (Base Sepolia, chainId 84532)** — loaded from `src/lib/contracts.ts`:
  - Token: `0x200b75db62fa66f325191b34ef784ade26321570`
  - Staking: `0x6a345b8390a67681764521d146853211dd089062`
  - Governor: `0xd1850b4c2e663b45a49330d00637db78197be31c`

If a UI test of the on-chain flows is required, ask the user to walk through them themselves in their own browser and send screenshots, or to install MetaMask in the test browser ahead of time and pre-import a test wallet funded with Sepolia ETH / faucet testnet $VT (for Sepolia Console) or Base-mainnet ETH + $VT (for RevShare Console).

#### Pattern for testing wallet-gated UI WITHOUT a private key

Even without a connected wallet, you can prove the user-visible feature renders + is wired correctly. Use this five-step pattern (used end-to-end for the RevShare Console PR #17 + PR #18 — see those PRs for a concrete example):

1. **Verify the section renders + copy is correct.** Navigate to the anchor (e.g. `/#revshare`) and assert the H2 / kicker / description text matches expected strings exactly. A broken bundle would land at page bottom with none of these strings in the DOM.
2. **Assert the disconnected gate's copy.** Each wallet-gated component should expose an unmistakable `ConnectGate` (terminal-prompt line + heading + `Connect Wallet` button). Verify all three are visible — proves the component is mounting in the `!isConnected` branch.
3. **Click `Connect Wallet` to prove RainbowKit wiring.** A working `ConnectButton.Custom` should open the RainbowKit modal with wallet options (Rainbow / Base / MetaMask / WalletConnect). If the button no-ops, the wiring is broken. Close the modal with Escape — do NOT proceed to actually connect.
4. **Read full `href` values via `browser_console`.** The annotated DOM that comes back from the computer tool truncates long URLs like `https://basescan.org/address/0xE25f6243f848523c...`. Use `browser_console` to query `document.querySelectorAll` and read `.href` on each anchor — this gives you the full URL for exact-match assertions. Example:
   ```js
   Array.from(document.querySelectorAll('section a')).map(a => ({text: a.textContent.trim(), href: a.href}))
   ```
5. **Cross-check contract addresses via Etherscan V2 API** (see workaround section above) to prove the address the UI links to is actually the verified contract the PR claims.

Explicitly list connected-state flows that cannot be exercised (stake / withdraw / claim tx, mode tab swaps that only render in `RevSharePanel`, TxReceipt confirmation, WrongChainGate switch button) as **untested-by-design** in the test report. Failing loudly beats fake-passing.

#### wagmi quirk: `useChainId` returns the default chain when disconnected

When reading `useChainId()` from wagmi while no wallet is connected, it returns the **configured default chain ID**, not `undefined`. In this repo that means `useChainId() === base.id` (8453) is `true` even on a fresh page load without a wallet.

In `RevShareConsole.tsx`, the visible terminal-strip mode label is derived as:
```ts
{onBaseMainnet ? "base-mainnet" : chainId ? "wrong-chain" : "disconnected"}
```
where `onBaseMainnet = useChainId() === base.id`. So the disconnected state shows `vexor@revshare — base-mainnet`, NOT `disconnected`. This is intentional — the AUTH state is separately tracked via `isConnected` (which correctly shows `AUTH PENDING` when no wallet). When writing test plans, expect `base-mainnet` + `AUTH PENDING` on a fresh page load, not `disconnected`.

### Mobile-viewport regression

Forcing a 375px viewport in the test browser is not reliable: `wmctrl -e` to resize the Chrome window doesn't always shrink the framebuffer that screenshots capture. If a real mobile rendering test is needed, prefer Chrome DevTools device mode opened by hand, or have the user verify on their actual phone and send a screenshot.

## Devin secrets needed

- `CLOUDFLARE_API_TOKEN` — required to redeploy or update Worker secrets. Token must have Account → Workers Scripts → Edit, plus Zone → DNS → Edit (for attaching custom domains). Watch out for the `start_date` field when creating tokens — leave it empty or the token won't be usable until that date.
- `GROQ_API_KEY` — only needed if redeploying the Worker secret. Server-side only.
- `BASESCAN_API_KEY` — Etherscan V2 unified API key (one key works for all 60+ chains). Required for the verified-contract API workaround when Basescan UI is gated behind Cloudflare anti-bot in the test browser. Get free at https://etherscan.io/myapikey.

No wallet/private-key secret is needed for the four health checks above, nor for the wallet-gated UI render checks (see pattern above). A wallet seed would only be needed to fully exercise the on-chain stake/withdraw/claim/vote flows.
