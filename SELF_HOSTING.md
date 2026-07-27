# CircleSafe — self-hosted runtime (Path B)

CircleSafe was designed for **Sub0**. The declarative model and endpoint definitions in
`backend/` are the canonical backend design and haven't changed.

Because the hackathon credits never arrived, the app also ships a **self-hosted runtime**: the same
SQL contract (extended from 23 to 39 resources — see §14 of PROGRESS.md), executed by Next.js
route handlers against any PostgreSQL. Nothing about this replaces the Sub0 design — it's a second
executor for the same contract, so the project can be finished and deployed on free infrastructure
today.

## The three runtimes

`frontend/lib/api.ts` picks one at build time. Every mode answers the same
`POST <base>/<resource>` contract with the same payloads, so no UI code changes between them.

| Mode | Trigger | Backend | Live updates |
|---|---|---|---|
| `mock` | neither var set (default) | in-memory demo data in the browser | none (UI refreshes on your actions) |
| `local` | `NEXT_PUBLIC_LOCAL_API=true` | `app/api/[resource]` → PostgreSQL | SSE at `/api/events` |
| `sub0` | `NEXT_PUBLIC_API_URL=https://…` | a deployed Sub0 instance | Sub0 WebSocket (`NEXT_PUBLIC_WS_URL`) |

`sub0` wins if both are set. Switching back to Sub0 later is two env vars and a rebuild.

