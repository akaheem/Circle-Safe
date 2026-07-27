# CircleSafe — Deployment runbook

Everything in this file is the **user's track** (it needs accounts and credentials). Work top to
bottom; each step says how to know it worked. Where a step depends on LingoQL/Sub0 UI details we
haven't seen, it's marked **[verify in console]** — the docs index is
<https://docs.lingoql.com/llms.txt>.

Time estimate: ~60–90 minutes for a first run, most of it waiting on builds.

---

## Step 0 — Accounts and hackathon requirements

- [ ] Register on **Devpost** for the Zero to Query hackathon.
- [ ] Register on **LingoQL** and claim the **$20 credit**.
- [ ] Post participation on X/LinkedIn tagging **@lingoqlHQ** and **@holydigits101**
      (this is a submission requirement, not optional).
- [ ] Create a **git repo** for the frontend and push it — the repo URL is required at submission.

## Step 1 — Provision PostgreSQL on LingoQL

- [ ] Create a managed **PostgreSQL** instance. **[verify in console]**
- [ ] Copy the connection details. **Never commit them.** The password is referenced only as
      `$ENV.DB_PASSWORD`.

**Done when:** the instance shows healthy and you have host / port / database / user / password.

## Step 2 — Create the Sub0 project and set secrets

Set these as environment secrets on the Sub0 service:

| Variable | Value | Why |
|---|---|---|
| `DB_PASSWORD` | your Postgres password | DB connection |
| `JWT_SECRET_KEY` | a long random string (≥32 chars) | signs every JWT |
| `ALLOW_WEBSOCKET_CONNECTIONS` | `true` | **required** or `/ws` and every broadcast silently do nothing |

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Done when:** the Sub0 project connects to the database and all three variables are set.

## Step 3 — Paste the models, in this order

Foreign keys mean order matters. From `backend/models/`:

1. `_users`
2. `_circles`
3. `_memberships`
4. `_contributions`
5. `_payouts`
6. `_activity`

### ⚠️ Do the table-name check now — before pasting 23 endpoints

Our SQL assumes the tables are named `_users`, `_circles`, … (filename = table name). The Sub0 docs
are inconsistent: their wallet examples use non-underscored names. So:

- [ ] Paste `_users` and the `sign-up` endpoint only.
- [ ] Call `sign-up` once (Step 5 has the curl).
- [ ] If it fails with "relation does not exist", find the real table name in the DB and
      **find-replace table names across every file in `backend/endpoints/` AND every
      `foreign_key.of` value in `backend/models/`.**

Getting this wrong once is cheap; getting it wrong after pasting everything is 29 edits.

**Done when:** one row exists in the users table.

## Step 4 — Paste the endpoints

