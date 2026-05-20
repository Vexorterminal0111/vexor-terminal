/**
 * Vexor Intel API — GET /api/intel
 *
 * Public, read-only JSON endpoint exposing the latest aeon-generated brief
 * cards (morning brief, token report, on-chain pulse, defi overview, evening
 * recap). The data is produced by the companion aeon fork at
 * `github.com/Vexorterminal0111/vexor-aeon`, which commits a single aggregated
 * `data/intel.json` file to an orphan branch on each cron tick. This handler
 * fetches that file, normalizes it, caches the response at the edge for 60s,
 * and returns it.
 *
 * Why GitHub raw instead of KV / R2: keeps the worker auth scope unchanged
 * (the existing CLOUDFLARE_API_TOKEN doesn't include KV write), and lets the
 * aeon repo own its own data branch with no new credentials to plumb.
 *
 * The data branch URL can be overridden with the optional `INTEL_DATA_URL`
 * env binding; defaults to the canonical path.
 *
 * CORS open (`*`) — this is a public read API.
 */

import type { Env } from "./index";

const DEFAULT_INTEL_DATA_URL =
  "https://raw.githubusercontent.com/Vexorterminal0111/vexor-aeon/data/intel.json";

const CACHE_TTL_SECONDS = 60;
const SCHEMA_VERSION = "1";
const FETCH_TIMEOUT_MS = 5000;

type SkillItem = {
  title?: string;
  body?: string;
  url?: string;
  [key: string]: unknown;
};

interface IntelSkill {
  skill: string;
  title?: string;
  summary?: string;
  markdown?: string;
  produced_at?: string;
  run_id?: string | number;
  items?: SkillItem[];
  metadata?: Record<string, unknown>;
}

interface IntelPayload {
  schema_version?: string;
  generated_at?: string;
  next_run_at?: string;
  source?: string;
  skills?: IntelSkill[];
}

const EMPTY_PAYLOAD: IntelPayload = {
  schema_version: SCHEMA_VERSION,
  generated_at: null as unknown as string,
  next_run_at: null as unknown as string,
  source: DEFAULT_INTEL_DATA_URL,
  skills: [],
};

const PUBLIC_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      cf: { cacheTtl: 60, cacheEverything: true },
      headers: { "user-agent": "vexor-intel-worker/1" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalize(raw: unknown, sourceUrl: string): IntelPayload {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_PAYLOAD, source: sourceUrl };
  }
  const obj = raw as Record<string, unknown>;
  const skillsIn = Array.isArray(obj.skills) ? obj.skills : [];
  const skills: IntelSkill[] = [];
  for (const entry of skillsIn) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const slug = typeof e.skill === "string" ? e.skill.trim() : "";
    if (!slug) continue;
    skills.push({
      skill: slug,
      title: typeof e.title === "string" ? e.title : undefined,
      summary: typeof e.summary === "string" ? e.summary : undefined,
      markdown: typeof e.markdown === "string" ? e.markdown : undefined,
      produced_at:
        typeof e.produced_at === "string" ? e.produced_at : undefined,
      run_id:
        typeof e.run_id === "string" || typeof e.run_id === "number"
          ? e.run_id
          : undefined,
      items: Array.isArray(e.items) ? (e.items as SkillItem[]) : undefined,
      metadata:
        e.metadata && typeof e.metadata === "object"
          ? (e.metadata as Record<string, unknown>)
          : undefined,
    });
  }
  return {
    schema_version:
      typeof obj.schema_version === "string"
        ? obj.schema_version
        : SCHEMA_VERSION,
    generated_at:
      typeof obj.generated_at === "string" ? obj.generated_at : undefined,
    next_run_at:
      typeof obj.next_run_at === "string" ? obj.next_run_at : undefined,
    source: sourceUrl,
    skills,
  };
}

export async function handleIntel(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: PUBLIC_CORS });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({
        error: "method_not_allowed",
        allowed: ["GET", "HEAD", "OPTIONS"],
      }),
      {
        status: 405,
        headers: {
          ...PUBLIC_CORS,
          "content-type": "application/json; charset=utf-8",
          allow: "GET, HEAD, OPTIONS",
        },
      },
    );
  }

  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    const h = new Headers(cached.headers);
    for (const [k, v] of Object.entries(PUBLIC_CORS)) h.set(k, v);
    h.set("x-vexor-cache", "HIT");
    return new Response(request.method === "HEAD" ? null : cached.body, {
      status: cached.status,
      headers: h,
    });
  }

  const dataUrl = env.INTEL_DATA_URL?.trim() || DEFAULT_INTEL_DATA_URL;

  let payload: IntelPayload;
  try {
    const res = await fetchWithTimeout(dataUrl, FETCH_TIMEOUT_MS);
    if (res.status === 404) {
      payload = { ...EMPTY_PAYLOAD, source: dataUrl };
    } else if (!res.ok) {
      throw new Error(`upstream ${res.status}`);
    } else {
      const raw = (await res.json()) as unknown;
      payload = normalize(raw, dataUrl);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return new Response(
      JSON.stringify({ error: "upstream_failure", detail: msg }),
      {
        status: 502,
        headers: {
          ...PUBLIC_CORS,
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  const body = JSON.stringify(payload, null, 2);
  const headers = new Headers({
    ...PUBLIC_CORS,
    "content-type": "application/json; charset=utf-8",
    "cache-control": `public, s-maxage=${CACHE_TTL_SECONDS}, max-age=${CACHE_TTL_SECONDS}`,
    "x-vexor-schema": SCHEMA_VERSION,
    "x-vexor-cache": "MISS",
  });
  const res = new Response(body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return request.method === "HEAD"
    ? new Response(null, { status: 200, headers })
    : res;
}
