import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/server/auth";
import { ensureSchema, query } from "@/lib/server/db";
import { subscribe, type LiveMessage } from "@/lib/server/events";

/**
 * Server-Sent Events stream — the self-hosted stand-in for Sub0's WebSocket broadcasts.
 * Emits the same `{ action: "circle_update" }` payload, so `lib/useLive.ts` handles both.
 *
 * Authenticated, and filtered to the caller's own circles: a live stream is a read of the
 * same data every other endpoint guards, and an unauthenticated firehose would leak the
 * existence and activity timing of every circle on the instance to anyone who connects.
 *
 * The token arrives as a query parameter because `EventSource` cannot set request headers.
 * That puts it in this server's access log, which is why it is checked against the same
 * revocation list as every other request and never echoed back in a response.
 *
 * Requires a single long-lived Node process (`next start`). Serverless/multi-replica hosting
 * will connect but never receive events from another instance — see SELF_HOSTING.md.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureSchema();

  const claims = await verifyToken(req.nextUrl.searchParams.get("token"));
  if (!claims) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = claims.id;

  /**
   * Asked per message rather than cached, so joining or leaving a circle takes effect on an
   * already-open stream. An ADMIN sees every circle, matching the read-only audit access the
   * admin console already has.
   */
  const visible = async (circleId: string): Promise<boolean> => {
    const rows = await query(
      `SELECT 1 FROM _memberships
       WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
       UNION ALL
       SELECT 1 FROM _users WHERE id = $2 AND role = 'ADMIN' AND deleted_at IS NULL
       LIMIT 1`,
      [circleId, userId],
    );
    return rows.length > 0;
  };

  const encoder = new TextEncoder();

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
  // Allow the Vercel frontend to connect to this stream on Render.
  const origin = req.headers.get("origin");
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          /* stream already closed */
        }
      };

      send(": connected\n\n");

      const unsubscribe = subscribe((message: LiveMessage) => {
        send(`data: ${JSON.stringify(message)}\n\n`);
      }, visible);

      // Keep-alive comment: stops proxies from closing an idle stream.
      const heartbeat = setInterval(() => send(": ping\n\n"), 25_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, { headers });
}
