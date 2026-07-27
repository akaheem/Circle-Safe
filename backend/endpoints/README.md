# CircleSafe — Sub0 Endpoints (ABI)

Canonical, version-controlled copies of every Sub0 endpoint. Paste each into the Sub0 project.

## Env vars required (set as secrets in Sub0/LingoQL — never hardcode)
- `JWT_SECRET_KEY` — signing key for JWTs.
- `DB_PASSWORD` — PostgreSQL password (used by the DB connection config, not in queries).

## Global conventions applied to every endpoint
- **Auth:** `tokenize` issues JWT (HS256); `protected` guards state-changing endpoints.
- **Ownership:** always filter/insert using `$PROTECTED.id` (verified claim), never a payload id.
- **Validation:** `payload_validation` on every endpoint that accepts input.
- **Rate limiting:** `rate_limit` on auth + sensitive endpoints.
- **Passwords:** `hashables` (BCRYPT rounds 12) on write; `verify_hashables` on sign-in.
  Password is NEVER in `returnables`.
- **Audit:** every mutating action also INSERTs a row into `_activity` (append-only).

## ⚠️ TABLE-NAME CAVEAT — verify once against your Sub0 instance
Our model files are named `_users.json`, `_circles.json`, etc., and creating-models docs say
the table name = filename. So all SQL here uses `_users`, `_circles`, `_memberships`,
`_contributions`, `_payouts`, `_activity`. The docs' wallet SQL examples used non-underscored
names (`users`), so the docs are inconsistent. **After pasting the first model + sign-up
endpoint, run one test insert.** If Sub0 reports the table as `users` (underscore stripped),
do a find-replace of table names in ALL endpoints AND `foreign_key.of` values to match.

## Complete endpoint list (all backend endpoints written)

**auth/** — `sign-up`, `sign-in`, `logout`
**circles/** — `create-circle`, `start-circle`, `list-my-circles`, `get-circle`, `update-circle-rules`
**members/** — `invite-member`, `join-circle`, `list-members`, `set-payout-order`
**contributions/** — `record-contribution`, `confirm-contribution`, `list-contributions`
**payouts/** — `record-payout`, `confirm-payout-received`, `list-payouts`
**dashboard/** — `get-dashboard`, `get-insights`
**scores/** — `get-trust-score`, `get-circle-health`
**activity/** — `list-activity`
**realtime/** — see `realtime/README.md` (broadcasts embedded in mutation endpoints)

## Circle lifecycle
`create-circle` (PENDING) → owner invites + sets payout order → `start-circle` (ACTIVE, cycle 1)
→ members `record-contribution` → treasurer/owner `confirm-contribution` → owner `record-payout`
(auto-advances cycle; sets COMPLETED after the last member is paid) → recipient
`confirm-payout-received`.

`list-payouts` (added 2026-07-25) exists because `confirm-payout-received` needs a `payout_id`
and nothing else returned one to the recipient. It also backs the payout history UI.

## ⚠️ CAVEATS TO VERIFY once the Sub0 project is live (test early, cheap to fix)
1. **Table names** — see the underscore caveat above. Verify with one insert; find-replace if needed.
2. **logout.json** — has no `actionables` (pure `invalidate_tokenize`). If Sub0 requires ≥1
   actionable, add a `no_op` action. Client sends `{ "tokens": ["<jwt>"] }`.
3. **`jsonb_build_object` + `FILTER` + `WITH` (CTE)** — used in create/update-circle,
   get-trust-score, get-circle-health. These are standard PostgreSQL; confirm Sub0's SQL-safety
   analyzer permits them (it should — they're parameterized). If blocked, we rewrite with
   simpler expressions.
4. **Nested payload accessor** — `$PAYLOAD.rules.grace_period_days` assumes nested `$PAYLOAD`
   access works (docs say it does). If not, flatten to top-level payload fields.
5. **depends_on variable reuse** — extracted vars (`circle_id`, `cycle`, `amount`, etc.) are
   referenced as bare names in `parameters`, matching the action-chaining docs.
6. **`broadcast_websocket_message`** — requires `ALLOW_WEBSOCKET_CONNECTIONS=true`.

## 🔎 TWO GAPS FOUND WHILE BUILDING THE SELF-HOSTED RUNTIME (2026-07-25)

Both were found by re-implementing these same queries in `frontend/lib/server/resources.ts`.
They are fixed there and should be backported here before this backend goes live.

1. **`invite-member` doesn't enforce `max_members`.** The insert only checks that the caller owns a
   `PENDING` circle, so an owner can invite more people than the circle has seats — and then the
   payout schedule has more members than cycles. Fix: add a seat count to the `WHERE EXISTS`, e.g.
   `AND (SELECT COUNT(*) FROM _memberships m2 WHERE m2.circle_id = $2 AND m2.deleted_at IS NULL)
   < (SELECT max_members FROM _circles WHERE id = $2)`.
2. **Cached aggregations can leak across membership.** `get-insights`, `get-trust-score` and
   `get-circle-health` use `cache_key: "..._$PAYLOAD.circle_id"` — keyed on the circle only — while
   the `EXISTS (… me.user_id = $2)` membership guard sits *inside* the cached query. So the first
   caller's result can be served from cache to a later non-member caller. Fix: either include the
   caller in the cache key (`..._$PAYLOAD.circle_id_$PROTECTED.id`, at the cost of hit rate) or
   split the membership check into a separate uncached actionable that runs first.
