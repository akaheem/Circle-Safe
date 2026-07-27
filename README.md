# CircleSafe

**Trustworthy Ajo. Every naira accounted for.**

CircleSafe is a transparent, append-only system of record for **rotating savings groups** —
*Ajo* / *Esusu* / *Susu* / *Tontine* — the informal circles that move enormous amounts of money
across West Africa every week with nothing but a notebook and trust.

Built for the **Zero to Query** hackathon: backend on **Sub0**, everything deployed on **LingoQL**.

- **Live demo:** _<add LingoQL URL>_
- **Demo video:** _<add link>_
- **Frontend repo:** _<add link>_

---

## 1. The problem

A rotating savings circle works like this: ten traders each contribute ₦5,000 a week; each week
the ₦50,000 pot goes to one member, until everyone has taken a turn. It is one of the most
widely used savings instruments in West Africa — and it runs on paper.

That creates four failure modes people live with today:

| Problem | What it looks like in practice |
|---|---|
| **Fraud** | The collector disappears with the pot. There is no independent record to point to. |
| **Lost records** | The notebook is lost or a WhatsApp group is deleted; nobody can prove who paid. |
| **Disputes** | "I paid you last Tuesday." "You didn't." "Whose turn is it now?" |
| **No financial history** | Years of reliable payments produce zero credit signal a lender will accept. |

The tradition works. The bookkeeping doesn't.

## 2. The solution

CircleSafe keeps the tradition and replaces the notebook:

- **Append-only ledger.** Every action writes a row to `_activity` that is never updated or
  deleted. The audit trail *is* the data model, not a feature bolted on top.
- **Two-party confirmation.** A member records their contribution; a treasurer or the owner
  confirms it. Neither side can move money in the record alone.
- **Rules locked before the money moves.** Contribution amount, rhythm, grace period, late fee
  and the full payout order are set while the circle is `PENDING` and freeze the moment it goes
  `ACTIVE` — the backend enforces this in SQL, not just in the UI.
- **Trust Score.** Each member's reliability (confirmed contributions ÷ cycles elapsed) computed
  live from the ledger. This is the portable financial history the tradition never produced.
- **Circle Health.** One number for whether a circle is actually collecting what it's owed.
- **Live dashboard.** Every mutation broadcasts over WebSockets, so all members see the same
  numbers at the same time. Disputes need a shared source of truth, and this is it.

## 3. Architecture

```mermaid
flowchart TB
    subgraph client["Browser"]
        UI["Next.js 14 App Router<br/>TypeScript · Tailwind · Recharts · dnd-kit"]
    end

    subgraph lingoql["LingoQL"]
        FE["SSR frontend service<br/>HTTPS / TLS on 443"]
        SUB0["Sub0 declarative backend<br/>models + ABI endpoints"]
        PG[("PostgreSQL<br/>managed database")]
    end

    UI -->|"POST /resource<br/>Authorization: Bearer JWT"| SUB0
    UI <-.->|"wss /ws<br/>action: circle_update"| SUB0
    UI --- FE
    SUB0 -->|"parameterized SQL"| PG

    subgraph primitives["Sub0 primitives doing the work"]
        P1["hashables / verify_hashables<br/>BCRYPT"]
        P2["tokenize / protected<br/>JWT HS256"]
        P3["payload_validation<br/>+ rate_limit"]
        P4["action chaining<br/>depends_on"]
        P5["read_from_cache<br/>60s aggregations"]
        P6["broadcast_websocket_message"]
    end

    SUB0 --- primitives
```

**Request path.** The browser POSTs to a Sub0 *resource*; Sub0 validates the payload, verifies the
JWT, rate-limits by IP, runs one or more chained SQL actionables, writes the audit row, and
broadcasts a socket message. There is no hand-written server code anywhere in this project.

**Contribution lifecycle.**

