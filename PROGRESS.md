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

- **Phase:** BACKEND DONE (Phases 1–8 + hardening). FRONTEND DONE end-to-end. **Phase 11 (the
  user's click-test findings) DONE 2026-07-26** — accounts, invitations by email, join requests,
  discovery, scheduled starts and an admin console were built, and the runtime honesty problems
  they exposed were fixed. Submission docs DONE (README + diagram + deploy runbook + demo script).
- **Last updated:** 2026-07-28

> ### ⚠️ READ THIS FIRST — the single most important fact about this project
> There are **three runtimes** behind one client seam (`frontend/lib/api.ts`), and **`mock` is the
> default**. With no `frontend/.env.local`, `npm run dev` gives you an **in-memory fake backend**,
> not the real one. Nearly every bug the user reported on 2026-07-26 was actually "I was clicking
> the mock." The mock has since been made honest, **but it is still a fake**. Check the header
> badge — it reads **Demo** in mock mode and **Live** in local/sub0 mode.
- **STATUS** (2026-07-28): Auth system overhauled. Email verification replaced with WhatsApp OTP
  verification. Google Sign-In added. `tsc --noEmit` and `next build` clean; 13 routes.
  See session log for full detail.

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
- [x] ✅ RESOLVED (2026-07-26): the invented traction numbers are gone. `Stats.tsx` now shows
      verifiable project facts, and the figures were corrected a second time to describe the app
      that actually runs (39 endpoints · 11 tables) rather than the Sub0 design (23 · 6).
      User's call, recorded: **project facts only, no invented usage numbers.**

### Phase 11 — Click-test findings (user, 2026-07-26)  ✅ DONE
The user ran the app and reported 7 problems (`Desktop/circlesafe problems.txt`). The features
were built in the v2 round (**section 10b** — read that table first). Section 13 records the
**audit** that section 10b said was still owed, and the fixes it produced. Summary:
- [x] **Accounts are real.** Sign-up registers; sign-in rejects an unknown email or wrong password.
      Was: mock accepted *any* credentials — the user logged in with an account that didn't exist.
- [x] **Invitations by email** — `_invitations` table, SHA-256-hashed tokens, 14-day expiry,
      nodemailer SMTP delivery, `_emails` outbox, and an `/invite/[token]` page with **both**
      Accept and Decline. Works for addresses that have no CircleSafe account yet.
- [x] **The invite UI no longer lies.** It only says "Invitation emailed" when delivery actually
      succeeded; otherwise it shows a copy-able invite link.
- [x] **Admin role** — `ADMIN_EMAILS` env var (not hardcoded), server-enforced `assertAdmin()`,
      admin console at `/admin` (overview, users, circles, email outbox), read-only.
- [x] **Non-members are locked out** — `assertActiveMember()` on every circle data read.
- [x] **Discovery + join requests** — `/circles/discover` lists only circles that are still
      PENDING *and* have a free seat; `request-to-join` → owner approves/rejects in RequestsPanel.
- [x] **Scheduled start** — `starts_at` on `_circles`, a start step in the creation wizard,
      countdowns, and a lazy auto-start once the time passes and ≥2 members have joined.
- [x] **Email verification** — `_email_tokens`, `/verify/[token]`, and a gate on creating/joining.
- [x] Landing-page truthfulness pass (see section 13, finding 7).

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
- 2026-07-25 — **WORK PAUSED.** User reported the LingoQL/Sub0 **$20 credits never arrived**; the
  credit cut-off was **21 July 2026 and was never announced**, so the request went in late. User +
  other participants have asked the organizers to still issue them. Recorded the full 20-step user
  runbook in section 11 and the blocker + both continuation paths (A: credits arrive → hackathon
  route; B: no credits → self-hosted route, same endpoint contract) in section 12. No code changed
  this session. Resume trigger: an answer from the organizers, either way.
- 2026-07-25 — **PATH B BUILT** (details in section 12.3). Self-hosted runtime for all 23 resources:
  `lib/server/*` (schema, handlers, bcrypt+JWT auth, validation, rate limit, 60s cache, SSE
  broadcaster, KSUID-like ids), `app/api/[resource]` dispatcher, `app/api/events` SSE, three-mode
  client (`mock`/`local`/`sub0`), `db:init` + `smoke` scripts, `SELF_HOSTING.md`, README/.env
  updates. Found and fixed two real gaps in the Sub0 definitions (uncapped `invite-member`;
  cache keys that omit the caller) — logged in `backend/endpoints/README.md` to backport.
  Deps added: pg, bcryptjs, jsonwebtoken (+ types). Typecheck and build clean; dispatcher and SSE
  probed live; **SQL not yet executed against a real Postgres — `npm run smoke` is the gate.**
  ⚠️ Also noted: `npm audit` reports high-severity advisories in Next 14.2.35 + postcss that are
  only fixed in Next 15+. Fine while the app is local/demo; decide before any public deploy.
- 2026-07-26 — **SELF-HOSTED RUNTIME VERIFIED END TO END.** User supplied a Neon Postgres URL.
  `npm run db:init` created all 6 tables + `_revoked_tokens`. `npm run smoke`: **61 passed, 0 failed
  on the first run** — no fixes needed, the SQL carried over from the Sub0 definitions cleanly.
  Also verified SSE: a subscriber on `/api/events` received `circle_update` for `start-circle` and
  `record-contribution`, each with the right `circle_id`. Dev-server-not-running was the only reason
  the user's first smoke attempt failed (ECONNREFUSED); the runtime itself was fine.
  ⚠️ SECURITY: the Neon connection string was pasted in chat — rotate that password. Test rows for
  two throwaway users + two circles are in that database; wipe with
  `TRUNCATE _activity, _payouts, _contributions, _memberships, _circles, _users, _revoked_tokens;`
  ⚠️ [RESOLVED same day — upgraded, see the next entry] **Next.js 14.2.35 → 16.x.** `npm audit` flags 21 high-severity Next advisories
  + 3 in postcss; all are fixed only in Next 15/16, so `npm audit fix --force` is a major upgrade.
  Most advisories touch features we don't use (Image Optimizer remotePatterns, i18n middleware,
  Server Actions, RSC cache poisoning behind a CDN), so local/demo use is low risk — but this app is
  meant to be publicly deployed. Upgrading needs: React 19, `params` becoming a Promise in route
  handlers (`app/api/[resource]/route.ts`), and a recheck of framer-motion / recharts / ogl.
  Estimated 30–60 min including a full re-run of the smoke test.
