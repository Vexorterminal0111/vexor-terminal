# Vexor Chat API

FastAPI backend that proxies chat requests to Groq (Llama 3.3 70B versatile)
for the Vexor Terminal agent chat. Free hosted model on a generous free tier.
Includes:

- Wallet-gated requests (every call requires a 0x... address)
- Per-wallet/IP rate limit (default: 5 msgs / 10s)
- Sub-agent role-playing system prompt
- CORS for `*.devinapps.com` and the Vexor Terminal domain

## Local dev

```bash
cd apps/chat-api
uv venv && source .venv/bin/activate
uv pip install -e .
cp .env.example .env  # fill GROQ_API_KEY
uvicorn vexor_chat.main:app --reload --port 8000
```

## Deploy (Fly.io via Devin)

```bash
deploy backend apps/chat-api
```

Set `GROQ_API_KEY` as a Fly.io secret after deploy:

```bash
fly secrets set GROQ_API_KEY=gsk_...
```

## Endpoints

- `GET /health` → liveness
- `GET /` → service metadata
- `POST /api/chat` → chat completion

Request:
```json
{
  "wallet": "0x1234...abcd",
  "messages": [{ "role": "user", "content": "Hi Vexor" }]
}
```

Response:
```json
{
  "reply": "...",
  "model": "llama-3.3-70b-versatile",
  "cost_units": 0.1
}
```
