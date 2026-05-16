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

export interface Env {
  ASSETS: Fetcher;
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  GROQ_MAX_TOKENS?: string;
  ALLOWED_ORIGINS?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      return handleChat(request, env);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
