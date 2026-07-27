# CircleSafe — Sub0 Backend (source of truth)

This folder holds the declarative Sub0 backend definitions in version control. Sub0 is
authored by pasting JSON into the Sub0 project UI; we keep the canonical copies here.

## Conventions
- **Database:** PostgreSQL.
- **IDs:** String primary keys, generated at insert with `$GENERATOR.KSUID`.
- **Timestamps:** plain `created_at` / `updated_at` `DateTime` fields, set via `$DATETIME`.
- **Soft delete:** optional `deleted_at` `DateTime`; queries filter `deleted_at IS NULL`.
- **Secrets:** referenced only via `$ENV.*` (e.g. `$ENV.JWT_SECRET_KEY`, `$ENV.DB_PASSWORD`).
  NEVER hardcode secrets in these files.
- **Ownership:** trust `$PROTECTED.id` from the verified JWT, never a user id from the payload.

## Structure
- `models/` — one file per table (filename = table name). Paste each into Sub0 as a model.
- `endpoints/` — one file per ABI endpoint (coming in Phase 2+). Paste each into Sub0.

## Models (Phase 1 — DONE)
`_users`, `_circles`, `_memberships`, `_contributions`, `_payouts`, `_activity`
(`_activity` is append-only: INSERT only, never UPDATE/DELETE — the audit trail.)

## Paste order into Sub0 (respect foreign-key dependencies)
1. `_users`
2. `_circles`      (fk → _users)
3. `_memberships`  (fk → _circles, _users)
4. `_contributions`(fk → _circles, _users)
5. `_payouts`      (fk → _circles, _users)
6. `_activity`     (fk → _circles, _users)
