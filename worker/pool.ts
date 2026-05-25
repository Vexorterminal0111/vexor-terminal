/**
 * Vexor Pool API — GET /api/pool
 *
 * Pre-launch stub. The $VEXOR token and RevShare pool are not yet deployed on
 * Base, so this endpoint returns a 503 with a `pending-launch` payload.
 * External consumers can poll this endpoint and switch on `status` to know
 * when the live pool data goes online.
 *
 * Once $VEXOR is live, this stub will be replaced with the live RPC-aggregated
 * pool snapshot (APR, TVL, price, recent rewards pushes).
 */

import type { Env } from "./index";

interface PoolPendingResponse {
  schema_version: string;
  status: "pending-launch";
  message: string;
  fetched_at: string;
}

const SCHEMA_VERSION = "1";
const PENDING_MESSAGE =
  "The $VEXOR token has not launched yet — the RevShare pool will be enabled on Base alongside the $VEXOR token launch.";

export async function handlePool(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _env: Env,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const body: PoolPendingResponse = {
    schema_version: SCHEMA_VERSION,
    status: "pending-launch",
    message: PENDING_MESSAGE,
    fetched_at: new Date().toISOString(),
  };

  return jsonResponse(body, 503);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*",
  };
}