```
member                treasurer/owner            owner              recipient
  │                         │                      │                    │
  ├─ record-contribution    │                      │                    │
  │   → _contributions      │                      │                    │
  │     (PENDING)           │                      │                    │
  │   → _activity           │                      │                    │
  │   → ws: circle_update   │                      │                    │
  │                         ├─ confirm-contribution│                    │
  │                         │   → CONFIRMED        │                    │
  │                         │   → _activity        │                    │
  │                         │   → ws               │                    │
  │                         │                      ├─ record-payout     │
  │                         │                      │   sums CONFIRMED   │
  │                         │                      │   for this cycle,  │
  │                         │                      │   pays position N, │
  │                         │                      │   cycle += 1       │
  │                         │                      │   (COMPLETED after │
  │                         │                      │    the last member)│
  │                         │                      │                    ├─ confirm-payout-received
  │                         │                      │                    │   → RECEIVED
```

## 4. Data model (6 tables)

| Table | Purpose | Notes |
|---|---|---|
| `_users` | accounts | `email` unique + indexable; `password` BCRYPT-hashed, never returned |
| `_circles` | the savings group | `status` PENDING→ACTIVE→COMPLETED, `current_cycle`, `rules` JSON |
| `_memberships` | who is in a circle | `role` OWNER/TREASURER/MEMBER, `payout_position`, `status` |
| `_contributions` | money in | `cycle`, `amount`, `status` PENDING/CONFIRMED, `confirmed_by` |
| `_payouts` | money out | `cycle`, `recipient_id`, `status` SCHEDULED/PAID/RECEIVED |
| `_activity` | **append-only audit log** | INSERT only — never UPDATE, never DELETE |

Trust Score, Circle Health and Insights are **computed, not stored** — cached aggregation queries
over `_contributions` and `_memberships`. Nothing to drift, nothing to falsify.

## 5. How we used Sub0

Sub0 is declarative: you define models and endpoints as JSON, and the platform *is* the backend.
Everything below is a Sub0 primitive, not application code we wrote.

| Sub0 primitive | Where CircleSafe uses it |
|---|---|
| **Models** (`JSON_OBJECT`, `foreign_key`, `indexable`) | 6 tables; `_circles.rules` is a `JSON_OBJECT`; every FK declared |
| **`hashables` / `verify_hashables`** | BCRYPT on `sign-up`, verification on `sign-in`; random salt in production |
| **`tokenize`** | JWT (HS256) issued on sign-up/sign-in, key from `$ENV.JWT_SECRET_KEY` |
| **`protected`** | Every non-public endpoint; ownership always comes from `$PROTECTED.id` |
| **`invalidate_tokenize`** | `logout` revokes the presented token |
| **`payload_validation`** | Types + length bounds on every endpoint that accepts input (`EMAIL`, `STRING`, `NUMBER`) |
| **`rate_limit`** | Auth, `create-circle`, `invite-member`, `record-contribution`, keyed on `$HEADER.ip` |
| **Action chaining** (`depends_on`) | `create-circle` → owner membership → audit row; `record-contribution` reads the cycle/amount, then inserts; `record-payout` computes the pot, inserts, advances the cycle, audits |
| **Caching** (`read_from_cache`, `cache_key`, `duration`) | 60s on `get-trust-score`, `get-circle-health`, `get-insights`; `get-dashboard` deliberately **uncached** so live numbers stay live |
| **`broadcast_websocket_message`** | On `start-circle`, `join-circle`, `record-contribution`, `confirm-contribution`, `record-payout`, `confirm-payout-received` |
| **`$GENERATOR.KSUID`** | All primary keys — sortable, collision-resistant, no sequence to leak |
| **Accessors** | `$ENV`, `$PAYLOAD`, `$HEADER.ip`, `$PROTECTED`, `$DATETIME`, `$GENERATOR` |
| **Injection prevention** | Every query parameterized; Sub0 blocks unsafe SQL before execution |

**23 endpoints**, all in `backend/endpoints/`:

| Group | Resources |
|---|---|
| Auth | `sign-up`, `sign-in`, `logout` |
| Circles | `create-circle`, `start-circle`, `list-my-circles`, `get-circle`, `update-circle-rules` |
| Members | `invite-member`, `join-circle`, `list-members`, `set-payout-order` |
| Contributions | `record-contribution`, `confirm-contribution`, `list-contributions` |
| Payouts | `record-payout`, `confirm-payout-received`, `list-payouts` |
| Dashboard | `get-dashboard`, `get-insights` |
| Scores | `get-trust-score`, `get-circle-health` |
| Activity | `list-activity` |