- 2026-07-26 — **UPGRADED to Next 16.2.12 + React 19.2.8; `npm audit` now reports 0 vulnerabilities.**
  Bumped framer-motion 11→12, recharts 2.12→2.15, @types/react 18→19, postcss →8.5.22. Next 16 still
  pins postcss 8.4.31 and sharp 0.34.5 internally (both flagged), so `package.json` carries an
  `overrides` block bumping them — remove it once Next ships newer ones; we use no `next/image`, so
  sharp is inert here. One code change was required: route-handler `params` is a Promise in Next 15+,
  so `app/api/[resource]/route.ts` now awaits it. Next also rewrote `tsconfig.json`
  (`jsx: react-jsx`, added `.next/dev/types`). RE-VERIFIED after the upgrade: build clean, all pages
  200, **smoke 61/61 again**, SSE broadcast received, no render errors in the dev log.
  Also DONE: replaced the invented landing-page stats with verifiable project facts
  (23 endpoints · 6 tables · 2 confirmations per contribution · 100% auditable).
  ⚠️ Two things needing the user: **rotate the Neon password** (pasted in chat), and the test rows
  in that database can be wiped with
  `TRUNCATE _activity, _payouts, _contributions, _memberships, _circles, _users, _revoked_tokens;`
- 2026-07-26 — Housekeeping, both closed:
  1. **Test data wiped.** TRUNCATEd all 7 tables on the Neon instance (54 rows: 6 users, 4 circles,
     6 memberships, 5 contributions, 4 payouts, 27 activity, 2 revoked tokens). Schema intact,
     all 7 tables still present, 0 rows remaining. The DB is a clean slate for real use.
  2. **Credential handling — USER DECIDED NOT TO ROTATE** the Neon password, judging removal from
     the files sufficient. Mitigations actually applied: deleted both allowlist entries containing
     the connection string from `.claude/settings.local.json`; added a repo-root `.gitignore`
     covering `.claude/settings.local.json`, `.env`, `.env*.local`, `node_modules/`, `.next/`;
     verified by grep that the password appears in **no** file in the project. Residual exposure:
     the chat transcript only. ⚠️ If this repo is ever made public, or the DB is pointed at real
     user data, revisit that decision.
  Also: `db:init` and `smoke` now run via `node --env-file-if-exists=.env.local`, so credentials can
  live in a gitignored `frontend/.env.local` instead of being typed on the command line (where they
  land in shell history and tool allowlists — which is exactly how the leak above happened).
  No `.env.local` was created — the user prefers the password not sit in project files.