> ⚠️ **BUILD-TIME ENV VARS — THE MOST COMMON DEPLOY FAILURE**
>
> `NEXT_PUBLIC_LOCAL_API` and `NEXT_PUBLIC_API_URL` are **inlined into the JavaScript bundle at
> build time**. Setting them at runtime (in the host's dashboard after the image is built) has
> **no effect**. The deployed app will silently serve the in-memory demo to real users — no error
> message, just infinite session loss that looks like the app is broken.
>
> **The check:** look for the "Demo" badge in the header. If it is there after deployment, the
> var missed the build. Fix: set the var, rebuild, redeploy.
>
> **The fix:** set `NEXT_PUBLIC_LOCAL_API=true` in the environment **before** `npm run build`,
> or inject it as a build-time argument in your CI/CD pipeline. On self-hosted platforms (Render,
> Railway, Fly), the var must be added to the service dashboard and the service must be manually
> rebuilt — deployment platform restarts do NOT re-run `next build`.

## How the Sub0 primitives are reproduced

| Sub0 primitive | Self-hosted equivalent |
|---|---|
| models (`backend/models/*.json`) | `lib/server/schema.sql` — a direct translation, applied on first request |
| `sql_query` + `parameters` | the same statements in `lib/server/resources.ts`, parameterized |
| action chaining (`depends_on`) | `withTx()` — the chained statements run in one transaction |
| `payload_validation` | `lib/server/validate.ts` (same field types, same bounds) |
| `hashables` / `verify_hashables` (BCRYPT 12) | `bcryptjs` in `lib/server/auth.ts` |
| `tokenize` (JWT HS256) | `jsonwebtoken`, same `JWT_SECRET_KEY` env var |
| `protected` → `$PROTECTED.id` | verified claims in the dispatcher; handlers only ever see `userId` |
| `invalidate_tokenize` | `_revoked_tokens` table, checked on every verify |
| `rate_limit` (`$HEADER.ip`) | `lib/server/rateLimit.ts`, in-process fixed window |
| `read_from_cache` / `duration` | `lib/server/cache.ts`, same 60s TTL and cache keys |
| `broadcast_websocket_message` | `lib/server/events.ts` + SSE, same `{action:"circle_update"}` payload |
| `$GENERATOR.KSUID` | `lib/server/ids.ts` — timestamp-prefixed, base62, 27 chars |
| built-in SQL injection prevention | every query parameterized; no string interpolation anywhere |

### Deliberate improvements over the Sub0 definitions

Both are logged in `backend/endpoints/README.md` to be backported:

1. **Seat cap on invites** — `invite-member` refuses once the circle has `max_members` members.
2. **Membership checked before the cache** — the cached aggregations verify membership *outside*
   the cached query, so a cache hit can't be served to a non-member.

Also added here: unique indexes that make double-submits impossible rather than merely unlikely —
one membership per person per circle, one contribution per member per cycle, one payout per cycle.

## Requirements

- Node 18+ and any PostgreSQL 13+ (a Neon / Supabase / Railway free tier is plenty).
- **A single long-lived Node process** (`next start`). The SSE broadcaster and the in-process rate
  limiter and cache live in memory, so serverless or multi-replica hosting will still serve data
  correctly but live updates won't cross instances. Fix if you ever need to scale out: Postgres
  `LISTEN/NOTIFY` (or Redis) behind `lib/server/events.ts`, and Redis for the limiter.

## Environment

```
DATABASE_URL=postgres://user:password@host:5432/circlesafe?sslmode=require
JWT_SECRET_KEY=<48+ random chars>
NEXT_PUBLIC_LOCAL_API=true
# optional
DATABASE_SSL=true          # force SSL when the URL has no sslmode
DATABASE_POOL_MAX=5        # keep small on free tiers with low connection limits
JWT_EXPIRES_IN=7d
```

Generate the key:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Email, admins and verification

```
APP_URL=http://localhost:3000              # links inside emails point here
MAIL_FROM=CircleSafe <no-reply@yourdomain>
SMTP_URL=smtps://user:pass@smtp.example.com:465
#   ...or SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_SECURE
ADMIN_EMAILS=you@example.com               # these accounts become platform admins
REQUIRE_EMAIL_VERIFICATION=true            # unset = enforced only when SMTP is configured
```

**Nothing breaks without SMTP.** Every message is written to the `_emails` outbox and printed to
the server console, and the API returns the link directly (`invite_url` on `invite-member`,
`verify_url` on `sign-up` / `resend-verification`) so you can pass it on by hand. The admin console
at `/admin/emails` shows the whole outbox with the links. Those `*_url` fields are returned **only
when SMTP is unconfigured** — configure mail and they disappear.

Because of that, email verification defaults to *not* enforced until SMTP works: enforcing it on a
mail-less deployment would lock every user out of creating or joining circles.

Gmail works for testing with an [App Password](https://support.google.com/accounts/answer/185833)
(`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`) — never your account password. Resend, Mailgun,
Postmark and Mailtrap all provide SMTP credentials that drop straight into `SMTP_URL`.

## Run it locally

Put the values in `frontend/.env.local` — it's gitignored, Next loads it automatically, and
`db:init` / `smoke` read it too (via `node --env-file-if-exists`):

```ini
# frontend/.env.local
DATABASE_URL=postgres://…
JWT_SECRET_KEY=…
NEXT_PUBLIC_LOCAL_API=true
```

```bash
cd frontend
npm install
npm run db:init     # applies lib/server/schema.sql and lists the six tables
npm run dev         # http://localhost:3000
```

> **Keep credentials in `.env.local`, not on the command line.** Anything typed as
> `DATABASE_URL=… npm run …` ends up in shell history and in tool permission allowlists
> (`.claude/settings.local.json`), which are easy to leak by accident. Both that file and
> `.env*.local` are gitignored at the repo root.

Then, in a second terminal, prove it actually works:

```bash
npm run smoke
```

`scripts/smoke.mjs` runs the full lifecycle against the running server — sign-up, invite, join,
payout order, start, contribute, confirm, dashboard totals, payout, receipt, activity log, logout —
**plus every authorization check that must fail** (no token → 401, a MEMBER trying to confirm a
contribution → 403, a non-recipient confirming a payout → 403, duplicate contribution → 409, rules
edited after the circle starts → 403). It writes throwaway rows, so point it at a scratch database.

## Deploy on a free tier

1. Create a Postgres database (Neon / Supabase / Railway) and copy its connection string.
2. Create a web service from the frontend repo on a host that runs a persistent Node process —
   Render, Railway, Fly.io, or any VPS. Build `npm run build`, start `npm run start`.
   *(Vercel works for the app itself, but its serverless functions break the in-process SSE
   broadcaster — you'd get correct data with no live push.)*
3. Set the environment variables above. `NEXT_PUBLIC_LOCAL_API` is read at **build time**, so set it
   before the first build.
4. Deploy, then run `npm run smoke -- https://<your-host>/api` once against the deployed URL.
5. The "Demo mode" banner disappearing is your signal that the app is talking to Postgres.

## Verification status (2026-07-26) — ✅ verified against real PostgreSQL

Run on **Next.js 16.2.12 + React 19**, and re-run in full after that upgrade with identical results.

- ✅ `tsc --noEmit` clean; `next build` clean; both API routes register.
- ✅ `npm run db:init` against a Neon (managed Postgres) instance: all six tables created, plus
  `_revoked_tokens`.
- ✅ **`npm run smoke`: 156 passed, 0 failed** (2026-07-26, after the v2 feature set — email
  verification, invitations, discovery, join requests, scheduled starts and the admin console are
  all covered, including every authorization check that must fail). The suite caught one real bug on
  its first v2 run: a Postgres "inconsistent types deduced for parameter $2" in two `INSERT INTO
  _memberships` statements where the same parameter was both an inserted column and a subquery
  comparison — fixed with explicit `::varchar` casts.
- ✅ The earlier v1 baseline: **61 passed, 0 failed.** Full lifecycle — sign-up, sign-in,
  duplicate-email rejection, circle creation, invite, join, seat cap, payout order, start, the
  rules/order lock, contributions, confirmation, dashboard totals, trust scores, health, insights,
  payout, receipt confirmation, cycle advance, completion, activity log, logout — and every
  authorization check that must fail (401 without a token, 403 for a MEMBER confirming a
  contribution, 403 for a non-recipient confirming a payout, 409 on a duplicate contribution,
  403 on rules edited after the circle starts).
- ✅ Live updates: an SSE client connected to `/api/events` received a `circle_update` for both
  `start-circle` and `record-contribution`, each carrying the right `circle_id`.
- ✅ ID generator: 20,000 generated, all unique, fixed 27-char base62.

Remaining unverified: the UI itself against this runtime (clicking through in a browser), and
behaviour under concurrent users. The unique indexes are what make concurrent double-submits safe.
