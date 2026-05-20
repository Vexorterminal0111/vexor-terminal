/**
 * Vexor Terminal — Cloudflare Worker entry point.
 *
 * Serves the static Next.js export (out/) via the ASSETS binding, and routes
 * /api/chat to the Groq-backed chat handler.
 *
 * Configuration lives in wrangler.jsonc at the repo root. The Worker is built
 * by Cloudflare Workers Builds from the GitHub repo (build command
 * `pnpm build --webpack`).
 */

import { handleChat } from "./chat";
import { handlePool } from "./pool";
import { handleIntel } from "./intel";

export interface Env {
  ASSETS: Fetcher;
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  GROQ_MAX_TOKENS?: string;
  ALLOWED_ORIGINS?: string;
  // Optional override for the aeon-published intel feed URL.
  // Defaults to the canonical vexor-aeon data branch.
  INTEL_DATA_URL?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      return handleChat(request, env);
    }
    if (url.pathname === "/api/pool") {
      return handlePool(request, env, ctx);
    }
    if (url.pathname === "/api/intel") {
      return handleIntel(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
