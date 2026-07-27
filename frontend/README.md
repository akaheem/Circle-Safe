# CircleSafe — Frontend (Next.js)

Frontend for CircleSafe, deployed on LingoQL; talks to the Sub0 backend.

## Stack
- **Next.js 14** (App Router) + **TypeScript**
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

## Environment

| Variable | Purpose | Unset behaviour |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sub0 base URL; each endpoint is `POST {API_URL}/{resource}` | **Demo mode** — an in-memory mock backend serves every screen |
| `NEXT_PUBLIC_WS_URL` | Sub0 socket, e.g. `wss://<host>/ws` | No live push; screens refresh after your own actions |

Demo mode makes the whole app clickable (invite → order → contribute → confirm → payout)
without a backend, which is what the demo video records against until Sub0 is deployed.

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
  api.ts               one typed function per Sub0 resource + the demo-mode mock
  auth.ts              session storage + useSession
  useAsync.ts          load/refetch helper used by every panel
  useLive.ts           WebSocket subscription; refetches on `circle_update`
  format.ts types.ts
```

## Status
- [x] Landing page (hero + features + how-it-works + security + stats + FAQ + CTA + footer)
- [x] Auth pages (login / register) + session guard on `(app)`
- [x] Dashboard — my circles
- [x] Circle creation wizard
- [x] Circle workspace: overview, members, rules builder, ledger, payouts, trust & health, activity
- [ ] Point at the live Sub0 deployment (set the two env vars, verify response shapes)

## Notes
- The design language is inspired by (not copied from) a Bootstrap template; all code, colors,
  icons, fonts, and content here are original to CircleSafe.
- The auth token is stored client-side and sent as `Authorization: Bearer <jwt>`; protected
  sockets pass it as the `x-access-token` subprotocol.
- `lib/api.ts` assumes each endpoint returns its `main_returnable` as the JSON body. If the live
  Sub0 response wraps results (e.g. `{ data: ... }`), unwrap it in `call()` — one place, one line.