## 6. How we used LingoQL

- **Managed PostgreSQL** — provisioned on LingoQL; the password lives only as `$ENV.DB_PASSWORD`.
- **Sub0 backend service** — deployed on LingoQL with `JWT_SECRET_KEY` and
  `ALLOW_WEBSOCKET_CONNECTIONS=true` set as environment secrets.
- **SSR frontend** — LingoQL auto-detects Next.js, installs, builds and runs it; we read the
  injected `PORT` and bind `0.0.0.0`.
- **HTTPS/TLS** — terminated by LingoQL on 443, including the `wss://` socket upgrade.

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the exact runbook.

## 7. Security

- Passwords BCRYPT-hashed by Sub0; never present in any `returnables`.
- Authorization derived from the **verified token claim** (`$PROTECTED.id`), never from a payload
  field a client could forge.
- **RBAC in SQL.** Confirming a contribution requires an `EXISTS` check that the caller is
  `OWNER` or `TREASURER` *of that circle*; recording a payout requires circle ownership; reads
  require membership. A wrong role doesn't get a filtered view — it gets zero rows.
- Rules and payout order are only writable while `status = 'PENDING'`, enforced in the `WHERE`
  clause of the update itself.
- Rate limiting on auth and every high-frequency mutation.
- Secrets exclusively via `$ENV`; none committed to this repo.
- Tokens travel in the `Authorization` header (not cookies), so CSRF does not apply; protected
  sockets pass the JWT as the `x-access-token` subprotocol.
- `_activity` is INSERT-only by construction — no endpoint can update or delete it.

## 8. Repository layout

```
backend/
  models/            6 Sub0 model files (filename = table name)
  endpoints/         23 Sub0 ABI endpoint files, grouped by domain
    README.md        paste order, conventions, caveats to verify on the live instance
    realtime/        how the WebSocket broadcasts fit together
frontend/            Next.js 14 app (see frontend/README.md)
frontend-design-reference/   palette exploration + the original Lightfall hero
PROGRESS.md          full decision log and task tracker
DEPLOYMENT.md        step-by-step deploy runbook
DEMO_SCRIPT.md       shot list for the demo video
```

## 9. Run it locally

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

With no `NEXT_PUBLIC_API_URL` set, the app runs in **demo mode** against an in-memory mock of
every Sub0 resource — the whole flow (invite → drag the payout order → start → contribute →
confirm → payout → confirm receipt) is clickable without a backend. Point it at the real thing by
setting the two variables in [`frontend/.env.example`](./frontend/.env.example).

## 10. Stack

**Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts · dnd-kit ·
framer-motion · ogl (WebGL hero) · lucide-react
**Backend:** Sub0 (declarative JSON models + ABI endpoints) — zero hand-written server code
**Database:** PostgreSQL (managed by LingoQL)
**Hosting:** LingoQL (frontend + backend + database + TLS)

## 11. Future work

Deliberately out of scope for this build, in rough priority order:

1. **Reminders** — Sub0 cron + queues for "contribution due in 2 days" nudges.
2. **SMS / WhatsApp channels** — most Ajo members live in chat, not in dashboards.
3. **Payment rails** — connect a provider so contributions settle in-app instead of being
   recorded after the fact.
4. **Portable trust score** — export a signed reliability history a lender can verify.
5. **Receipt uploads** — Sub0 `UPLOAD` actionables for transfer screenshots as secondary evidence.
6. **Multi-currency circles** and diaspora contributions.

## 12. Credits

Design language is *inspired by* a Bootstrap landing template (UIdeck "Bliss") but shares no code,
CSS, assets or fonts with it — the UI is an original rebuild in Next.js + Tailwind with our own
"Savanna Trust" palette (emerald / mint / gold on deep forest) and Space Grotesk + Inter.
The WebGL hero is our own `Lightfall` component, recolored to the palette.
