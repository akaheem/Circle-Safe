-- CircleSafe schema for the self-hosted runtime.
--
-- This is a faithful translation of backend/models/*.json (the canonical Sub0 models):
-- filename = table name, String -> TEXT/VARCHAR, Number -> INTEGER, Float -> DOUBLE PRECISION,
-- DateTime -> TIMESTAMPTZ, JSON_OBJECT -> JSONB, indexable -> INDEX, foreign_key -> REFERENCES.
-- Keep the two in sync: if a model changes, change it here too.
--
-- Applied automatically on first request (see lib/server/db.ts), or by hand:
--   psql "$DATABASE_URL" -f lib/server/schema.sql

CREATE TABLE IF NOT EXISTS _users (
  id          VARCHAR(255) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL,
  deleted_at  TIMESTAMPTZ
);
-- `email` is unique in the model's intent (sign-up must not create duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS _users_email_key ON _users (LOWER(email));
CREATE INDEX IF NOT EXISTS _users_name_idx ON _users (name);

CREATE TABLE IF NOT EXISTS _circles (
  id                  VARCHAR(255) PRIMARY KEY,
  name                VARCHAR(255)     NOT NULL,
  owner_id            VARCHAR(255)     NOT NULL REFERENCES _users (id),
  contribution_amount NUMERIC(14,2) NOT NULL,
  frequency           VARCHAR(20)      NOT NULL,
  max_members         INTEGER          NOT NULL,
  currency            VARCHAR(10)      NOT NULL,
  status              VARCHAR(20)      NOT NULL,
  current_cycle       INTEGER          NOT NULL DEFAULT 0,
  rules               JSONB,
  created_at          TIMESTAMPTZ      NOT NULL,
  updated_at          TIMESTAMPTZ      NOT NULL,
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS _circles_owner_idx ON _circles (owner_id);
CREATE INDEX IF NOT EXISTS _circles_name_idx  ON _circles (name);

CREATE TABLE IF NOT EXISTS _memberships (
  id              VARCHAR(255) PRIMARY KEY,
  circle_id       VARCHAR(255) NOT NULL REFERENCES _circles (id),
  user_id         VARCHAR(255) NOT NULL REFERENCES _users (id),
  role            VARCHAR(20)  NOT NULL,
  payout_position INTEGER      NOT NULL DEFAULT 0,
  status          VARCHAR(20)  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL,
  updated_at      TIMESTAMPTZ  NOT NULL,
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS _memberships_circle_idx ON _memberships (circle_id);
CREATE INDEX IF NOT EXISTS _memberships_user_idx   ON _memberships (user_id);
-- One membership row per person per circle.
CREATE UNIQUE INDEX IF NOT EXISTS _memberships_circle_user_key ON _memberships (circle_id, user_id);

CREATE TABLE IF NOT EXISTS _contributions (
  id           VARCHAR(255) PRIMARY KEY,
  circle_id    VARCHAR(255)     NOT NULL REFERENCES _circles (id),
  user_id      VARCHAR(255)     NOT NULL REFERENCES _users (id),
  cycle        INTEGER          NOT NULL,
  amount       NUMERIC(14,2) NOT NULL,
  status       VARCHAR(20)   NOT NULL,
  confirmed_by VARCHAR(255)     REFERENCES _users (id),
  created_at   TIMESTAMPTZ      NOT NULL,
  updated_at   TIMESTAMPTZ      NOT NULL,
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS _contributions_circle_idx ON _contributions (circle_id);
CREATE INDEX IF NOT EXISTS _contributions_user_idx   ON _contributions (user_id);
-- A member records at most one contribution per cycle.
CREATE UNIQUE INDEX IF NOT EXISTS _contributions_circle_user_cycle_key
  ON _contributions (circle_id, user_id, cycle);

CREATE TABLE IF NOT EXISTS _payouts (
  id           VARCHAR(255) PRIMARY KEY,
  circle_id    VARCHAR(255)     NOT NULL REFERENCES _circles (id),
  cycle        INTEGER          NOT NULL,
  recipient_id VARCHAR(255)     NOT NULL REFERENCES _users (id),
  amount       NUMERIC(14,2) NOT NULL,
  status       VARCHAR(20)  NOT NULL,
  recorded_by  VARCHAR(255)     NOT NULL REFERENCES _users (id),
  created_at   TIMESTAMPTZ      NOT NULL,
  updated_at   TIMESTAMPTZ      NOT NULL
);
CREATE INDEX IF NOT EXISTS _payouts_circle_idx    ON _payouts (circle_id);
CREATE INDEX IF NOT EXISTS _payouts_recipient_idx ON _payouts (recipient_id);
-- One payout per cycle per circle — this is what makes record-payout idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS _payouts_circle_cycle_key ON _payouts (circle_id, cycle);

-- APPEND-ONLY. Nothing in this application updates or deletes from _activity.
CREATE TABLE IF NOT EXISTS _activity (
  id         VARCHAR(255) PRIMARY KEY,
  circle_id  VARCHAR(255) NOT NULL REFERENCES _circles (id),
  actor_id   VARCHAR(255) REFERENCES _users (id),
  type       VARCHAR(40)  NOT NULL,
  message    VARCHAR(500) NOT NULL,
  metadata   VARCHAR(2000),
  created_at TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS _activity_circle_idx ON _activity (circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS _activity_type_idx   ON _activity (type);

-- Runtime-only table, NOT part of the 6-model design.
-- Sub0 provides token revocation natively via `invalidate_tokenize`; self-hosted we need
-- somewhere to keep revoked JWTs until they expire on their own.
CREATE TABLE IF NOT EXISTS _revoked_tokens (
  jti        VARCHAR(255) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS _revoked_tokens_expiry_idx ON _revoked_tokens (expires_at);

/* =====================================================================
 * v2 — email verification, invitations, join requests, admin, outbox
 * ===================================================================== */

