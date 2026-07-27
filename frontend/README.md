# CircleSafe — Frontend (Next.js)

Frontend for CircleSafe, deployed on LingoQL; talks to the Sub0 backend.

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** — theme = "Savanna Trust" palette (emerald `#0FA968`, mint `#34E0A1`, gold `#F5B301`, deep forest `#07231B`)
- **Fonts:** Space Grotesk (headings) + Inter (body) via `next/font`
- **ogl** — WebGL for the Lightfall hero animation
- **framer-motion** — scroll-reveal / entrance animations
- **react-countup** — animated stats
- **recharts** — contribution and trust-score charts
- **@dnd-kit** — drag-and-drop payout order in the Rules Builder
- **lucide-react** — icons

## Run locally
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:3000

> First `npm install` needs internet (pulls the packages above). The Lightfall hero requires WebGL (any modern browser).

## Environment — three backend modes

`lib/api.ts` picks the backend at build time. Every mode answers the same resource contract, so no
component code changes between them. Full detail in [`../SELF_HOSTING.md`](../SELF_HOSTING.md).

| Mode | Trigger | Backend | Live updates |
|---|---|---|---|
| **demo** | nothing set (default) | in-memory mock in the browser | none — refreshes on your actions |
| **self-hosted** | `NEXT_PUBLIC_LOCAL_API=true` + `DATABASE_URL` + `JWT_SECRET_KEY` | `app/api/[resource]` → PostgreSQL | SSE `/api/events` |
| **Sub0** | `NEXT_PUBLIC_API_URL` (+ `NEXT_PUBLIC_WS_URL`) | deployed Sub0 instance | Sub0 WebSocket |

Sub0 wins if both are configured. Demo mode makes the whole app clickable
(invite → order → contribute → confirm → payout) with no backend at all.

## Scripts

```bash
npm run dev       # local development
npm run build     # production build
npm run start     # serve the build (needed for SSE live updates)
npm run db:init   # apply lib/server/schema.sql to $DATABASE_URL and list the tables
npm run smoke     # full lifecycle + authorization tests against a running server
```

## Structure
```
app/
  layout.tsx           fonts + metadata
  globals.css          Tailwind base + .btn/.card/.input helpers
  page.tsx             landing page
  (auth)/              login + register
  (app)/               authenticated shell (sidebar + auth guard)
    dashboard/         "My Circles" list
    circles/new/       4-step circle creation wizard
    circles/[id]/      circle workspace (tabbed panels below)
components/
  Lightfall.tsx        WebGL animated hero background
  Reveal.tsx           Framer Motion scroll-reveal wrapper
  landing/             Navbar Hero Features HowItWorks Security Stats Faq CTA Footer
  circle/              OverviewPanel MembersPanel RulesBuilder
                       LedgerPanel PayoutsPanel TrustPanel ActivityPanel
  charts/              CycleChart (contributions/cycle) TrustChart (reliability)
  ui/                  Badge StatCard ProgressBar Tabs Alert EmptyState
lib/
  api.ts               one typed function per resource + mode selection + the demo mock
  auth.ts              session storage + useSession
  useAsync.ts          load/refetch helper used by every panel
  useLive.ts           live updates: Sub0 WebSocket or self-hosted SSE
  format.ts types.ts
  server/              self-hosted runtime (server-only — never imported by a client component)
    schema.sql         translation of backend/models/*.json
    db.ts              pooled Postgres + withTx (action chaining)
    resources.ts       the 23 handlers, same SQL as backend/endpoints/*.json
    auth.ts            bcrypt + JWT + token revocation
    validate.ts        payload_validation equivalent
    rateLimit.ts cache.ts events.ts ids.ts errors.ts
app/api/
  [resource]/route.ts  POST dispatcher for all 23 resources
  events/route.ts      SSE stream (broadcast_websocket_message equivalent)
scripts/
  db-init.mjs          apply the schema
  smoke.mjs            end-to-end lifecycle + authorization tests
```

## Status
- [x] Landing page (hero + features + how-it-works + security + stats + FAQ + CTA + footer)
- [x] Auth pages (login / register) + session guard on `(app)`
- [x] Dashboard — my circles
- [x] Circle creation wizard
- [x] Circle workspace: overview, members, rules builder, ledger, payouts, trust & health, activity
- [x] Self-hosted runtime — 23 resources over Postgres, SSE live updates, smoke test
- [ ] Run `npm run smoke` against a real Postgres (not yet executed — see SELF_HOSTING.md)
- [ ] Point at a live Sub0 deployment (blocked: hackathon credits never issued)

## Notes
- The design language is inspired by (not copied from) a Bootstrap template; all code, colors,
  icons, fonts, and content here are original to CircleSafe.
- The auth token is stored client-side and sent as `Authorization: Bearer <jwt>`; protected
  sockets pass it as the `x-access-token` subprotocol.
- `lib/api.ts` assumes each endpoint returns its `main_returnable` as the JSON body. If the live
  Sub0 response wraps results (e.g. `{ data: ... }`), unwrap it in `call()` — one place, one line.
