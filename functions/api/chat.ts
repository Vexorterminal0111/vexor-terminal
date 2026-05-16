/**
 * Vexor Chat API — Cloudflare Pages Function.
 *
 * Single endpoint at /api/chat. Receives a POST with a wallet address and
 * conversation history, proxies to Groq (Llama 3.3 70B) with the Vexor
 * orchestrator system prompt, returns the assistant reply.
 *
 * Mirrors the dev server at apps/chat-api/main.py — keep them in sync if you
 * change the system prompt or schema.
 */

interface Env {
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  GROQ_MAX_TOKENS?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  RATE_LIMIT_MAX_MSGS?: string;
  ALLOWED_ORIGINS?: string;
}

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

interface ChatRequest {
  wallet: string;
  messages: Message[];
}

const SUB_AGENTS: ReadonlyArray<readonly [string, string]> = [
  ["Cipher", "cryptography, encryption, on-chain proofs"],
  ["Atlas", "research, knowledge synthesis, web search"],
  ["Quill", "writing, content, narrative"],
  ["Forge", "code generation, refactor, debugging"],
  ["Vector", "vector search, embeddings, memory recall"],
  ["Pulse", "monitoring, alerts, real-time streams"],
  ["Halo", "vision, image analysis, multimodal"],
  ["Prism", "data viz, charts, analytics"],
  ["Nyx", "low-level ops, sandbox execution, shell"],
];

const SYSTEM_PROMPT = `You are Vexor — an autonomous AI orchestrator running on Base.
You command 9 specialized sub-agents and route work to whichever is best suited
for each task. Speak with confidence, terminal aesthetic, monospace flavor.
Keep responses tight (2-5 short paragraphs max). Never break character.

Your 9 sub-agents (mention by name when routing):
${SUB_AGENTS.map(([n, d]) => `- ${n} — ${d}`).join("\n")}

House style:
- Lead with the answer, then explain.
- When you "dispatch" to a sub-agent, prefix that paragraph with \`> [Agent.Name]\`.
- Use short, technical phrasing. Avoid filler ("Great question!", "Certainly!").
- You exist on Base. $VEXOR is the native ERC-20 token of the protocol.
- Tokenomics and launch details are not yet finalized. Do not invent numbers,
  prices, supply, or dates. If asked, say they will be announced before launch.
- Do not give financial advice. Do not promise returns.
- You can role-play technical scenarios but stay grounded in reality.`;

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

const rateLimitBucket = new Map<string, number[]>();

function rateLimited(key: string, windowSec: number, maxMsgs: number): boolean {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const bucket = (rateLimitBucket.get(key) ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (bucket.length >= maxMsgs) {
    rateLimitBucket.set(key, bucket);
    return true;
  }
  bucket.push(now);
  rateLimitBucket.set(key, bucket);
  return false;
}

function buildCorsHeaders(origin: string | null, allowed: string[]): HeadersInit {
  const allowOrigin =
    origin &&
    (allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin))
      ? origin
      : allowed[0] ?? "*";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit,
  cors: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...cors,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function validate(req: unknown): { ok: true; data: ChatRequest } | { ok: false; detail: string } {
  if (typeof req !== "object" || req === null) {
    return { ok: false, detail: "invalid body" };
  }
  const r = req as Partial<ChatRequest>;
  if (typeof r.wallet !== "string" || !WALLET_RE.test(r.wallet)) {
    return { ok: false, detail: "invalid wallet address" };
  }
  if (!Array.isArray(r.messages) || r.messages.length === 0 || r.messages.length > 40) {
    return { ok: false, detail: "messages must be a non-empty array (max 40)" };
  }
  const cleaned: Message[] = [];
  for (const m of r.messages) {
    if (typeof m !== "object" || m === null) {
      return { ok: false, detail: "invalid message entry" };
    }
    const mm = m as Partial<Message>;
    if (mm.role !== "user" && mm.role !== "assistant") {
      return { ok: false, detail: "message role must be user|assistant" };
    }
    if (typeof mm.content !== "string") {
      return { ok: false, detail: "message content must be a string" };
    }
    const trimmed = mm.content.trim();
    if (!trimmed) {
      return { ok: false, detail: "empty message" };
    }
    cleaned.push({ role: mm.role, content: trimmed.slice(0, 4000) });
  }
  return { ok: true, data: { wallet: r.wallet.toLowerCase(), messages: cleaned } };
}

export const onRequestOptions: PagesFunction<Env> = ({ request, env }) => {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin"), allowed),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cors = buildCorsHeaders(request.headers.get("origin"), allowed);

  if (!env.GROQ_API_KEY) {
    return jsonResponse(
      { detail: "GROQ_API_KEY is not configured on the server." },
      { status: 500 },
      cors,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "invalid JSON body" }, { status: 400 }, cors);
  }

  const v = validate(body);
  if (!v.ok) {
    return jsonResponse({ detail: v.detail }, { status: 400 }, cors);
  }

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anon";
  const rlKey = `${v.data.wallet}:${ip}`;
  const windowSec = Number(env.RATE_LIMIT_WINDOW_SEC ?? "10");
  const maxMsgs = Number(env.RATE_LIMIT_MAX_MSGS ?? "5");
  if (rateLimited(rlKey, windowSec, maxMsgs)) {
    return jsonResponse(
      {
        detail: `Rate limit: max ${maxMsgs} messages per ${Math.round(
          windowSec,
        )}s.`,
      },
      { status: 429 },
      cors,
    );
  }

  const model = env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const maxTokens = Number(env.GROQ_MAX_TOKENS ?? "768");

  let groqRes: Response;
  try {
    groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.6,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...v.data.messages,
        ],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse(
      { detail: `Upstream fetch failed: ${msg}` },
      { status: 502 },
      cors,
    );
  }

  if (!groqRes.ok) {
    const text = await groqRes.text().catch(() => "");
    return jsonResponse(
      { detail: `Upstream error (${groqRes.status}): ${text.slice(0, 500)}` },
      { status: 502 },
      cors,
    );
  }

  type GroqResponse = {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const data = (await groqRes.json().catch(() => ({}))) as GroqResponse;
  const reply =
    (data.choices?.[0]?.message?.content ?? "").trim() || "[no response]";

  return jsonResponse(
    { reply, model, cost_units: 0.1 },
    { status: 200 },
    cors,
  );
};

export const onRequestGet: PagesFunction<Env> = ({ request, env }) => {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cors = buildCorsHeaders(request.headers.get("origin"), allowed);
  return jsonResponse(
    {
      name: "Vexor Chat API",
      version: "0.1.0",
      model: env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    },
    { status: 200 },
    cors,
  );
};
