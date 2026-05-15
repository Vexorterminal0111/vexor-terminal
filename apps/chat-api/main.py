from __future__ import annotations

import os
import re
import time
from collections import defaultdict, deque
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import APIError, Groq
from pydantic import BaseModel, Field, field_validator

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
MAX_TOKENS = int(os.environ.get("GROQ_MAX_TOKENS", "768"))
RATE_LIMIT_WINDOW_SEC = float(os.environ.get("RATE_LIMIT_WINDOW_SEC", "10"))
RATE_LIMIT_MAX_MSGS = int(os.environ.get("RATE_LIMIT_MAX_MSGS", "5"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://out-fvrnnfun.devinapps.com,https://vexorterminal.xyz",
    ).split(",")
    if o.strip()
]

SUB_AGENTS = [
    ("Cipher", "cryptography, encryption, on-chain proofs"),
    ("Atlas", "research, knowledge synthesis, web search"),
    ("Quill", "writing, content, narrative"),
    ("Forge", "code generation, refactor, debugging"),
    ("Vector", "vector search, embeddings, memory recall"),
    ("Pulse", "monitoring, alerts, real-time streams"),
    ("Halo", "vision, image analysis, multimodal"),
    ("Prism", "data viz, charts, analytics"),
    ("Nyx", "low-level ops, sandbox execution, shell"),
]

SYSTEM_PROMPT = """You are Vexor — an autonomous AI orchestrator running on Base.
You command 9 specialized sub-agents and route work to whichever is best suited
for each task. Speak with confidence, terminal aesthetic, monospace flavor.
Keep responses tight (2-5 short paragraphs max). Never break character.

Your 9 sub-agents (mention by name when routing):
{agents}

House style:
- Lead with the answer, then explain.
- When you "dispatch" to a sub-agent, prefix that paragraph with `> [Agent.Name]`.
- Use short, technical phrasing. Avoid filler ("Great question!", "Certainly!").
- You exist on Base. $VEXOR is the native ERC-20 token of the protocol.
- Tokenomics and launch details are not yet finalized. Do not invent numbers,
  prices, supply, or dates. If asked, say they will be announced before launch.
- Do not give financial advice. Do not promise returns.
- You can role-play technical scenarios but stay grounded in reality."""

system_prompt = SYSTEM_PROMPT.format(
    agents="\n".join(f"- {name} — {desc}" for name, desc in SUB_AGENTS)
)

app = FastAPI(title="Vexor Chat API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://[a-z0-9-]+\.devinapps\.com$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

_client: Groq | None = None


def get_client() -> Groq:
    global _client
    if _client is None:
        if not GROQ_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="GROQ_API_KEY is not configured on the server.",
            )
        _client = Groq(api_key=GROQ_API_KEY)
    return _client


_recent: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=RATE_LIMIT_MAX_MSGS))


def rate_limited(key: str) -> bool:
    now = time.monotonic()
    bucket = _recent[key]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_MAX_MSGS:
        return True
    bucket.append(now)
    return False


WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def trim(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("empty message")
        return v[:4000]


class ChatRequest(BaseModel):
    wallet: str = Field(..., description="Connected EVM wallet address (0x...).")
    messages: list[Message] = Field(..., min_length=1, max_length=40)

    @field_validator("wallet")
    @classmethod
    def check_wallet(cls, v: str) -> str:
        if not WALLET_RE.match(v):
            raise ValueError("invalid wallet address")
        return v.lower()


class ChatResponse(BaseModel):
    reply: str
    model: str
    cost_units: float


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL}


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "Vexor Chat API",
        "version": "0.1.0",
        "model": MODEL,
        "endpoints": ["/health", "/api/chat"],
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "anon")
    )
    rl_key = f"{payload.wallet}:{client_ip}"
    if rate_limited(rl_key):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: max {RATE_LIMIT_MAX_MSGS} messages per {int(RATE_LIMIT_WINDOW_SEC)}s.",
        )

    try:
        client = get_client()
        chat_messages = [{"role": "system", "content": system_prompt}] + [
            {"role": m.role, "content": m.content} for m in payload.messages
        ]
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=chat_messages,
            temperature=0.6,
        )
    except APIError as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {e}") from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    reply = (response.choices[0].message.content or "").strip() or "[no response]"

    return ChatResponse(reply=reply, model=MODEL, cost_units=0.1)


@app.exception_handler(ValueError)
def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})