- 2026-07-26 — **THE AUDIT SECTION 10b SAID WAS STILL OWED — RUN. Full record in section 13.**
  Seven parallel auditors read the code instead of the docs, every finding adversarially verified
  by a second agent tasked with refuting it. Headline: **the v2 features were real, but `mock` is
  the default runtime and it was faking success across the board** — so the user click-tested a
  stub and reasonably concluded the features were broken. Fixed in two directions: (a) mock now
  *behaves* like the real runtime (real credential checks, no auto-admin, membership scoping,
  token-correct invites, auto-start, no false "emailed" claim) rather than merely disclaiming that
  it differs; (b) eight real gaps closed in the Postgres runtime — failed-email-reported-as-success,
  `join-circle` missing its verification/seat-cap checks, INVITED users reading the whole circle,
  the admin outbox leaking live tokens, an unauthenticated SSE firehose, `APP_URL` defaulting to
  localhost, manual start ignoring the 2-member floor, and ⭐ **`ADMIN_EMAILS` never applying to an
  account that already existed** — which is why the user could not become admin. Role is now
  reconciled at sign-in and on `me`. Landing page corrected to the shipped app's real numbers
  (39 endpoints · 11 tables), plus a dead primary CTA, 11 dead footer links, 4 fake social accounts
  and three overstated claims fixed. Created `frontend/.env.local` (gitignored) pre-filled with a
  fresh `JWT_SECRET_KEY` and `ADMIN_EMAILS=mibraheem45846@gmail.com`, needing only `DATABASE_URL`.
  `tsc --noEmit` and `next build` clean (17 routes). ⚠️ **`npm run smoke` NOT re-run** (needs a live
  DB; schema now 11 tables so `db:init` must run first) and **still nobody has clicked the app in
  local mode** — those two are the top of the next session. Sub0 drift documented, not backported,
  per the user's call (section 14). Two workflow agents were killed mid-run by a platform outage;
  their unfinished work (the SSE fix) was completed by hand.
