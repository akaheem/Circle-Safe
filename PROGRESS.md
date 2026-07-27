# CircleSafe — Project Progress & State File

> **PURPOSE:** This is the single source of truth for the project. If you are a fresh Claude
> session, READ THIS FILE FIRST — it contains every decision, the full architecture, the
> platform facts already learned from the docs (so you DON'T re-fetch them), and the exact
> task status. Update it as you complete work. Goal: zero wasted tokens re-discovering things.

> **HOW TO USE (for future-me):**
> 1. Read this whole file once at session start.
> 2. Find the `CURRENT STATUS` section — that's where we are.
> 3. Do the next unchecked task in `BUILD PHASES`.
> 4. When a task is done: change `[ ]` to `[x]`, add a note in `SESSION LOG`.
> 5. If a decision changes, update the relevant section AND note it in `SESSION LOG`.

---

## 1. CURRENT STATUS

- **Phase:** BACKEND DONE (Phases 1–8 + hardening). FRONTEND DONE end-to-end against a demo-mode
  mock backend (landing, auth, dashboard, creation wizard, full circle workspace). Remaining work
  is USER-BLOCKED: account setup → deploy Sub0 + Postgres → point the frontend at the live API →
  README + architecture diagram + demo video + Devpost submission.
- **Last updated:** 2026-07-25
- **Next action:** USER must do Phase 0 account setup (Devpost/LingoQL signup, $20 credit, social
  post, provision Postgres, create the Sub0 project, set `JWT_SECRET_KEY` +
  `ALLOW_WEBSOCKET_CONNECTIONS=true`). Then: paste models + endpoints into Sub0, run the
  caveat checks in `backend/endpoints/README.md`, set `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL`
  in the frontend, and verify the response shape assumption in `lib/api.ts`.
  Meanwhile the app is fully demoable right now: `cd frontend && npm install && npm run dev`.
- **Built so far:** 6 models + 23 endpoint files (22 + the new `list-payouts`) + realtime README.
  Frontend: 7 routes, 7 circle panels, 2 charts, 6 UI primitives, live-update hook, and a stateful
  in-memory mock so every flow clicks through without a backend. Accounts/DB/Sub0 NOT set up.

### DECISIONS (resolved)
1. **Database:** ✅ **PostgreSQL** (confirmed by user 2026-07-24).
   - DB password is stored ONLY as `$ENV.DB_PASSWORD` (a secret). NEVER hardcode it in any
     model/endpoint/README/repo file. It is not written in this file on purpose.
2. **MVP scope:** ✅ **Full MVP as planned** (confirmed by user 2026-07-24). Build all of
   Phases 1–8; nothing demoted to stretch.

---

## 2. WHAT WE'RE BUILDING

**CircleSafe** (placeholder name) — a digital platform for informal rotating savings groups
(**Ajo / Esusu / Susu / Tontine**) common across West Africa. Members contribute a fixed
amount each cycle; the pooled pot rotates to one member per cycle until everyone has received.

**Problem it solves:** fraud (collector disappears with funds), lost paper/WhatsApp records,
disputes over who paid / whose turn is next, no transparency, no financial history.

**Solution:** a secure, real-time, append-only, auditable system that makes every
contribution, payout, and decision transparent — strengthening (not replacing) the tradition.

---

## 3. HACKATHON CONTEXT (the rules we're optimizing for)

- **Event:** "Zero to Query" hackathon (Devpost), powered by **LingoQL** + **Sub0**,
  partner **HolyDigits101** (EdTech, 70k+ West African students).
- **Hard constraints:** Backend MUST use **Sub0**. Deploy on **LingoQL** infra. Frontend
  framework is free choice.
- **$20 LingoQL credit** provided on signup.
- **Submission:** project description + frontend repo + 3–5 min demo video + live URL +
  README (problem/solution/stack/how Sub0+LingoQL were used).

### JUDGING CRITERIA (drives all priorities)
| Criterion | Weight | Our play |
|---|---|---|
| Technical Implementation | **30%** | Deep, correct use of Sub0 primitives + code quality |
| Innovation & Creativity | 25% | Trust Score, Circle Health, Insights, drag-drop Rules Builder |
| Practical Utility | 25% | Real, widespread Ajo/Esusu problem; genuinely deployable |
| Presentation & Demo | 20% | Live URL + tight demo + quality README + arch diagram |

### ✅ FRONTEND DESIGN — HARD RULE (satisfied 2026-07-24, kept for the record)
Rule was: do NOT build the frontend UI until the user provides an IMAGE of their design →
analyze → propose a rebuild in a DIFFERENT palette → user approves → then build.
All four steps completed: template shared → analyzed → palette A "Savanna Trust" + Space Grotesk/
Inter proposed → user approved → built. Any NEW screen follows the same approved design language
(see `frontend/README.md`); no new approval loop needed unless the palette/typography changes.

### FRONTEND DESIGN INPUTS & PLAN (analysis 2026-07-24 — PROPOSED, awaiting approval)
- **Template (STYLE inspiration ONLY):** `c:\Users\mibra\Downloads\bliss-free-lite-version` =
  UIdeck **"Bliss"**, a Bootstrap 5 plain-HTML landing page. NOT React.
- **⚠️ License:** free-lite = commercial use NOT allowed, footer credit NOT removable. → We do
  NOT copy its code/CSS/assets/fonts/icons. We REBUILD the look from scratch in Next.js+Tailwind
  with a new palette, Lucide icons, our own content + the Lightfall hero. Original & clean.
- **Template design tokens (for reference, being REPLACED):** primary `#4E6EF1`, dark `#313450`,
  muted text `#6B6F92`, accents `#FB32FB`/`#FF3B3B`/`#5A37FF`; fonts Poppins (body) + Archivo Black
  (headings); soft shadows, pill buttons, icon-in-colored-circle cards, generous spacing.
- **Bliss landing sections (order) → mapped to CircleSafe:** navbar; hero(split) → hero w/ Lightfall
  bg + dashboard mock; client-logo strip → trust strip; about+FAQ accordion → "How it works"+FAQ;
  services(4 icon cards) → 4 Features (Ledger, Rules Builder, Trust Scores, Live Dashboard);
  counter-up stats → impact stats (count-up); CTA band → "Start a circle"; footer.
- **✅ CHOSEN palette (user 2026-07-24): A — "Savanna Trust".** primary emerald `#0FA968`, mint `#34E0A1`,
  gold `#F5B301`, deep-forest base `#07231B`; text `#1C2B27`, muted `#5C7268`, light bg `#F4FAF7`.
  Lightfall: colors ['#34E0A1','#0FA968','#F5B301'], backgroundColor '#07231B'. (Distinct from the
  template's indigo AND Lightfall's default blue/purple/pink; on-theme for savings/Africa.)
- **Fonts CONFIRMED (user 2026-07-24):** Space Grotesk (headings) + Inter (body).
- **Design preview built:** `frontend-design-reference/design-preview.html` — self-contained,
  renders CircleSafe landing (nav/hero/features/stats) in all 3 palettes with a switcher, using
  the REAL recolored Lightfall (ogl via esm.sh CDN). For choosing the palette; NOT the real app.
- **Scroll animations:** Framer Motion (whileInView fade/slide-up, staggered card grids, subtle
  hero parallax) + react-countup for stats. (Replaces the template's WOW.js/animate.css.)
- **Awaiting user approval on:** palette choice + fonts, then build frontend.

### SCOPE CUTS ALREADY DECIDED (do NOT build these)
- ❌ Reminders / scheduled jobs (cron) — CUT from MVP.
- ❌ Screenshot-upload contribution verification — CUT (use treasurer/admin confirm instead).
- ❌ AI features, SMS, WhatsApp, multi-channel notifications — README "future work" ONLY.
- ✅ README document itself IS required and scored — we DO write it.

---

## 4. TECH STACK (decided)

- **Frontend:** Next.js + TypeScript + Tailwind CSS + shadcn/ui + Recharts (charts) +
  dnd-kit (drag-drop Rules Builder). Deployed on LingoQL.
- **Backend:** Sub0 (declarative JSON models + endpoints). Deployed on LingoQL.
- **Database:** PostgreSQL (recommended — SEE OPEN DECISION #1).
- **HTTPS/TLS:** provided by LingoQL (port 443 / TLS).

---

## 5. PLATFORM FACTS LEARNED FROM DOCS (do NOT re-fetch these)

**LingoQL** = deployment/hosting platform. Deploys static sites (free tier), SSR frontends
(Next.js auto-detected: installs, builds, runs), managed databases (Postgres, Mongo, MySQL,
Redis, etc.), backend apps, cron, queues, websockets. Injects `HOST` + `PORT` env vars for
backends (bind `0.0.0.0`, read `PORT`). Builds via Railpack/Nixpacks. HTTPS via 443/TLS.

**Sub0** = DECLARATIVE backend engine. NO hand-written server code. You define:
- **Models** (one JSON file per table, e.g. `_users.json`). Field props: `type`, `optional`,
  `primary_key`, `auto_increment`, `max_length`, `indexable`, `fts`, `foreign_key {of, key}`.
  Types: `Number`, `Float`, `String`, `Boolean`, `DateTime`, `JSON_OBJECT` (needs
  `properties`), `JSON_ARRAY` (needs `property_type`).
- **Endpoints (ABI)** = a `resource` (route) + `actionables[]`. Top-level props: `id`,
  `resource`, `tokenize`, `protected`, `rate_limit`, `invalidate_tokenize`, `actionables`,
  `returnables`, plus flags `maintenance/cacheable/queue/parallel/run_in_background`.
  - **Actionable modes:** `QUERY` (`sql_query`/`mongo_query`), `HTTPREQUEST` (`http`),
    `UPLOAD` (`uploads`).
  - Actionable props: `id`, `mode`, `payload_validation`, `hashables`, `verify_hashables`,
    `depends_on` (chaining), `returnables`, `main_returnable`, `retries`, `no_op`.

**Accessors (runtime values):** `$ENV.` (env vars), `$PAYLOAD.` (request body), `$HEADER.`
(headers; `$HEADER.ip` for IP), `$PROTECTED.` (verified token claims), `$DATETIME` (now),
`$GENERATOR.` (IDs: UUID, KSUID, ULID, NANOID, CUID2, etc.).

**Security primitives (native — this is our 30% Technical score):**
- `hashables` (insert) + `verify_hashables` (signin): BCRYPT (rounds 4–31, default 12) or
  ARGON2. OMIT `salt` in prod (auto random salt). Never put password in `returnables`.
- `tokenize`: JWT (HS256) or PASETO (32-char key). Props: `type`, `algorithm`, `expiration`,
  `encryption_key: $ENV.X`, `custom_claim_fields`, `property_name`.
- `protected`: `{provide_as, extract_claims}`. Invalid/missing token → 401. Trust
  `$PROTECTED.id`, NOT payload IDs.
- `invalidate_tokenize`: logout/revoke (`tokens`, `expires_after`).
- `payload_validation`: types STRING/NUMBER/EMAIL/OBJECT/ARRAY/STRINGARRAY, with
  min_length/max_length/arr_length/etc. `bypass_payload_validation: true` to skip.
- `rate_limit`: `{limit, identifier: $HEADER.ip, expires_after}`.
- Built-in SQL-injection + Mongo-injection prevention (blocks unsafe queries pre-execution).
- Secrets in `$ENV`. CSRF: their wallet example uses a `_csrf_token_store` table pattern.

**Other primitives:** `Websockets` (real-time; connection `uid` for targeted delivery,
protected WS needs token), caching (`read_from_cache`, `cache_key`, `duration` seconds),
action chaining (`depends_on` + extract prior result into a variable), `unique: [...]` on
sql_query for uniqueness constraints.

**Atomic ledger pattern (from wallet example — adapt for contributions/payouts):**
Chained actionables: (1) no-op QUERY reads latest value, (2) dependent UPDATE does
`SET balance = balance + $1::float8 ... RETURNING ...`. Atomicity via SQL `+` increment
(or Mongo `$inc`). Cache hot reads per-user with `cache_key: "..._$PROTECTED.id"`.

### Wallet example = our template
Docs have a full "Wallet backend" worked example (users + transactions + balances + auth).
CircleSafe's contributions/payouts/ledger map directly onto it.

---

## 6. DATA MODEL (6 tables, `_`-prefixed per Sub0 convention)

```
_users         id(KSUID,pk) · name · email(unique,indexable) · password · phone? · created_at · updated_at · deleted_at?
_circles       id · name · owner_id→_users · contribution_amount(Float) · frequency(WEEKLY|MONTHLY)
               · max_members(Number) · currency · status(PENDING|ACTIVE|COMPLETED) · current_cycle(Number)
               · rules(JSON_OBJECT: grace_period_days, late_fee) · created_at · updated_at · deleted_at?
_memberships   id · circle_id→_circles · user_id→_users · role(OWNER|TREASURER|MEMBER)
               · payout_position(Number) · status(INVITED|ACTIVE) · created_at · updated_at · deleted_at?
_contributions id · circle_id→_circles · user_id→_users · cycle(Number) · amount(Float)
               · status(PENDING|CONFIRMED) · confirmed_by→_users? · created_at · updated_at · deleted_at?
_payouts       id · circle_id→_circles · cycle(Number) · recipient_id→_users · amount(Float)
               · status(SCHEDULED|PAID|RECEIVED) · recorded_by→_users · created_at · updated_at
_activity      id · circle_id→_circles · actor_id→_users? · type · message · metadata(JSON_OBJECT) · created_at
               ← APPEND-ONLY: INSERT ONLY, never UPDATE/DELETE. This is the trust core.
```

**Computed (no extra storage):** Trust Score (per user: on-time vs late contributions),
Circle Health (missed payments, delays, participation), Insights (aggregations). All via
cached aggregation QUERY endpoints over `_contributions` + `_activity`.

---

## 7. ENDPOINTS (ABI resources)

| Group | Resources |
|---|---|
| Auth | `sign-up`, `sign-in`, `logout` (invalidate_tokenize) |
| Circles | `create-circle`, `list-my-circles`, `get-circle`, `update-circle-rules` |
| Members | `invite-member`, `join-circle`, `list-members`, `set-payout-order` |
| Contributions | `record-contribution`, `confirm-contribution`, `list-contributions` |
| Payouts | `record-payout`, `confirm-payout-received` |
| Dashboard | `get-dashboard`, `get-insights` (cached) |
| Scores | `get-trust-score`, `get-circle-health` (cached) |
| Realtime | `circle-updates` (WebSocket) |
| Activity | `list-activity` |
| Payouts (added) | `list-payouts` — needed so a recipient can find their `payout_id` |

Every state-changing endpoint: `protected` + `payload_validation` + `rate_limit`; ownership
via `$PROTECTED.id`; RBAC (OWNER/TREASURER/MEMBER) via `role` JWT claim + query checks.
Every mutating action ALSO writes a row to `_activity`.

---

## 8. BUILD PHASES (task tracker — update checkboxes as you go)

### Phase 0 — Setup
- [ ] Register on Devpost + LingoQL, claim $20 credit
- [ ] Post participation on X/LinkedIn tagging @lingoqlHQ + @holydigits101 (todo requirement)
- [ ] Provision PostgreSQL on LingoQL
- [ ] Initialize Sub0 project
- [ ] Set `$ENV.JWT_SECRET_KEY` (and any other secrets)
- [x] Scaffold Next.js + TS + Tailwind + Recharts + dnd-kit (shadcn/ui dropped — the handful of
      primitives we needed live in `frontend/components/ui/`, no extra dependency)
- [ ] Init frontend git repo (repo URL is a submission requirement)

### Phase 1 — Data Models  ✅ DONE (files in backend/models/)
- [x] `_users` model
- [x] `_circles` model
- [x] `_memberships` model
- [x] `_contributions` model
- [x] `_payouts` model
- [x] `_activity` model

### Phase 2 — Auth  ✅ DONE
- [x] `sign-up` endpoint (hashables BCRYPT + tokenize JWT + payload_validation) → endpoints/auth/
- [x] `sign-in` endpoint (verify_hashables + tokenize) → endpoints/auth/
- [x] `logout` endpoint (invalidate_tokenize) → endpoints/auth/  (⚠️ verify no-actionable is allowed)
- [x] Frontend: register + login pages, token storage (`lib/auth.ts`), auth guard in `(app)/layout.tsx`

### Phase 3 — Circles  ✅ DONE
- [x] `create-circle`, `start-circle`, `list-my-circles`, `get-circle`, `update-circle-rules` endpoints
      (added `start-circle` for the PENDING→ACTIVE lifecycle)
- [x] Frontend: 4-step creation wizard (`/circles/new`: basics → contribution → rules → review)
- [x] Frontend: My Circles (`/dashboard`) + Circle workspace (`/circles/[id]`, 7 tabs, deep-linkable
      via `?tab=`) with owner-only "Start circle"

### Phase 4 — Members + Rules Builder  ✅ DONE
- [x] `invite-member`, `join-circle`, `list-members`, `set-payout-order` endpoints
      (set-payout-order = one member per call; frontend calls N times after drag-drop)
- [x] Frontend: MembersPanel (invite by email, accept invite, roles, seats left)
- [x] Frontend: VISUAL drag-drop Rules Builder (dnd-kit) ⭐ — sortable payout order + "Random draw"
      (Fisher–Yates ballot) + rule cards (amount, rhythm, grace period, late fee); saves only moved
      rows; locks itself once the circle is ACTIVE or the viewer isn't the owner

### Phase 5 — Contributions  ✅ DONE
- [x] `record-contribution`, `confirm-contribution`, `list-contributions` endpoints
- [x] Each mutation writes to `_activity` (append-only) + broadcasts a live update
- [x] Frontend: LedgerPanel (status filters, confirmed total, treasurer/owner-only Confirm) +
      "Record my contribution" (hidden once you've recorded for the current cycle)

### Phase 6 — Payouts  ✅ DONE
- [x] `record-payout` (pays current recipient, auto-advances cycle, COMPLETED after last),
      `confirm-payout-received` endpoints
- [x] `list-payouts` endpoint (added 2026-07-25 — recipients need a `payout_id` to confirm receipt)
- [x] Frontend: PayoutsPanel — full cycle-by-cycle schedule, owner records the current payout,
      recipient confirms receipt

### Phase 7 — Dashboard (real-time)  ✅ DONE
- [x] `get-dashboard` endpoint (pot, paid count, next recipient, completion %) — uncached for freshness
- [x] Real-time via `broadcast_websocket_message` on all mutations (see endpoints/realtime/README.md)
- [x] Frontend: OverviewPanel (4 stat tiles + collection progress + Recharts confirmed/pending by
      cycle) and `lib/useLive.ts` — subscribes to the Sub0 socket, refetches on `circle_update`,
      auto-reconnects; header shows a Live / Reconnecting / Demo indicator

### Phase 8 — Scores & Insights  ✅ DONE
- [x] `get-trust-score` (cached aggregation) ⭐
- [x] `get-circle-health` (cached aggregation) ⭐
- [x] `get-insights` (most reliable member, total savings, next payout, avg/cycle) ⭐
- [x] `list-activity` (append-only feed)
- [x] Frontend: TrustPanel (reliability chart + leaderboard + health gauge with bands + insight
      tiles) and ActivityPanel (icon timeline over the append-only log)

### Phase 9 — Hardening  (built-in per endpoint; final verify after Sub0 integration)
- [x] Rate limits on sensitive endpoints (auth, create-circle, invite, record-contribution)
- [x] payload_validation on every input-accepting endpoint
- [x] Token invalidation endpoint (logout) written
- [x] Ownership/RBAC enforced in SQL via $PROTECTED.id + role checks
- [ ] Verify error handling + logging behavior on the live Sub0 platform (post-integration)
- [ ] CSRF: using token-in-header (Authorization/x-access-token), so CSRF N/A unless we switch
      to cookie sessions; document in README

### Phase 10 — Deploy + Submit
- [ ] Deploy backend (Sub0) on LingoQL  ← USER (runbook: `DEPLOYMENT.md` steps 1–5)
- [ ] Deploy frontend (Next.js) on LingoQL, get live URL (HTTPS)  ← USER (step 6)
- [x] README (problem/solution/stack/how Sub0+LingoQL used/security/future work) → root `README.md`
      (3 placeholder links at the top still need the live URL / video / repo URL)
- [x] Architecture diagram → Mermaid `flowchart` in `README.md` §3 (renders on GitHub) + an ASCII
      contribution-lifecycle diagram. Export a PNG if Devpost wants an image upload.
- [x] Demo video SCRIPT + shot list → `DEMO_SCRIPT.md` (timings, seeding advice, fallback plan)
- [ ] Record the 3–5 min demo video  ← USER (needs the deployed URL, or demo mode as fallback)
- [ ] Submit on Devpost before deadline  ← USER
- [ ] ⚠️ DECIDE: the landing page `Stats.tsx` shows invented traction (₦12M+ saved, 840+ circles,
      6.2k members). Fabricated numbers on a submission are a credibility risk with judges —
      either relabel them as illustrative ("what a 10-person ₦5,000/week circle saves in a year")
      or swap in real project facts (6 tables · 23 endpoints · 0 lines of server code · 100%
      append-only). Not changed yet: it's a content call.

---

## 9. DOC REFERENCE (fetch a `.md` page ONLY if you need detail not already in section 5)

Index: https://docs.lingoql.com/llms.txt
Key pages (append `.md`):
- Sub0 models: /sub0/creating-database-models/{anatomy-of-models, creating-models, table-relationships, indexing}
- Sub0 ABI: /sub0/apis-abi/{structure, accessors, payload-validation, authentication,
  encryption-and-decryption, rate-limiting-requests, token-invalidation, making-api-requests,
  action-chaining, file-uploads, caching, queueing, cron-jobs, webhooks, websockets,
  best-practices-security-enforcements}
- Wallet example: /sub0/apis-abi/practical-examples/wallet-backend-{data-model, auth-and-accounts,
  transactions-and-balances, uploads-and-gallery, async-jobs-and-webhooks, realtime-and-oauth}
- LingoQL: /introduction/{about-lingoql, services-you-can-deploy, api-reference, troubleshooting-deploys}
- STILL UNREAD (fetch when that phase starts): websockets, making-api-requests, cron-jobs,
  creating-models, indexing, LingoQL deploy specifics, wallet realtime-and-oauth.

---

## 10. SESSION LOG (append one line per session; newest at bottom)

- 2026-07-24 — Selected idea (CircleSafe/Ajo-Esusu), rated & refined w/ friend's amendments,
  read core Sub0+LingoQL docs, produced full architecture + build plan, created this file.
  Pending: user to confirm DB + MVP scope, then start Phase 0.
- 2026-07-24 — User confirmed: PostgreSQL + Full MVP scope. DB password stored as
  $ENV.DB_PASSWORD only (kept out of all files). Ready to begin Phase 0.
- 2026-07-24 — Fetched exact Sub0 model file format (flat field map, filename=table name).
  Wrote all 6 models to backend/models/ + backend/README.md. Phase 1 DONE. IDs = String
  via $GENERATOR.KSUID. Next: Phase 2 auth endpoints. Phase 0 account setup is on user.
- 2026-07-24 — Added FRONTEND DESIGN HARD RULE (wait for user's design image, propose recolor,
  get approval before building any UI). Wrote Phase 2 auth endpoints (sign-up, sign-in, logout)
  to backend/endpoints/auth/ + endpoints/README.md. Flagged 2 caveats to verify in Sub0:
  (a) table-name underscore convention, (b) whether logout can have zero actionables.
- 2026-07-24 — Fetched action-chaining + websockets docs. Wrote ALL remaining backend endpoints
  (Phases 3–8): circles (5, incl. start-circle), members (4), contributions (3), payouts (2),
  dashboard (2), scores (2), activity (1) = 19 more files, 21 endpoints total. Real-time via
  broadcast_websocket_message on mutations (no separate socket server). Scores/insights cached
  60s; dashboard uncached. Hardening (rate limits, validation, RBAC via $PROTECTED.id) baked
  into every endpoint. Documented 6 caveats to verify on live Sub0 in endpoints/README.md.
  BACKEND COMPLETE. Everything else waits on user (design image / account setup).
- 2026-07-24 — User provided design template (UIdeck "Bliss", Bootstrap HTML) + custom React
  "Lightfall" WebGL hero (needs `ogl`). Preserved Lightfall in frontend-design-reference/.
  Analyzed template (sections, tokens, license). Flagged license (rebuild-from-scratch approach).
  PROPOSED "Savanna Trust" palette (emerald/gold/deep-forest) + Space Grotesk/Inter fonts +
  Framer Motion scroll animations + section mapping to CircleSafe. Awaiting palette/font approval.
- 2026-07-24 — User confirmed fonts (Space Grotesk + Inter). Built design-preview.html (3-palette
  switcher w/ real recolored Lightfall) in frontend-design-reference/ for the user to pick a
  palette. Awaiting palette choice (A/B/C) before scaffolding the real Next.js app.
- 2026-07-24 — User chose palette A (Savanna Trust). Scaffolded Next.js 14 + TS + Tailwind in
  frontend/ (config, theme, fonts via next/font). Ported Lightfall to TS. Built FULL landing page:
  Navbar, Hero (Lightfall bg + dashboard mock), Features, HowItWorks, Security, Stats (count-up),
  Faq, CTA, Footer + Reveal (framer-motion scroll animations). Run: cd frontend && npm install &&
  npm run dev. NEXT: auth pages, then app screens (can use mock data before Sub0 live).
- 2026-07-24 — Built auth pages (login/register), the `(app)` shell with sidebar + auth guard,
  the My Circles dashboard, and `lib/` (api client with mock fallback, session storage, formatters,
  types). [Logged retroactively on 2026-07-25 — this session predates its own log line.]
- 2026-07-25 — FRONTEND FEATURE-COMPLETE. Added: creation wizard (`/circles/new`), circle workspace
  (`/circles/[id]`) with 7 panels (Overview, Members, Rules Builder ⭐, Ledger, Payouts,
  Trust & Health, Activity), Recharts CycleChart + TrustChart, UI primitives (StatCard, ProgressBar,
  Tabs, Alert, EmptyState) with `.card`/`.input` moved into globals.css, `useAsync` loader and
  `useLive` WebSocket hook (refetch on `circle_update`, auto-reconnect, live indicator).
  Backend gained `list-payouts` (recipients had no way to get a `payout_id` for
  confirm-payout-received). `lib/api.ts` mock is now a stateful in-memory DB so the entire flow
  (invite → drag order → start → contribute → confirm → payout → confirm received) is clickable
  with zero backend — this is what the demo video can record today. Verified: `tsc --noEmit` clean,
  `next build` clean (7 routes), dev server returns 200 on /, /login, /circles/new, /circles/c1.
  Also refreshed frontend/README.md + added frontend/.env.example.
  REMAINING (all user-blocked): Phase 0 account setup, deploy backend+frontend on LingoQL, wire the
  two env vars, root README, architecture diagram, demo video, Devpost submission.
- 2026-07-25 — Wrote the submission artifacts (the scored 20% Presentation work, none of it blocked
  on accounts): root `README.md` (problem, solution, Mermaid architecture diagram, lifecycle
  diagram, data model, a primitive-by-primitive "how we used Sub0" table, LingoQL usage, security,
  future work), `DEPLOYMENT.md` (8-step runbook with curl smoke tests, the table-name check to run
  BEFORE pasting 23 endpoints, two must-fail security checks, a 2-window live-update verification,
  and a troubleshooting table), `DEMO_SCRIPT.md` (timed 3–5 min shot list + seeding advice + a
  fallback if the backend misbehaves on recording day). Corrected the endpoint count: 23, not 21/22.
  Flagged the fabricated landing-page stats as a submission risk (see Phase 10) — awaiting a call.
