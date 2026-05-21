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
import { handleIntelToken } from "./intel-token";
import { handleWatchtowerWebhook, runWatchtowerCron } from "./watchtower";

export interface Env {
  ASSETS: Fetcher;
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  GROQ_MAX_TOKENS?: string;
  ALLOWED_ORIGINS?: string;
  // Optional override for the aeon-published intel feed URL.
  // Defaults to the canonical vexor-aeon data branch.
  INTEL_DATA_URL?: string;
  // Optional override for the per-token intel feed base URL
  // (Pulse Premium). Defaults to the vexor-aeon data branch
  // `intel/tokens/` directory.
  INTEL_TOKEN_BASE_URL?: string;
  // Watchtower (Telegram-native alerts).
  WATCHTOWER: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  // Optional shared secret. When set, the Watchtower webhook rejects
  // any inbound request whose `X-Telegram-Bot-Api-Secret-Token` header
  // does not match.
  TELEGRAM_WEBHOOK_SECRET?: string;
  // Vexor Researcher (Telegram `/research` command). When set, the
  // researcher pulls contract-verification status from Basescan via the
  // Etherscan V2 API. Without it the brief still ships but the
  // contract-security signal is dropped. Free key from
  // https://etherscan.io/myapikey works.
  ETHERSCAN_API_KEY?: string;
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
    if (url.pathname === "/api/watchtower/webhook") {
      return handleWatchtowerWebhook(request, env, ctx);
    }
    // /api/intel/<slug>  — per-token Pulse Premium feed.
    // /api/intel/index  — index manifest of supported tokens.
    const tokenMatch = url.pathname.match(/^\/api\/intel\/([a-z0-9-]+)\/?$/i);
    if (tokenMatch) {
      return handleIntelToken(request, env, ctx, tokenMatch[1]);
    }
    return env.ASSETS.fetch(request);
  },
  // Cloudflare Cron Triggers entrypoint. Configured in wrangler.jsonc
  // (`triggers.crons`). Currently dispatches the hourly Watchtower
  // refresh + alert pass.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runWatchtowerCron(env));
  },
} satisfies ExportedHandler<Env>;