-- Idempotent column additions, so this file works on a fresh DB and an existing one.
ALTER TABLE _users   ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE _users   ADD COLUMN IF NOT EXISTS role              VARCHAR(20) NOT NULL DEFAULT 'USER';
ALTER TABLE _circles ADD COLUMN IF NOT EXISTS starts_at         TIMESTAMPTZ;
ALTER TABLE _circles ADD COLUMN IF NOT EXISTS visibility        VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE _circles ADD COLUMN IF NOT EXISTS description       VARCHAR(500);
CREATE INDEX IF NOT EXISTS _circles_discovery_idx ON _circles (visibility, status);

-- Single-use, hashed tokens for email verification (and password reset later).
-- Only the SHA-256 of the token is stored: a database leak can't be replayed as a live link.
CREATE TABLE IF NOT EXISTS _email_tokens (
  id         VARCHAR(255) PRIMARY KEY,
  user_id    VARCHAR(255) NOT NULL REFERENCES _users (id),
  type       VARCHAR(20)  NOT NULL,          -- VERIFY | RESET
  token_hash VARCHAR(64)  NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS _email_tokens_hash_key ON _email_tokens (token_hash);
CREATE INDEX IF NOT EXISTS _email_tokens_user_idx ON _email_tokens (user_id, type);



ALTER TABLE _users ADD COLUMN IF NOT EXISTS google_id         VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS _users_google_id_key ON _users (google_id) WHERE google_id IS NOT NULL AND google_id != '';


-- Invitations addressed to an EMAIL, so you can invite someone who has no account yet.
-- (_memberships still models people who are actually in the circle.)
CREATE TABLE IF NOT EXISTS _invitations (
  id           VARCHAR(255) PRIMARY KEY,
  circle_id    VARCHAR(255) NOT NULL REFERENCES _circles (id),
  email        VARCHAR(255) NOT NULL,
  invited_by   VARCHAR(255) NOT NULL REFERENCES _users (id),
  token_hash   VARCHAR(64)  NOT NULL,
  status       VARCHAR(20)  NOT NULL,        -- PENDING | ACCEPTED | DECLINED | CANCELLED
  expires_at   TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL,
  responded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS _invitations_token_key ON _invitations (token_hash);
CREATE INDEX IF NOT EXISTS _invitations_circle_idx ON _invitations (circle_id, status);
CREATE INDEX IF NOT EXISTS _invitations_email_idx  ON _invitations (LOWER(email), status);
-- At most one live invitation per person per circle.
CREATE UNIQUE INDEX IF NOT EXISTS _invitations_open_key
  ON _invitations (circle_id, LOWER(email)) WHERE status = 'PENDING';

-- The other direction: a member asks to join a circle they discovered.
CREATE TABLE IF NOT EXISTS _join_requests (
  id         VARCHAR(255) PRIMARY KEY,
  circle_id  VARCHAR(255) NOT NULL REFERENCES _circles (id),
  user_id    VARCHAR(255) NOT NULL REFERENCES _users (id),
  message    VARCHAR(500),
  status     VARCHAR(20)  NOT NULL,          -- PENDING | APPROVED | REJECTED | CANCELLED
  decided_by VARCHAR(255) REFERENCES _users (id),
  created_at TIMESTAMPTZ  NOT NULL,
  decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS _join_requests_circle_idx ON _join_requests (circle_id, status);
CREATE INDEX IF NOT EXISTS _join_requests_user_idx   ON _join_requests (user_id, status);
-- One open request per person per circle.
CREATE UNIQUE INDEX IF NOT EXISTS _join_requests_open_key
  ON _join_requests (circle_id, user_id) WHERE status = 'PENDING';

-- Outbox: every email is recorded here before delivery is attempted, so the flow is
-- auditable, demoable without SMTP, and debuggable when delivery fails.
CREATE TABLE IF NOT EXISTS _emails (
  id         VARCHAR(255) PRIMARY KEY,
  to_email   VARCHAR(255) NOT NULL,
  subject    VARCHAR(255) NOT NULL,
  template   VARCHAR(40)  NOT NULL,
  body       TEXT         NOT NULL,
  status     VARCHAR(20)  NOT NULL,          -- SENT | LOGGED | FAILED
  error      VARCHAR(500),
  created_at TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS _emails_created_idx ON _emails (created_at DESC);
CREATE INDEX IF NOT EXISTS _emails_to_idx      ON _emails (LOWER(to_email));