- 2026-07-26 — **Contract audit done.** Cross-referenced all 41 api.ts resources against 41
  resources.ts handlers. **One real bug found and fixed:** `memberListScope()` was defined but
  **never called** — an invited-but-not-accepted user could read the full member list of the circle
  they were invited to (every other member's name and email), contradicting the stated intent.
  Now scoped: active members and admins see all rows; invited users see only their own row.
  Typecheck clean.
- 2026-07-26 — **Deploy-readiness assessment done.** The user asked "is the whole project ready to
  deploy?" Six parallel auditors were scheduled but the session hit its API usage limit; the
  assessment was completed from direct inspection. Three confirmed deploy blockers were fixed:
  (a) **Money columns** changed from `DOUBLE PRECISION` to `NUMERIC(14,2)` in `schema.sql` (3
  columns), plus a PG NUMERIC type parser in `db.ts` and updated casts in `resources.ts` (7 SQL
  sites) — the DB is empty, the cheapest possible moment. (b) **LICENSE.txt** added (MIT). (c)
  **README** placeholders replaced, Sub0/LingoQL framing corrected to match the self-hosted
  runtime, table count updated (6→11), and a note about the Sub0 drift added. **`DEPLOYMENT.md`
  and `SELF_HOSTING.md`** gained prominent warnings about `NEXT_PUBLIC_*` being build-time — the
  single most likely deploy failure mode. `.env.example` restructured to lead with the self-hosted
  path. `package.json` got an `engines` field. Build and typecheck clean. ⚠️ `npm run smoke` still
  unrun (needs a live DB URL). The remaining work (security review, hosting-fit confirmation,
  correctness audit) was blocked by the API usage limit and should be re-run once the limit resets.
- 2026-07-27 — **DEPLOY DAY.** Two confirmed deploy blockers fixed: money columns changed from
  DOUBLE PRECISION to NUMERIC(14,2) (3 schema columns + PG type parser + 7 SQL cast sites + 2
  SUM casts), and LICENSE.txt (MIT) added. README & deploy docs corrected for the self-hosted
  runtime. memberListScope() bug fixed (was defined but never called — invitees leaked the full
  member list). JWT expiry made configurable (accepts "never"). Deployed: Render
  (circlesafe-api.onrender.com) serving the API, Vercel (circle-safe.vercel.app) serving the
  frontend. CORS added to app/api/[resource]/route.ts and app/api/events/route.ts for the
  cross-origin setup. SSE cross-origin fallback added to useLive.ts. db:init run against Neon,
  all 11 tables created. npm run smoke → 141 passed, 0 failed. CORS preflight verified via curl
  (returns 204 with correct headers). Sign-up returns 500 on Render (likely env difference vs
  local — top of tomorrow's list). Typecheck and build clean across all changes.
- 2026-07-28 — **AUTH OVERHAUL: WhatsApp OTP + Google Sign-In.** Replaced email verification
  with WhatsApp OTP verification (always enforced, no SMTP gating). Added Google Sign-In
  (OAuth 2.0 via google-auth-library + Google Identity Services frontend SDK). Phone number
  unique constraint enforced at DB level (one WhatsApp per account). Users go directly to
  dashboard after signup (no "check your email" screen). Created `VerifyPhoneBanner` (handles
  phone input, OTP send, OTP verify in one component) replacing `VerifyEmailBanner`. Removed
  `verify/[token]` page, `verify-email` and `resend-verification` resources. Updated all
  verification gates: `create-circle`, `join-circle`, `respond-invitation`, `request-to-join`
  check `phone_verified_at`. Mock backend updated with same gates. New env vars:
  `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`.
  Schema additions: `phone_verified_at`, `google_id` on `_users`; `_phone_tokens` table;
  unique indexes on `phone` and `google_id`. Dependencies added: `google-auth-library`
  (17 packages). `tsc --noEmit` clean, `next build` clean (13 routes).

---

## 10b. V2 FEATURE SET (2026-07-26) — the 8 issues the user reported

| # | Reported | Verdict / what was built |
|---|---|---|
| 1 | "Logging in without an account still logs me in" | **Not a backend hole.** With no `.env.local` the app runs `API_MODE=mock`, and the mock signs anyone in. The real runtime rejects unknown users and bad passwords (proved by the smoke suite). Fixed the *trap*: `DemoModeBanner` now states plainly on login+register that any credentials are accepted, that nothing is stored, and how to switch to a real backend. |
| 2 | "Invites send no email, no accept/reject" | New `_invitations` table keyed on an EMAIL, so people **without an account** can be invited (the old endpoint 404'd on them). Emailed token link → public `/invite/[token]` page → Accept/Decline. Owner can cancel. 14-day expiry. |
| 3 | "Leader should choose when the circle starts" | `_circles.starts_at` + wizard step. Members see a countdown. `maybeAutoStart()` promotes the circle on the next read once the time passes and ≥2 members are active (there is no cron in this runtime, so the promotion is lazy). |
| 4 | "All circles visible, request to join if space" | `visibility` PUBLIC/PRIVATE + `description`. `/circles/discover` lists open PUBLIC circles with seats, member counts, and the start countdown, excluding ones you're already in or invited to. |
| 5 | "Join request should email the leader" | `_join_requests` + `request-to-join` emails the owner with the requester's name and optional note; owner approves/rejects from the new **Requests** tab; the requester is emailed the decision. |
| 6 | "Admin sees every circle's full progress" | Platform role `_users.role`, bootstrapped from `ADMIN_EMAILS`. `/admin` console: overview, all circles, all users, email outbox. Admins **read** any circle and may answer join requests — they cannot record/confirm contributions or payouts. |
| 7 | "Email verification" | `_email_tokens` (SHA-256 hashed, single-use, 24h). Verify page, resend, and a dismissible banner. Enforcement defaults to **on only when SMTP is configured**, so a mail-less deployment can't lock everyone out. |
| 8 | "Falling-bubbles hero lags" | Root cause: `Hero` passed a new `colors` array literal every render and `Lightfall` listed it in its effect deps, so the **entire WebGL context was torn down and rebuilt constantly**. Now created once; uniforms update in place; adaptive quality ladder (dpr then shader steps, monotonic); pauses off-screen and on hidden tabs; honours `prefers-reduced-motion`; frame-rate capped; accumulating clock; slower default speed. |

**Email works without a provider.** Every message is written to the `_emails` outbox and printed to
the console, and the API returns `invite_url` / `verify_url` directly (only while SMTP is unset), so
the flows are demoable and testable with no mail account. `/admin/emails` shows the outbox.

**Verified 2026-07-26 against the real Neon database: `npm run smoke` → 156 passed, 0 failed**
(was 61 before v2). Build and `tsc --noEmit` clean; 17 routes. The suite caught one real bug on its
first v2 run — Postgres "inconsistent types deduced for parameter $2" in two
`INSERT INTO _memberships` statements where the same parameter was both an inserted column and a
subquery comparison; fixed with explicit `::varchar` casts in `respond-join-request` and
`respond-invitation`.

**Schema growth:** 6 tables → 11 (`_email_tokens`, `_invitations`, `_join_requests`, `_emails`, plus
the pre-existing `_revoked_tokens`). Resources: 23 → 41.

**STILL OUTSTANDING from this round** (two agents died on a platform auth error mid-run):
1. **Sub0 parity** — `backend/` still describes the v1 system: 6 models, 23 endpoints. The v2
   tables/resources are NOT yet mirrored there, so the canonical declarative design has drifted from
   the runtime. Needs: 4 new models, 2 modified models, ~18 new endpoint JSONs, 5 modified, and
   HTTPREQUEST actionables for the emails (Resend-style REST call).
   → **STILL OPEN.** User decided 2026-07-26: *document the drift now, backport later.* See §14.
2. ~~**Three adversarial verification passes** never ran.~~
   → **DONE 2026-07-26** — the systematic audit was run (7 parallel auditors, each finding
   adversarially verified by a second agent that tried to refute it). It did **not** agree that
   everything was fine: it found the mock runtime was silently faking success across the board,
   and several real gaps in the server runtime. Findings and fixes in **section 13**.

**A correction to this table.** Row 1's verdict — "Not a backend hole… fixed the *trap*" — was
right about the cause but stopped one step short. A banner explaining that any password works does
not make the demo honest; it leaves a login screen that accepts anything sitting behind an
explanation most people will not read. The audit found the same pattern in five other places
(auto-admin, no membership scoping, invite tokens ignored, no auto-start, a false "emailed"
message). The mock has now been made to *behave* like the real runtime instead of merely
disclaiming that it doesn't. Also: resources are **39**, not 41 (recounted directly).

---

## 11. USER RUNBOOK — the exact steps, in order (for when we resume)

Saved 2026-07-25. Steps 1–2 need nothing. Steps 3+ are all blocked on the credits (section 12).
Detail, curl blocks and troubleshooting live in `DEPLOYMENT.md`; this is the sequence.

### Part A — no accounts needed (10 min)
1. **See the app.** `cd "C:/Circle Safe/frontend" && npm run dev` → http://localhost:3000.
   Register any email/password, then: create a circle → invite `john@example.com` → drag the payout
   order → start → record a contribution → confirm it → record the payout. All of it works against
   the in-memory mock. This is also the fallback demo if deployment never happens.
2. **Decide the landing-page stats question** (Phase 10, last item): the invented traction numbers
   in `frontend/components/landing/Stats.tsx` → "illustrative" or "project facts". One edit either way.

### Part B — accounts + hackathon requirements (30 min)
3. Register on **Devpost** for the Zero to Query hackathon.
4. Register on **LingoQL**, claim the **$20 credit**. ← **THIS IS WHERE WE ARE STUCK**
5. Post participation on X/LinkedIn tagging **@lingoqlHQ** + **@holydigits101** (scored requirement).
6. Create a **GitHub repo**, push `frontend/`. The repo URL is required at submission.

### Part C — backend (45 min)
7. Provision **PostgreSQL** on LingoQL. Keep the credentials out of the repo.
8. Create the **Sub0 project**, connect the DB, set three env secrets:
   - `DB_PASSWORD` = the Postgres password
   - `JWT_SECRET_KEY` = `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - `ALLOW_WEBSOCKET_CONNECTIONS` = `true` ← without it, nothing is live
9. **Paste ONE model + ONE endpoint first**: `models/_users.json`, then `endpoints/auth/sign-up.json`.
   Call `sign-up` (curl in `DEPLOYMENT.md` §5). **Report back two things:** (a) did the table name
   `_users` work or was it stripped to `users`; (b) the exact response shape. (a) decides a
   29-file find-replace; (b) decides whether `call()` in `frontend/lib/api.ts` needs an unwrap.
10. Paste the other 5 models **in FK order**: `_circles` → `_memberships` → `_contributions` →
    `_payouts` → `_activity`.
11. Paste the remaining 22 endpoints. Four rejections are plausible — symptoms + fixes are in
    `DEPLOYMENT.md` §4 (logout with no actionables, nested `$PAYLOAD.rules.*`, `jsonb_build_object`
    / `FILTER` / CTEs, `depends_on` bare variable names).
12. Run the full curl smoke test (`DEPLOYMENT.md` §5), **including the two calls that must fail**
    (no token → 401; another member's circle → no access).

### Part D — frontend deploy (20 min)
13. Create a LingoQL service from the frontend repo (Next.js is auto-detected).
14. Set env vars **before the build** — Next.js inlines `NEXT_PUBLIC_*` at build time:
    `NEXT_PUBLIC_API_URL=https://<sub0-host>` and `NEXT_PUBLIC_WS_URL=wss://<sub0-host>/ws`.
15. Deploy, open the HTTPS URL. **"Demo mode" banner gone = the wiring worked.** Still there ⇒ the
    env var missed the build ⇒ rebuild.

### Part E — verify, record, submit
16. Two windows (normal + incognito), two users, run `DEPLOYMENT.md` §7. The decisive check: user B
    records a contribution and **user A's screen updates with no refresh** (proves the WebSocket).
17. Seed a demo circle: 4 members, run to cycle 3, confirmed contributions + one payout. Empty
    charts and 100% trust scores demo badly.
18. Record the video with `DEMO_SCRIPT.md` (timed to 4:30, exact lines, cut-list if long).
19. Fill the 3 placeholder links at the top of `README.md` (live URL, video, repo).
20. Submit on Devpost, with buffer before the deadline for the video upload.

**Two points to come back to me:** step 9 (table name + response shape) and any rejection in step 11.

---

## 12. BLOCKER + THE TWO PATHS FORWARD

### 12.1 The blocker (as of 2026-07-25)
- LingoQL/Sub0 **$20 credits never arrived**.
- The credit cut-off was **21 July 2026** and, per the user, was **never announced** — so the
  request was made after it had already passed. Many other participants are in the same position
  and have collectively asked the organizers to still issue credits.
- Consequence: **no managed Postgres, no Sub0 project, no deploy, no live URL.** Runbook steps 4–20
  are all downstream of this. Nothing else is blocking; our side of the build is finished.
- Open question worth checking while waiting: **is there a free tier** on LingoQL/Sub0 that doesn't
  need credit, even with tight limits? A free tier would unblock Path A without the organizers.

### 12.2 Path A — credits arrive → hackathon route
Run section 11 from step 4 exactly as written. Nothing needs re-planning; the backend definitions,
frontend, README, diagram, runbook and demo script are all done and waiting. Realistic time from
credits landing to a submitted entry: **~2.5 hours** of hands-on work.

### 12.3 Path B — no credits → finish it ourselves  ✅ BUILT 2026-07-25 (option 2)
The project is worth completing regardless; it just stops being a hackathon entry.

**What was built** (all inside `frontend/`, nothing in `backend/` touched):
- `lib/server/schema.sql` — the 6 models translated to DDL, plus `_revoked_tokens` (runtime-only,
  standing in for Sub0's native `invalidate_tokenize`) and unique indexes that make double-submits
  impossible: one membership per person per circle, one contribution per member per cycle, one
  payout per cycle.
- `lib/server/resources.ts` — all 23 handlers, each running the SAME SQL as the matching
  `backend/endpoints/*.json`, with chained actions wrapped in a transaction.
- Primitive equivalents: `validate.ts` (payload_validation), `auth.ts` (bcrypt 12 + JWT HS256 +
  revocation), `rateLimit.ts`, `cache.ts` (same 60s keys), `events.ts` (SSE instead of WS),
  `ids.ts` (KSUID-like, verified: 20k generated, all unique, fixed 27-char base62).
- `app/api/[resource]/route.ts` — one dispatcher; `app/api/events/route.ts` — SSE stream.
- `lib/api.ts` now picks a mode: `mock` (default) / `local` (`NEXT_PUBLIC_LOCAL_API=true`) /
  `sub0` (`NEXT_PUBLIC_API_URL`). `useLive.ts` handles both WS and SSE. No component changed.
- `scripts/db-init.mjs` + `scripts/smoke.mjs` (full lifecycle AND the authorization checks that
  must fail) + `SELF_HOSTING.md`.

**Two gaps in the Sub0 definitions found while doing it** — fixed in the self-hosted runtime,
logged in `backend/endpoints/README.md` to backport before Sub0 goes live:
1. `invite-member` never enforced `max_members`, so a circle could be over-filled.
2. The cached aggregations key on `circle_id` only while the membership check sits *inside* the
   cached query — a cache hit could be served to a non-member.

**Verified 2026-07-26 against real PostgreSQL (Neon):** `db:init` created all 6 tables +
`_revoked_tokens`; **`npm run smoke` → 61 passed, 0 failed on the first run** (full lifecycle +
every authorization check that must fail); SSE verified — a client on `/api/events` received
`circle_update` for both `start-circle` and `record-contribution` with the correct `circle_id`.
Earlier checks still hold: typecheck + build clean, dispatcher probed, ID generator checked.
**Still unverified:** the UI clicked through against this runtime in a browser, and concurrency.

- **Keep `backend/` exactly as it is.** The 6 models + 23 Sub0 endpoint definitions are the
  canonical backend design and the clearest artifact of the architecture — they stay in the repo,
  documented as "designed for Sub0", not deleted.
- **Swap the runtime behind the same contract.** `frontend/lib/api.ts` funnels every call through a
  single `call(resource, payload)` function, so only that one seam has to change. Options, cheapest
  first:
  1. **Ship demo mode as-is** on any free static/SSR host. Zero backend work; honest about being a
     prototype (the banner says so). Good enough for a portfolio link.
  2. **Next.js route handlers + a free Postgres** (Neon / Supabase free tier): one `app/api/[resource]`
     handler translating each of the 23 resources into the SQL already written in the Sub0 files —
     the queries are done, they just need a thin executor plus bcrypt + JWT + the socket broadcast.
     This yields a genuinely functional multi-user app on free infrastructure.
  3. Same as (2) but as a standalone Express service, if we want the backend deployable separately.
- **Docs to adjust under Path B:** root `README.md` §5–6 (reframe as "backend designed declaratively
  for Sub0; runtime currently X"), and `DEPLOYMENT.md` (replace the LingoQL steps).
- **Recommendation:** option 2. It reuses the SQL we already wrote, keeps every feature real
  (including live updates), costs nothing, and leaves the Sub0 definitions intact so the work still
  demonstrates the platform if the hackathon ever reopens.

### 12.4 Resume trigger
- **Path B (now):** user provides a Postgres URL → `npm run db:init` → `npm run dev` →
  `npm run smoke` → fix whatever the smoke test reports → deploy on Render/Railway/Fly
  (needs a persistent Node process for SSE; Vercel serves data fine but breaks live push).
- **Path A (if credits arrive):** section 11 unchanged. Both runtimes coexist — switching is two
  env vars and a rebuild, so credits arriving late costs nothing.

---

## 13. THE AUDIT (2026-07-26) — what the click-test really found, and what was fixed

Section 10b built the v2 features but left the systematic verification pass unrun. It was run on
2026-07-26: seven auditors in parallel, each reading the code rather than trusting the docs, and
**every finding handed to a second agent whose job was to refute it** (uncertain ⇒ discarded).

### 13.1 The one root cause behind almost every reported problem
**`mock` is the default runtime, and it was faking success.** With no `frontend/.env.local`,
`lib/api.ts` resolves `API_MODE` to `mock` and `call()` returns before any network request. So
every server-side feature — bcrypt, `assertAdmin`, `assertMember`, nodemailer, auto-start — was
**dead code in the session the user was clicking.** The v2 work was real; the user simply never
reached it. Concretely, in mock mode:

| Reported | Actual cause |
|---|---|
| "logged me in without any authentication" | `lib/api.ts` sign-in: *"DEMO ONLY: any credentials succeed"* |
| "no mail sent for invitation" | No HTTP request ever leaves the page, so `email.ts` cannot run — yet `MembersPanel` still printed *"Invitation emailed to {email}"* |
| "only admin should view all circles" | `MOCK_ME.role = "ADMIN"` — **every** demo login was a platform admin |
| "members shouldn't see circles they're not in" | Not one mock read checked membership |
| "leader picks when the circle starts" | `starts_at` stored and counted down, but nothing ever auto-started |

### 13.2 Fixes applied — mock mode now behaves like the real runtime
Not "warns that it differs" — *behaves the same*, so a demo cannot teach anyone something false.
- Registered-user store: sign-up rejects duplicates; sign-in rejects unknown emails and wrong
  passwords with one message (`"Invalid email or password"`), as the real runtime does. Seeded
  demo credentials are shown on the login screen.
- Role defaults to `USER`; only the seeded persona is `ADMIN`; mock `admin-*` resources throw 403
  for everyone else.
- `assertMember()` ported to all 9 circle reads, ADMIN bypass included.
- Invitations are looked up **by token** (was: `db.invitations[0]`, so `/invite/anything` rendered
  a valid invitation and accepting mutated the wrong record), with the email-equality check.
- `invite-member` now enforces owner, PENDING status, seat cap and already-a-member — and returns
  an `invite_url`, so the copy-the-link UI is reached and the false "emailed" claim is gone.
- `maybeAutoStart()` ported; `update-circle-rules` persists `starts_at`/`visibility`/`description`;
  a past start date is rejected.

### 13.3 Fixes applied — the real (local/Postgres) runtime
The audit found genuine gaps here too, all now closed:
1. **Failed email reported as success.** `sendEmail` never throws; `invite-member` discarded the
   returned status while `fallbackLink` withheld `invite_url` whenever SMTP was merely *configured*.
   A wrong Gmail App Password therefore meant the invitee got nothing and the owner was told it was
   sent, with no link. Now the delivery status is used, and the link is exposed unless the send
   actually succeeded.
2. **`join-circle` skipped checks** that `respond-invitation` enforced (`requireVerified`, seat-cap
   re-check). Added.
3. **An INVITED-but-not-accepted user could read the whole circle.** New `assertActiveMember()`
   guards the *data* (ledger, pot, payouts, scores, activity); `assertMember()` still guards the
   circle record itself, because an invitee must be able to see enough to answer the invitation.
   `memberListScope()` gives an invitee their own row only.
4. **The admin email outbox leaked live tokens** — a read-only admin could lift any user's
   verification/invite token and hijack the flow. Redacted server-side.
5. **The SSE stream was unauthenticated** and pushed every circle's updates to every listener.
   Now requires a valid token (query param — `EventSource` cannot set headers) and filters per
   subscriber, re-checked per message so joining/leaving takes effect without reconnecting.
6. **`APP_URL` silently defaulted to `localhost:3000`**, so a deployment with SMTP but no
   `APP_URL` would email real users links to their own machine. Now warns unmistakably.
7. **Manual start ignored the 2-member floor** that auto-start enforced. Made consistent.
8. **⭐ An existing account could never become admin.** The role was assigned *only at sign-up*, so
   setting `ADMIN_EMAILS` did nothing for `mibraheem45846@gmail.com`, whose account already
   existed. `reconcileAdminRole()` now runs at **sign-in and on `me`**, promoting a listed address
   and demoting a delisted one, tolerant of casing/whitespace/quotes. **This is what makes the
   admin console reachable for the user's real account.**

### 13.4 Landing-page truthfulness
The user asked for "project facts, but may use low numbers." Those pull in opposite directions;
the user chose **corrected project facts only, no invented usage numbers.**
- `Stats.tsx`: 23 endpoints / 6 tables described the *Sub0 design*, not the running app → now
  **39 endpoints · 11 tables · append-only audit log · 100% auditable**. Dropped "all declarative"
  (16 running resources have no JSON) and "2 confirmations per contribution" (there is only 1).
- `Security.tsx`: "rate limiting … on every endpoint" was false (10 of 39) → now names the
  auth/invite/contribution surface. The validation half was verified, not assumed.
- `CTA.tsx`: the final "Create a Circle" button was `href="#"` — **a dead primary CTA** → `/register`.
  "Free to create your first circle" implied paid tiers that don't exist → reworded.
- `Footer.tsx`: 11 dead links and 4 fake social accounts → real anchors/routes kept, the rest
  removed rather than left dead.
- `HowItWorks.tsx`: the pot does **not** rotate "automatically" (no scheduler) → describes the
  real owner-records → recipient-confirms flow.
- `Features.tsx`: live updates now attributed to their transports (SSE self-hosted, WS on Sub0).
- `Hero.tsx`: the preview's numbers didn't add up (₦65,000 for 7 × ₦10,000) → consistent, and
  labelled "Example circle — not live data".

### 13.5 Verification status of this round
- `npx tsc --noEmit` **clean**; `npm run build` **clean, 17 routes**.
- ⚠️ **`npm run smoke` has NOT been re-run since these changes** — it needs a live `DATABASE_URL`,
  and the schema now has 11 tables so the DB must be re-initialised first. **This is the top task
  next session** (`npm run db:init && npm run dev && npm run smoke`). One likely break to expect:
  the INVITED-vs-ACTIVE split (13.3 item 3) changes what an invited-but-not-accepted caller may
  read, so any assertion that read circle data as an invitee will now correctly get a 403.
- **Coverage gap:** `scripts/smoke.mjs` (148 assertions) does **not** touch `/api/events` at all —
  SSE has only ever been checked by hand. The stream is now authenticated and membership-filtered,
  which is exactly the kind of logic that should be tested; worth adding.
- ⚠️ **No human has clicked the app in local mode yet.** Still the real remaining risk.

---

## 14. SUB0 DRIFT — `backend/` no longer describes what runs

**Decision (user, 2026-07-26): document now, backport later.** Writing ~18 endpoint JSONs that
cannot be executed while the credits are missing would be unverifiable work.

| | `backend/` (canonical design) | What actually runs |
|---|---|---|
| Models / tables | 6 | **11** |
| Endpoints / resources | 23 | **39** |

Missing from `backend/`: tables `_email_tokens`, `_invitations`, `_join_requests`, `_emails`,
`_revoked_tokens`; `starts_at`/`visibility`/`description` on `_circles`; `role` on `_users`; and
every resource for invitations, join requests, discovery, verification, the admin console and `me`.
Email would need `HTTPREQUEST` actionables (Sub0 has no SMTP primitive).

**Consequences to keep in mind:**
- `backend/` is still the clearest artifact of the declarative architecture and the honest answer
  to "how did you use Sub0" — keep it, but **describe it as the v1 design, not as what ships.**
- The README and any submission text must not imply the Sub0 definitions are what runs.
- Two gaps found earlier and fixed only in the self-hosted runtime are still logged for backport in
  `backend/endpoints/README.md` (uncapped `invite-member`; cache keys omitting the caller).