All 23 files in `backend/endpoints/` (order doesn't matter once the models exist).
`backend/endpoints/README.md` lists six caveats to watch for; the ones most likely to bite:

| Caveat | Symptom | Fix |
|---|---|---|
| `logout.json` has no `actionables` (pure `invalidate_tokenize`) | rejected as invalid | add a `no_op` QUERY actionable |
| `$PAYLOAD.rules.grace_period_days` (nested payload access) | null lands in the DB | flatten to top-level payload fields in `create-circle` / `update-circle-rules`, and mirror it in `frontend/lib/api.ts` |
| `jsonb_build_object`, `FILTER (WHERE …)`, `WITH` CTEs | blocked by the SQL-safety analyzer | rewrite with plain sub-selects (`get-trust-score`, `get-circle-health` are the users) |
| `depends_on` extracted variables used as bare parameter names | parameter unresolved | match whatever the live platform expects and adjust the chained endpoints |

**Done when:** all 23 resources are listed in the Sub0 project without validation errors.

## Step 5 — Smoke-test the backend with curl

Replace `$API` with your Sub0 base URL.

```bash
API=https://<your-sub0-host>

# 1. create an account (also returns the JWT)
curl -s -X POST $API/sign-up \
  -H 'Content-Type: application/json' \
  -d '{"name":"Amara Okafor","email":"amara@example.com","password":"correct-horse-battery"}'

TOKEN=<paste the token from above>

# 2. create a circle
curl -s -X POST $API/create-circle \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Lagos Traders Circle","contribution_amount":5000,"frequency":"WEEKLY",
       "max_members":4,"currency":"NGN","rules":{"grace_period_days":3,"late_fee":500}}'

CIRCLE=<paste the returned id>

# 3. start it, contribute, confirm, pay out
curl -s -X POST $API/start-circle        -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"circle_id\":\"$CIRCLE\"}"
curl -s -X POST $API/record-contribution -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"circle_id\":\"$CIRCLE\"}"
curl -s -X POST $API/list-contributions  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"circle_id\":\"$CIRCLE\"}"
curl -s -X POST $API/confirm-contribution -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"contribution_id":"<id from the list>"}'
curl -s -X POST $API/get-dashboard       -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"circle_id\":\"$CIRCLE\"}"
curl -s -X POST $API/record-payout       -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"circle_id\":\"$CIRCLE\"}"
curl -s -X POST $API/list-payouts        -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"circle_id\":\"$CIRCLE\"}"

# 4. security checks that MUST fail
curl -s -X POST $API/get-dashboard -H 'Content-Type: application/json' -d "{\"circle_id\":\"$CIRCLE\"}"        # expect 401 (no token)
curl -s -X POST $API/get-dashboard -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"circle_id":"someone-elses-circle-id"}'                                                                 # expect empty / no access
```

### 🔴 Record the response shape

`frontend/lib/api.ts` assumes the JSON body **is** the `main_returnable` (an object, or an array for
list endpoints). If the live response wraps it — `{"data": …}`, `{"result": …}` — unwrap it in the
one `call()` function in that file. This is the single most likely integration break, and it's a
one-line fix.

**Done when:** the full lifecycle works over curl and the two security checks fail as expected.

## Step 6 — Deploy the frontend

- [ ] Push `frontend/` to its git repo.
- [ ] Create a LingoQL service from that repo. Next.js is auto-detected (install → build → run);
      the injected `PORT` is handled by `next start`.
- [ ] Set environment variables on the service:

```
NEXT_PUBLIC_API_URL=https://<your-sub0-host>
NEXT_PUBLIC_WS_URL=wss://<your-sub0-host>/ws
```

These are **build-time** values in Next.js — set them before the build, and rebuild after any change.

- [ ] Deploy and open the HTTPS URL.

**Done when:** the landing page loads over HTTPS and the "Demo mode" banner is **gone** (its absence
is how you know `NEXT_PUBLIC_API_URL` reached the build).

## Step 7 — End-to-end verification in the browser

Use two browsers (or a normal + incognito window) so you can act as two members.

- [ ] Register user A, create a circle (the 4-step wizard).
- [ ] Register user B in the other window.
- [ ] As A: **Members → invite** B's email. As B: open the circle → **Accept invite**.
- [ ] As A: **Rules & Order** → drag the payout order (or "Random draw") → **Save rules & order**.
- [ ] As A: **Start circle**. Confirm Rules & Order now shows as locked.
- [ ] As B: **Record my contribution**. Watch A's window update **without a refresh** — that's the
      WebSocket broadcast. If it doesn't, check `ALLOW_WEBSOCKET_CONNECTIONS` and `NEXT_PUBLIC_WS_URL`,
      and look for the socket in the browser network tab.
- [ ] As A: **Ledger → Confirm**. Check **Trust & Health** and **Activity** both reflect it.
- [ ] As A: **Payouts → Record payout for cycle 1**. As the cycle-1 recipient: **I received this**.
- [ ] Confirm the cycle advanced and the Activity log shows every step, oldest entry intact.

**Done when:** all of the above pass on the deployed URL. That sequence is also your demo script.

## Step 8 — Submit

- [ ] Root `README.md` — done, but fill in the three placeholder links at the top.
- [ ] Architecture diagram — the Mermaid block in the README renders on GitHub; export a PNG for
      Devpost if it wants an image.
- [ ] Record the demo video (3–5 min) — see `DEMO_SCRIPT.md`.
- [ ] Devpost submission: description, frontend repo URL, live URL, video, README.
- [ ] Submit **before the deadline** — leave buffer for the video upload.

---

## Rollback / troubleshooting

| Symptom | Likely cause |
|---|---|
| Every request 401 | `JWT_SECRET_KEY` changed after tokens were issued — log out and back in |
| "relation does not exist" | table-name underscore mismatch (Step 3) |
| UI shows "Demo mode" in production | `NEXT_PUBLIC_API_URL` wasn't set **at build time** — rebuild |
| Data loads but nothing is live | `ALLOW_WEBSOCKET_CONNECTIONS` unset, or `NEXT_PUBLIC_WS_URL` missing/wrong scheme (`wss://` on HTTPS) |
| Scores look stale for a minute | expected — `get-trust-score`/`get-circle-health`/`get-insights` are cached 60s; `get-dashboard` is not |
| Numbers render as `NaN` | Postgres returned a numeric as a string and a spot is missing its `Number()` coercion — the panels coerce, but check any new code |
