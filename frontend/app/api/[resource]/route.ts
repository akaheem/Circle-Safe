import { NextResponse, type NextRequest } from "next/server";
import { bearer, verifyToken } from "@/lib/server/auth";
import { ensureSchema } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rateLimit";
import { resources, resourceNames } from "@/lib/server/resources";
import { validate } from "@/lib/server/validate";

/**
 * One dispatcher for all 23 resources — the self-hosted stand-in for Sub0's ABI router.
 * `POST /api/<resource>` with a JSON payload, exactly the shape the Sub0 endpoints take, so
 * `lib/api.ts` speaks to either runtime unchanged.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The origin is echoed back because we cannot know the Vercel URL at build time. */
function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  return origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }
    : {};
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }, // async params: Next 15+
) {
  const { resource: name } = await params;
  const definition = resources[name];

  if (!definition) {
    return NextResponse.json(
      { message: `Unknown resource "${name}"`, available: resourceNames },
      { status: 404, headers: corsHeaders(req) },
    );
  }

  try {
    await ensureSchema();

    if (definition.rateLimit) {
      enforceRateLimit(
        `${name}:${clientIp(req)}`,
        definition.rateLimit.limit,
        definition.rateLimit.windowSeconds,
      );
    }

    let payload: Record<string, unknown> = {};
    const raw = await req.text();
    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new ApiError(400, "Request body must be valid JSON");
      }
    }

    // `protected` — the user id comes from the verified token, never from the payload.
    let userId = "";
    if (definition.auth) {
      const claims = await verifyToken(bearer(req.headers));
      if (!claims) {
        return NextResponse.json(
          { message: "Authentication required" }, { status: 401, headers: corsHeaders(req) },
        );
      }
      userId = claims.id;
    }

    if (definition.spec) validate(payload, definition.spec);

    const data = await definition.run({ payload, userId, ip: clientIp(req) });
    return NextResponse.json(data ?? null, { headers: corsHeaders(req) });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { message: err.message }, { status: err.status, headers: corsHeaders(req) },
      );
    }
    // Never leak SQL or stack traces to the client; log server-side instead.
    console.error(`[api:${name}]`, err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const configIssue = /DATABASE_URL|JWT_SECRET_KEY|schema\.sql/.test(message);
    return NextResponse.json(
      { message: configIssue ? message : "Something went wrong on the server" },
      { status: 500, headers: corsHeaders(req) },
    );
  }
}

/**
 * CORS preflight. The browser sends this before the real POST when the frontend is on Vercel
 * and the API is on Render (different origins).
 */
export async function OPTIONS(req: NextRequest) {
  const headers = {
    ...corsHeaders(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-access-token",
    "Access-Control-Max-Age": "86400",
  };
  return new Response(null, { status: 204, headers });
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { message: "This API accepts POST only.", resources: resourceNames },
    { status: 405, headers: corsHeaders(req) },
  );
}
