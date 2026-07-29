import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTx } from "./db";
import { newId } from "./ids";
import { hashPassword, revokeTokens, signToken, verifyPassword, verifyGoogleToken } from "./auth";
import { num, str, type Spec } from "./validate";
import { cached, invalidateCircle } from "./cache";
import { APP_URL, emailConfigured, emails } from "./email";
import { broadcast } from "./events";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "./errors";

/**
 * The self-hosted runtime for CircleSafe's resources.
 *
 * Every SQL statement here is the same statement written declaratively in
 * `backend/endpoints/**.json` for Sub0 — that folder stays the canonical backend design.
 * This file is the executor we need while we have no Sub0 instance: it re-implements the
 * platform primitives (validation, rate limits, protected claims, action chaining, caching,
 * broadcasts) around the identical queries, so both runtimes answer the same contract.
 *
 * Divergences from the Sub0 definitions are marked `NOTE (divergence)` and are all hardening.
 */

export interface Ctx {
  payload: Record<string, unknown>;
  /** Verified user id from the JWT — the equivalent of `$PROTECTED.id`. Empty for public resources. */
  userId: string;
  ip: string;
}

export interface ResourceDef {
  /** `protected` in Sub0 terms. */
  auth: boolean;
  /** `rate_limit` in Sub0 terms; identifier is always the caller IP. */
  rateLimit?: { limit: number; windowSeconds: number };
  /** `payload_validation` in Sub0 terms. */
  spec?: Spec;
  run: (ctx: Ctx) => Promise<unknown>;
}

const now = () => new Date().toISOString();
const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const VERIFY_TTL_HOURS = 24;
const INVITE_TTL_DAYS = 14;

const CIRCLE_ID: Spec = { circle_id: { type: "STRING", min_length: 1, max_length: 255 } };
const TOKEN: Spec = { token: { type: "STRING", min_length: 20, max_length: 255 } };

/** Reads a rule value from either `rules.x` (nested, as Sub0 sends it) or a flat `x`. */
function rule(payload: Record<string, unknown>, key: string, fallback = 0): number {
  const rules = payload.rules as Record<string, unknown> | undefined;
  const nested = rules && typeof rules === "object" ? rules[key] : undefined;
  return num(nested ?? payload[key], fallback);
}

async function logActivity(
  client: PoolClient,
  circleId: string,
  actorId: string | null,
  type: string,
  message: string,
): Promise<void> {
  await client.query(
    `INSERT INTO _activity (id, circle_id, actor_id, type, message, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
    [newId(), circleId, actorId, type, message, now()],
  );
}

/* --------------------------- tokens + links -------------------------- */

/** Only the hash is ever stored, so a database leak can't be replayed as a live link. */
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

/**
 * An emailed link that reached nobody is handed back to the caller instead — that is what makes
 * invitations and verification testable with no mail provider at all.
 *
 * The decision is the *delivery status*, not whether SMTP happens to be configured: a bad SMTP
 * password marks the send FAILED, and suppressing the link then would leave the invitee with
 * nothing and the owner told it was emailed. Only a confirmed SENT withholds it.
 */
function fallbackLink(
  key: "invite_url" | "verify_url",
  path: string,
  delivery: { status: string },
): Record<string, string> {
  return delivery.status === "SENT" ? {} : { [key]: `${APP_URL}${path}` };
}

/**
 * `/verify/<token>` and `/invite/<token>` are bearer credentials: whoever holds one can confirm
 * that address or take that seat. Strips them out of anything echoed back over the API.
 */
const redactLinkTokens = (body: string) =>
  body.replace(/(\/(?:verify|invite)\/)[A-Za-z0-9_=-]+/g, "$1token-redacted");

/* -------------------------- identity helpers ------------------------ */

interface UserRow {
  id: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  role: string;
  google_id?: string | null;
}

async function loadUser(userId: string): Promise<UserRow> {
  const rows = await query<UserRow>(
    `SELECT id, name, email, email_verified_at, role FROM _users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  if (!rows.length) throw unauthorized("Your account could not be found");
  return rows[0];
}

async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const rows = await query<{ role: string }>(
    `SELECT role FROM _users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  return rows[0]?.role === "ADMIN";
}

async function assertAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw forbidden("Administrator access only");
}

/**
 * The operator's list of platform administrators. Separated by commas, semicolons or plain
 * whitespace, matched case-insensitively, with padding and any surrounding quotes stripped —
 * an address is never rejected for how it happened to be typed into the environment.
 */
const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((value) => value.trim().replace(/^["']|["']$/g, "").toLowerCase())
    .filter(Boolean);

/**
 * Reconciles one account's platform role against ADMIN_EMAILS, on sign-in and on every `me`.
 *
 * Assigning the role only at sign-up made the variable useless to the person who needs it most:
 * the operator's own account already exists, so setting ADMIN_EMAILS could never reach it. The
 * list is the control surface, so it is applied to the account each time the account appears.
 *
 * Demotion is deliberate: taking an address off the list has to be able to take the role away,
 * otherwise there is no revocation short of hand-written SQL. It only runs while the list is
 * non-empty — an unset or blank ADMIN_EMAILS means "not configured", not "nobody is an admin",
 * so a missing variable can never strip every administrator at once.
 *
 * A promotion also confirms the address, exactly as sign-up does for a listed operator: they
 * need the console immediately, and the operator naming the address is the assertion of it.
 */
async function reconcileAdminRole(user: UserRow): Promise<UserRow> {
  const listed = adminEmails();
  if (!listed.length) return user;

  const role = listed.includes(user.email.trim().toLowerCase()) ? "ADMIN" : "USER";
  if (role === user.role) return user;

  const rows = await query<UserRow>(
    `UPDATE _users
     SET role = $2,
         email_verified_at = CASE WHEN $2 = 'ADMIN'
           THEN COALESCE(email_verified_at, $3::timestamptz) ELSE email_verified_at END,
         updated_at = $3::timestamptz
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, name, email, email_verified_at, role`,
    [user.id, role, now()],
  );
  console.log(`[admin] ${user.email}: role ${user.role} -> ${role} (from ADMIN_EMAILS)`);
  return rows[0] ?? user;
}

/* --------------------------- circle helpers ------------------------- */

interface CircleRow {
  id: string;
  name: string;
  owner_id: string;
  status: string;
  visibility: string;
  max_members: number;
  members_count: string;
  owner_name: string;
  owner_email: string;
}

async function loadCircle(circleId: string): Promise<CircleRow> {
  const rows = await query<CircleRow>(
    `SELECT c.id, c.name, c.owner_id, c.status, c.visibility, c.max_members,
            o.name AS owner_name, o.email AS owner_email,
            (SELECT COUNT(*) FROM _memberships m
             WHERE m.circle_id = c.id AND m.deleted_at IS NULL) AS members_count
     FROM _circles c
     JOIN _users o ON o.id = c.owner_id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [circleId],
  );
  if (!rows.length) throw notFound("Circle not found");
  return rows[0];
}

/** COUNT comes back as a string from Postgres, hence the coercion on both sides. */
const seatsLeft = (circle: CircleRow) =>
  Number(circle.max_members) - Number(circle.members_count);

/**
 * NOTE (divergence): Sub0's cached aggregations use `cache_key: "insights_$PAYLOAD.circle_id"`,
 * which is keyed on the circle only — the membership check lives *inside* the cached query, so a
 * cache hit could in principle be served to a non-member. Here the membership check runs before
 * the cache is consulted. Worth backporting to the Sub0 files (logged in endpoints/README.md).
 *
 * An ADMIN passes without a membership: admins must be able to audit any circle with the same
 * visibility as its leader. This is READ authorisation only — every write still checks the
 * caller's role in the circle itself.
 */
async function assertMember(circleId: string, userId: string): Promise<void> {
  const rows = await query(
    `SELECT 1 FROM _memberships WHERE circle_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [circleId, userId],
  );
  if (rows.length) return;
  if (await isAdmin(userId)) return;
  throw forbidden("You are not a member of this circle");
}

/**
 * NOTE (divergence): the gate on the circle's DATA — the ledger, the pot, the payouts, the
 * trust scores, the activity log. An INVITED row is a held seat, not a membership: it exists so
 * the seat can be counted and so the invitee can find the accept button, and it must not open
 * the books to someone who has not accepted (and may yet decline). `assertMember` stays for the
 * circle record itself, which an invitee has to be able to read to answer the invitation.
 *
 * An ADMIN passes for the same reason as in `assertMember`: read authorisation only.
 */
async function assertActiveMember(circleId: string, userId: string): Promise<void> {
  const rows = await query(
    `SELECT 1 FROM _memberships
     WHERE circle_id = $1 AND user_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
    [circleId, userId],
  );
  if (rows.length) return;
  if (await isAdmin(userId)) return;
  throw forbidden("Only an active member of this circle can see that");
}

/**
 * How much of the member list the caller may read. `null` is the whole circle; a user id is that
 * one row. An invitee is given their own row and nothing else: the circle page reads the list to
 * find out who it is looking at, so withholding it outright would take away the accept button,
 * while returning all of it would hand the other members' addresses to someone still deciding.
 */
async function memberListScope(circleId: string, userId: string): Promise<string | null> {
  const rows = await query<{ status: string }>(
    `SELECT status FROM _memberships
     WHERE circle_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [circleId, userId],
  );
  if (rows[0]?.status === "ACTIVE") return null;
  if (await isAdmin(userId)) return null;
  if (rows.length) return userId;
  throw forbidden("You are not a member of this circle");
}

/** Owner or treasurer of the circle, or a platform admin. Used for the request queue. */
async function assertCircleStaff(circleId: string, userId: string, message: string): Promise<void> {
  const rows = await query(
    `SELECT 1 FROM _memberships
     WHERE circle_id = $1 AND user_id = $2 AND role IN ('OWNER', 'TREASURER')
       AND deleted_at IS NULL`,
    [circleId, userId],
  );
  if (rows.length) return;
  if (await isAdmin(userId)) return;
  throw forbidden(message);
}

/**
 * A scheduled start with nothing to fire it. There is no cron in this runtime, so the promotion
 * happens lazily on the next read of the circle — which is the moment it matters to anyone.
 * The UPDATE re-checks every condition, so two concurrent readers can't both start a circle.
 */
async function maybeAutoStart(circleId: string): Promise<void> {
  const due = await query<{ id: string }>(
    `SELECT c.id FROM _circles c
     WHERE c.id = $1 AND c.status = 'PENDING' AND c.deleted_at IS NULL
       AND c.starts_at IS NOT NULL AND c.starts_at <= now()
       AND (SELECT COUNT(*) FROM _memberships m
            WHERE m.circle_id = c.id AND m.status = 'ACTIVE' AND m.deleted_at IS NULL) >= 2`,
    [circleId],
  );
  if (!due.length) return;

  const started = await withTx(async (client) => {
    const updated = await client.query(
      `UPDATE _circles SET status = 'ACTIVE', current_cycle = 1, updated_at = $2::timestamptz
       WHERE id = $1 AND status = 'PENDING'
         AND starts_at IS NOT NULL AND starts_at <= now()
       RETURNING id, name`,
      [circleId, now()],
    );
    if (!updated.rows.length) return null;
    await logActivity(
      client, circleId, null, "CIRCLE_STARTED",
      "Circle started on its scheduled date - cycle 1 begins",
    );
    return updated.rows[0] as { id: string; name: string };
  });
  if (!started) return;

  invalidateCircle(circleId);
  broadcast(circleId);

  // Nobody pressed a button, so the members have to be told.
  const members = await query<{ email: string; name: string }>(
    `SELECT u.email, u.name FROM _memberships m
     JOIN _users u ON u.id = m.user_id
     WHERE m.circle_id = $1 AND m.status = 'ACTIVE' AND m.deleted_at IS NULL`,
    [circleId],
  );
  await Promise.all(
    members.map((member) => emails.circleStarted(member.email, member.name, started.name, circleId)),
  );
}

/* --------------------------- payload helpers ------------------------ */

function optionalFutureDate(value: unknown, field = "starts_at"): string | null {
  const raw = str(value);
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) throw badRequest(`"${field}" must be a valid date`);
  if (at.getTime() <= Date.now()) throw badRequest("The start date has to be in the future");
  return at.toISOString();
}

function optionalVisibility(payload: Record<string, unknown>): "PUBLIC" | "PRIVATE" | null {
  const raw = str(payload.visibility).toUpperCase();
  if (!raw) return null;
  if (raw !== "PUBLIC" && raw !== "PRIVATE") {
    throw badRequest('"visibility" must be PUBLIC or PRIVATE');
  }
  return raw;
}

function optionalDescription(payload: Record<string, unknown>): string | null {
  const text = str(payload.description);
  if (text.length > 500) throw badRequest('"description" must be at most 500 characters');
  return text || null;
}

function choice<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const raw = str(value).toUpperCase() as T;
  if (!allowed.includes(raw)) throw badRequest(`"${field}" must be ${allowed.join(" or ")}`);
  return raw;
}

const isUniqueViolation = (err: unknown, constraint?: string) => {
  const e = err as { code?: string; constraint?: string };
  return e?.code === "23505" && (!constraint || e.constraint === constraint);
};

/** Columns every circle read returns, so the client sees one shape everywhere. */
const CIRCLE_COLUMNS = `c.id, c.name, c.owner_id, c.contribution_amount, c.frequency,
            c.max_members, c.currency, c.status, c.current_cycle, c.rules, c.created_at,
            c.starts_at, c.visibility, c.description`;

const CIRCLE_DERIVED = `o.name AS owner_name,
            (SELECT COUNT(*)::int FROM _memberships m
             WHERE m.circle_id = c.id AND m.deleted_at IS NULL) AS members_count,
            GREATEST(c.max_members - (SELECT COUNT(*)::int FROM _memberships m
             WHERE m.circle_id = c.id AND m.deleted_at IS NULL), 0) AS seats_left`;

const INVITATION_FIELDS = `id, circle_id, email, invited_by, status, created_at,
            expires_at, responded_at`;
const INVITATION_COLUMNS = `i.id, i.circle_id, i.email, i.invited_by, i.status, i.created_at,
            i.expires_at, i.responded_at`;

const JOIN_REQUEST_FIELDS = `id, circle_id, user_id, message, status, created_at, decided_at`;
const JOIN_REQUEST_COLUMNS = `r.id, r.circle_id, r.user_id, r.message, r.status, r.created_at,
            r.decided_at`;

export const resources: Record<string, ResourceDef> = {
  /* ------------------------------- Auth ------------------------------- */

  "sign-up": {
    auth: false,
    rateLimit: { limit: 10, windowSeconds: 60 },
    spec: {
      name: { type: "STRING", min_length: 2, max_length: 255 },
      email: { type: "EMAIL", max_length: 255 },
      password: { type: "STRING", min_length: 8, max_length: 255 },
    },
    run: async ({ payload }) => {
      const email = str(payload.email).toLowerCase();
      const name = str(payload.name);
      const id = newId();
      const password = await hashPassword(String(payload.password));
      const timestamp = now();

      // The operator's own addresses get the admin role immediately.
      const admin = adminEmails().includes(email);

      let user: UserRow;
      try {
        user = await withTx(async (client) => {
          const inserted = await client.query(
            `INSERT INTO _users
               (id, name, email, password, role, email_verified_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $8::timestamptz)
             RETURNING id, name, email, email_verified_at, role`,
            [id, name, email, password, admin ? "ADMIN" : "USER",
             admin ? timestamp : null, timestamp],
          );
          return inserted.rows[0] as UserRow;
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict("An account with that email already exists");
        throw err;
      }

      return {
        ...user,
        token: signToken(id),
      };
    },
  },

  "sign-in": {
    auth: false,
    rateLimit: { limit: 10, windowSeconds: 60 },
    spec: {
      email: { type: "EMAIL", max_length: 255 },
      password: { type: "STRING", min_length: 1, max_length: 255 },
    },
    run: async ({ payload }) => {
      const rows = await query<UserRow & { password: string }>(
        `SELECT id, name, email, password, email_verified_at, role FROM _users
         WHERE LOWER(email) = $1 AND deleted_at IS NULL`,
        [str(payload.email).toLowerCase()],
      );
      const user = rows[0];
      // One message for both failures — don't leak which emails exist.
      const ok = user && (await verifyPassword(String(payload.password), user.password));
      if (!ok) throw unauthorized("Invalid email or password");

      // ADMIN_EMAILS is applied here as well as at sign-up, so an account that already existed
      // when the operator set the variable picks the role up on its next sign-in.
      const account = await reconcileAdminRole({
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified_at: user.email_verified_at,
        role: user.role,
      });

      return { ...account, token: signToken(account.id) };
    },
  },

  "google-sign-in": {
    auth: false,
    rateLimit: { limit: 10, windowSeconds: 60 },
    spec: {
      credential: { type: "STRING", min_length: 20, max_length: 2000 },
    },
    run: async ({ payload }) => {
      const credential = str(payload.credential);

      // Verify the Google ID token.
      let googlePayload: { sub: string; email: string; name: string; picture?: string };
      try {
        googlePayload = await verifyGoogleToken(credential);
      } catch {
        throw unauthorized("Invalid Google credential");
      }

      const { sub: googleId, email, name } = googlePayload;
      const timestamp = now();

      // Look up by google_id first, then by email.
      const existing = await query<UserRow>(
        `SELECT id, name, email, email_verified_at, role FROM _users
         WHERE (google_id = $1 OR LOWER(email) = $2) AND deleted_at IS NULL
         LIMIT 1`,
        [googleId, email.toLowerCase()],
      );

      let user: UserRow;
      if (existing.length) {
        user = existing[0];
        // If this account doesn't have a Google ID linked yet, link it.
        if (!user.google_id) {
          const updated = await query<UserRow>(
            `UPDATE _users
             SET google_id = $2, email_verified_at = COALESCE(email_verified_at, $3::timestamptz),
                 updated_at = $3::timestamptz
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id, name, email, email_verified_at, role`,
            [user.id, googleId, timestamp],
          );
          user = updated[0] ?? user;
        }
        user = await reconcileAdminRole(user);
      } else {
        // Create a new account from Google profile.
        const newUser = await withTx(async (client) => {
          const id = newId();
          const inserted = await client.query(
            `INSERT INTO _users
               (id, name, email, google_id, role, email_verified_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $7::timestamptz)
             RETURNING id, name, email, email_verified_at, role`,
            [id, name, email.toLowerCase(), googleId,
             adminEmails().includes(email.toLowerCase()) ? "ADMIN" : "USER",
             timestamp, timestamp],
          );
          return inserted.rows[0] as UserRow;
        });
        user = await reconcileAdminRole(newUser);
      }

      return { ...user, token: signToken(user.id) };
    },
  },

  logout: {
    auth: false,
    spec: { tokens: { type: "STRINGARRAY", min_length: 1 } },
    run: async ({ payload }) => ({ revoked: await revokeTokens(payload.tokens as string[]) }),
  },

  me: {
    auth: true,
    // Reconciled here too: the admin console reads `me`, so a session that was already open when
    // ADMIN_EMAILS changed does not have to be signed out and back in for it to take effect.
    run: async ({ userId }) => reconcileAdminRole(await loadUser(userId)),
  },

  /* ------------------------------ Circles ----------------------------- */

  "create-circle": {
    auth: true,
    rateLimit: { limit: 20, windowSeconds: 60 },
    spec: {
      name: { type: "STRING", min_length: 2, max_length: 255 },
      contribution_amount: { type: "NUMBER", min: 1 },
      frequency: { type: "STRING", min_length: 4, max_length: 20 },
      max_members: { type: "NUMBER", min: 2, max: 50 },
      currency: { type: "STRING", min_length: 1, max_length: 10 },
      starts_at: { type: "STRING", max_length: 40, optional: true },
      visibility: { type: "STRING", max_length: 20, optional: true },
      description: { type: "STRING", max_length: 500, optional: true },
    },
    run: async ({ payload, userId }) => {
      // No verification gate

      const frequency = str(payload.frequency).toUpperCase();
      if (frequency !== "WEEKLY" && frequency !== "MONTHLY") {
        throw conflict('"frequency" must be WEEKLY or MONTHLY');
      }
      const startsAt = optionalFutureDate(payload.starts_at);
      const visibility = optionalVisibility(payload) ?? "PUBLIC";
      const description = optionalDescription(payload);
      const timestamp = now();

      return withTx(async (client) => {
        const circle = await client.query(
          `INSERT INTO _circles
             (id, name, owner_id, contribution_amount, frequency, max_members, currency,
              status, current_cycle, rules, starts_at, visibility, description,
              created_at, updated_at)
           VALUES ($1, $2, $3, $4::numeric, $5, $6::int, $7, 'PENDING', 0,
                   jsonb_build_object('grace_period_days', $8::int, 'late_fee', $9::numeric),
                   $10::timestamptz, $11, $12, $13::timestamptz, $13::timestamptz)
           RETURNING id, name, owner_id, status, current_cycle, max_members, contribution_amount,
                     frequency, currency, rules, starts_at, visibility, description, created_at`,
          [
            newId(), str(payload.name), userId, num(payload.contribution_amount), frequency,
            num(payload.max_members), str(payload.currency).toUpperCase(),
            rule(payload, "grace_period_days"), rule(payload, "late_fee"),
            startsAt, visibility, description, timestamp,
          ],
        );
        const created = circle.rows[0];

        // The owner is member #1 and takes payout position 1 until the order is changed.
        await client.query(
          `INSERT INTO _memberships
             (id, circle_id, user_id, role, payout_position, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'OWNER', 1, 'ACTIVE', $4::timestamptz, $4::timestamptz)`,
          [newId(), created.id, userId, timestamp],
        );
        await logActivity(client, created.id, userId, "CIRCLE_CREATED", "Circle created");
        return { ...created, members_count: 1, seats_left: Number(created.max_members) - 1 };
      });
    },
  },

  "start-circle": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);

      // NOTE (divergence): the same 2-member floor `maybeAutoStart` enforces. A rotation of one
      // is not a savings circle, and pressing the button must not do what the clock refuses to.
      // Safe as a pre-check: while a circle is PENDING nothing takes an ACTIVE membership away.
      const active = await query<{ active_members: string }>(
        `SELECT COUNT(*) AS active_members FROM _memberships
         WHERE circle_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
        [circleId],
      );
      if (Number(active[0].active_members) < 2) {
        throw conflict("A circle needs at least 2 members who have joined before it can start");
      }

      const result = await withTx(async (client) => {
        const updated = await client.query(
          `UPDATE _circles SET status = 'ACTIVE', current_cycle = 1, updated_at = $2::timestamptz
           WHERE id = $1 AND owner_id = $3 AND status = 'PENDING'
           RETURNING id, status, current_cycle`,
          [circleId, now(), userId],
        );
        if (!updated.rows.length) {
          throw forbidden("Only the owner can start this circle, and only while it is pending");
        }
        await logActivity(
          client, circleId, userId, "CIRCLE_STARTED", "Circle started - cycle 1 begins",
        );
        return updated.rows[0];
      });

      invalidateCircle(circleId);
      broadcast(circleId);
      return result;
    },
  },

  "list-my-circles": {
    auth: true,
    run: ({ userId }) =>
      query(
        `SELECT ${CIRCLE_COLUMNS}, ${CIRCLE_DERIVED}
         FROM _circles c
         JOIN _users o ON o.id = c.owner_id
         JOIN _memberships m ON m.circle_id = c.id
         WHERE m.user_id = $1 AND m.deleted_at IS NULL AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC`,
        [userId],
      ),
  },

  "get-circle": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);
      await maybeAutoStart(circleId);

      const rows = await query(
        `SELECT ${CIRCLE_COLUMNS}, ${CIRCLE_DERIVED},
                (SELECT r.status FROM _join_requests r
                 WHERE r.circle_id = c.id AND r.user_id = $2
                 ORDER BY r.created_at DESC LIMIT 1) AS my_request_status
         FROM _circles c
         JOIN _users o ON o.id = c.owner_id
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [circleId, userId],
      );
      if (!rows.length) throw notFound("Circle not found");
      return rows[0];
    },
  },

  "update-circle-rules": {
    auth: true,
    spec: {
      ...CIRCLE_ID,
      frequency: { type: "STRING", min_length: 4, max_length: 20 },
      contribution_amount: { type: "NUMBER", min: 1 },
      starts_at: { type: "STRING", max_length: 40, optional: true },
      visibility: { type: "STRING", max_length: 20, optional: true },
      description: { type: "STRING", max_length: 500, optional: true },
    },
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      // Absent keys keep their stored value; a present-but-empty key clears it.
      const setsStartsAt = "starts_at" in payload;
      const setsDescription = "description" in payload;

      const rows = await query(
        `UPDATE _circles
         SET frequency = $2, contribution_amount = $3::numeric,
             rules = jsonb_build_object('grace_period_days', $4::int, 'late_fee', $5::numeric),
             starts_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE starts_at END,
             visibility = COALESCE($8::varchar, visibility),
             description = CASE WHEN $9::boolean THEN $10::varchar ELSE description END,
             updated_at = $11::timestamptz
         WHERE id = $1 AND owner_id = $12 AND status = 'PENDING' AND deleted_at IS NULL
         RETURNING id, frequency, contribution_amount, rules, starts_at, visibility, description`,
        [
          circleId, str(payload.frequency).toUpperCase(), num(payload.contribution_amount),
          rule(payload, "grace_period_days"), rule(payload, "late_fee"),
          setsStartsAt, optionalFutureDate(payload.starts_at), optionalVisibility(payload),
          setsDescription, optionalDescription(payload), now(), userId,
        ],
      );
      if (!rows.length) {
        throw forbidden("Rules can only be changed by the owner while the circle is pending");
      }

      await withTx((client) =>
        logActivity(client, circleId, userId, "RULES_UPDATED", "Circle rules updated"),
      );
      invalidateCircle(circleId);
      broadcast(circleId);
      return rows[0];
    },
  },

  /* ----------------------------- Discovery ---------------------------- */

  "list-public-circles": {
    auth: true,
    spec: { search: { type: "STRING", max_length: 120, optional: true } },
    run: async ({ payload, userId }) => {
      const user = await loadUser(userId);
      const search = str(payload.search);

      return query(
        `SELECT ${CIRCLE_COLUMNS}, ${CIRCLE_DERIVED},
                (SELECT r.status FROM _join_requests r
                 WHERE r.circle_id = c.id AND r.user_id = $1
                 ORDER BY r.created_at DESC LIMIT 1) AS my_request_status
         FROM _circles c
         JOIN _users o ON o.id = c.owner_id
         WHERE c.deleted_at IS NULL AND c.visibility = 'PUBLIC' AND c.status = 'PENDING'
           AND (SELECT COUNT(*) FROM _memberships m
                WHERE m.circle_id = c.id AND m.deleted_at IS NULL) < c.max_members
           AND NOT EXISTS (SELECT 1 FROM _memberships m
                           WHERE m.circle_id = c.id AND m.user_id = $1
                             AND m.deleted_at IS NULL)
           AND NOT EXISTS (SELECT 1 FROM _invitations i
                           WHERE i.circle_id = c.id AND LOWER(i.email) = $2
                             AND i.status = 'PENDING' AND i.expires_at > now())
           AND ($3::text = '' OR c.name ILIKE '%' || $3::text || '%'
                             OR COALESCE(c.description, '') ILIKE '%' || $3::text || '%')
         ORDER BY c.starts_at ASC NULLS LAST, c.created_at DESC
         LIMIT 100`,
        [userId, user.email.toLowerCase(), search],
      );
    },
  },

  /* ---------------------------- Invitations --------------------------- */

  "invite-member": {
    auth: true,
    rateLimit: { limit: 30, windowSeconds: 60 },
    spec: { ...CIRCLE_ID, email: { type: "EMAIL", max_length: 255 } },
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      const email = str(payload.email).toLowerCase();

      const circle = await loadCircle(circleId);
      if (circle.owner_id !== userId) {
        throw forbidden("Only the owner can invite people to this circle");
      }
      if (circle.status !== "PENDING") {
        throw conflict("Invitations can only be sent before the circle starts");
      }
      // NOTE (divergence): the Sub0 endpoint doesn't cap membership at max_members. Enforced here.
      if (seatsLeft(circle) <= 0) throw conflict("This circle is already full");

      // An invitation is addressed to an EMAIL, so someone with no account can be invited.
      const existing = await query<{ id: string; status: string; deleted_at: string | null }>(
        `SELECT m.id, m.status, m.deleted_at
         FROM _memberships m
         JOIN _users u ON u.id = m.user_id
         WHERE m.circle_id = $1 AND LOWER(u.email) = $2`,
        [circleId, email],
      );
      const member = existing[0];
      if (member && !member.deleted_at && member.status !== "INVITED") {
        throw conflict("That person is already in this circle");
      }

      const invitee = await query<{ id: string }>(
        `SELECT id FROM _users WHERE LOWER(email) = $1 AND deleted_at IS NULL`,
        [email],
      );
      const inviter = await loadUser(userId);
      const token = newToken();
      const timestamp = now();

      const created = await withTx(async (client) => {
        // A dead invitation must not block a fresh one: the open-invitation index is partial.
        await client.query(
          `UPDATE _invitations SET status = 'EXPIRED'
           WHERE circle_id = $1 AND LOWER(email) = $2 AND status = 'PENDING'
             AND expires_at <= now()`,
          [circleId, email],
        );

        let invitation;
        try {
          invitation = await client.query(
            `INSERT INTO _invitations
               (id, circle_id, email, invited_by, token_hash, status, expires_at, created_at)
             VALUES ($1, $2, $3, $4, $5, 'PENDING', $6::timestamptz, $7::timestamptz)
             RETURNING ${INVITATION_FIELDS}`,
            [newId(), circleId, email, userId, sha256(token), inDays(INVITE_TTL_DAYS), timestamp],
          );
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw conflict("That address already has a pending invitation to this circle");
          }
          throw err;
        }

        // Someone who already has an account also gets the placeholder membership row.
        if (invitee.length) {
          if (member) {
            await client.query(
              `UPDATE _memberships
               SET status = 'INVITED', deleted_at = NULL, updated_at = $2::timestamptz
               WHERE id = $1`,
              [member.id, timestamp],
            );
          } else {
            await client.query(
              `INSERT INTO _memberships
                 (id, circle_id, user_id, role, payout_position, status, created_at, updated_at)
               VALUES ($1, $2, $3, 'MEMBER', 0, 'INVITED', $4::timestamptz, $4::timestamptz)`,
              [newId(), circleId, invitee[0].id, timestamp],
            );
          }
        }

        await logActivity(client, circleId, userId, "MEMBER_INVITED", `Member invited: ${email}`);
        return invitation.rows[0];
      });

      invalidateCircle(circleId);
      broadcast(circleId);
      const delivery = await emails.invitation(email, inviter.name, circle.name, token);

      return {
        ...created,
        circle_name: circle.name,
        inviter_name: inviter.name,
        ...fallbackLink("invite_url", `/invite/${token}`, delivery),
      };
    },
  },

  "list-invitations": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      const circle = await loadCircle(circleId);
      if (circle.owner_id !== userId && !(await isAdmin(userId))) {
        throw forbidden("Only the circle owner can see its invitations");
      }

      return query(
        `SELECT ${INVITATION_COLUMNS}, u.name AS inviter_name, $2::text AS circle_name
         FROM _invitations i
         JOIN _users u ON u.id = i.invited_by
         WHERE i.circle_id = $1
         ORDER BY (i.status = 'PENDING') DESC, i.created_at DESC`,
        [circleId, circle.name],
      );
    },
  },

  "my-invitations": {
    auth: true,
    run: async ({ userId }) => {
      const user = await loadUser(userId);
      return query(
        `SELECT ${INVITATION_COLUMNS}, c.name AS circle_name, u.name AS inviter_name,
                c.contribution_amount, c.currency, c.frequency, c.max_members
         FROM _invitations i
         JOIN _circles c ON c.id = i.circle_id
         JOIN _users u ON u.id = i.invited_by
         WHERE LOWER(i.email) = $1 AND i.status = 'PENDING' AND i.expires_at > now()
           AND c.deleted_at IS NULL
         ORDER BY i.created_at DESC`,
        [user.email.toLowerCase()],
      );
    },
  },

  "get-invitation": {
    auth: false,
    rateLimit: { limit: 30, windowSeconds: 60 },
    spec: TOKEN,
    run: async ({ payload }) => {
      const rows = await query<{
        id: string; status: string; expires_at: string; circle_id: string;
      }>(
        `SELECT ${INVITATION_COLUMNS}, c.name AS circle_name, c.contribution_amount, c.currency,
                c.frequency, c.max_members, c.status AS circle_status,
                GREATEST(c.max_members - (SELECT COUNT(*)::int FROM _memberships m
                  WHERE m.circle_id = c.id AND m.deleted_at IS NULL), 0) AS seats_left,
                u.name AS inviter_name
         FROM _invitations i
         JOIN _circles c ON c.id = i.circle_id
         JOIN _users u ON u.id = i.invited_by
         WHERE i.token_hash = $1 AND c.deleted_at IS NULL`,
        [sha256(str(payload.token))],
      );
      // Nothing beyond the circle's public shape is returned, and only to the token holder.
      if (!rows.length) throw notFound("That invitation link is not valid");
      const invitation = rows[0];

      if (invitation.status === "ACCEPTED") {
        throw conflict("That invitation has already been accepted — sign in to open the circle");
      }
      if (invitation.status === "DECLINED") throw conflict("That invitation was declined");
      if (invitation.status === "CANCELLED") {
        throw conflict("That invitation was cancelled by the circle owner");
      }
      if (
        invitation.status === "EXPIRED" ||
        new Date(invitation.expires_at).getTime() <= Date.now()
      ) {
        await query(
          `UPDATE _invitations SET status = 'EXPIRED' WHERE id = $1 AND status = 'PENDING'`,
          [invitation.id],
        );
        throw conflict("That invitation has expired — ask the owner to send a new one");
      }

      return invitation;
    },
  },

  "respond-invitation": {
    auth: true,
    rateLimit: { limit: 20, windowSeconds: 60 },
    spec: {
      token: { type: "STRING", min_length: 20, max_length: 255, optional: true },
      invitation_id: { type: "STRING", min_length: 1, max_length: 255, optional: true },
      action: { type: "STRING", min_length: 1, max_length: 20 },
    },
    run: async ({ payload, userId }) => {
      const action = choice(payload.action, ["ACCEPT", "DECLINE"] as const, "action");
      const token = str(payload.token);
      const invitationId = str(payload.invitation_id);
      if (!token && !invitationId) throw badRequest('"token" is required');

      // NOTE (divergence): the id is accepted alongside the emailed token so a signed-in user can
      // answer from their own invitation list. Both paths run the same email-equality check.
      const rows = await query<{
        id: string; circle_id: string; email: string; status: string; expires_at: string;
        circle_name: string; circle_status: string; max_members: number; members_count: string;
        owner_id: string; owner_name: string; owner_email: string;
      }>(
        `SELECT i.id, i.circle_id, i.email, i.status, i.expires_at,
                c.name AS circle_name, c.status AS circle_status, c.max_members, c.owner_id,
                o.name AS owner_name, o.email AS owner_email,
                (SELECT COUNT(*) FROM _memberships m
                 WHERE m.circle_id = c.id AND m.deleted_at IS NULL) AS members_count
         FROM _invitations i
         JOIN _circles c ON c.id = i.circle_id
         JOIN _users o ON o.id = c.owner_id
         WHERE ${token ? "i.token_hash" : "i.id"} = $1 AND c.deleted_at IS NULL`,
        [token ? sha256(token) : invitationId],
      );
      if (!rows.length) throw notFound("That invitation is not valid");
      const invitation = rows[0];

      const user = await loadUser(userId);
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw forbidden("That invitation was sent to a different email address");
      }
      if (invitation.status !== "PENDING") {
        throw conflict(`That invitation was already ${invitation.status.toLowerCase()}`);
      }
      if (new Date(invitation.expires_at).getTime() <= Date.now()) {
        throw conflict("That invitation has expired — ask the owner to send a new one");
      }

      const circleId = invitation.circle_id;
      const timestamp = now();

      if (action === "DECLINE") {
        const declined = await withTx(async (client) => {
          const updated = await client.query(
            `UPDATE _invitations SET status = 'DECLINED', responded_at = $2::timestamptz
             WHERE id = $1 AND status = 'PENDING'
             RETURNING ${INVITATION_FIELDS}`,
            [invitation.id, timestamp],
          );
          if (!updated.rows.length) throw conflict("That invitation was already answered");
          // Give the held seat back to the owner.
          await client.query(
            `UPDATE _memberships
             SET deleted_at = $3::timestamptz, updated_at = $3::timestamptz
             WHERE circle_id = $1 AND user_id = $2 AND status = 'INVITED' AND deleted_at IS NULL`,
            [circleId, userId, timestamp],
          );
          return updated.rows[0];
        });

        invalidateCircle(circleId);
        broadcast(circleId);
        return { ...declined, circle_name: invitation.circle_name };
      }

      // No verification gate
      if (invitation.circle_status !== "PENDING") {
        throw conflict("That circle has already started, so the invitation can no longer be taken");
      }
      // NOTE (divergence): the seat cap is re-checked on acceptance. An invited member already
      // holds their seat, so only a brand-new membership can be turned away.
      const held = await query(
        `SELECT 1 FROM _memberships
         WHERE circle_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [circleId, userId],
      );
      if (
        !held.length &&
        Number(invitation.members_count) >= Number(invitation.max_members)
      ) {
        throw conflict("That circle filled up before you accepted");
      }

      const accepted = await withTx(async (client) => {
        const updated = await client.query(
          `UPDATE _invitations SET status = 'ACCEPTED', responded_at = $2::timestamptz
           WHERE id = $1 AND status = 'PENDING'
           RETURNING ${INVITATION_FIELDS}`,
          [invitation.id, timestamp],
        );
        if (!updated.rows.length) throw conflict("That invitation was already answered");

        // Activate the placeholder if there is one, otherwise join outright at the end of the
        // rotation. `payout_position` is only assigned once, so an existing order is never moved.
        const activated = await client.query(
          `UPDATE _memberships
           SET status = 'ACTIVE', deleted_at = NULL, updated_at = $3::timestamptz,
               payout_position = CASE WHEN payout_position > 0 THEN payout_position
                 ELSE COALESCE((SELECT MAX(m.payout_position) FROM _memberships m
                                WHERE m.circle_id = $1 AND m.deleted_at IS NULL), 0) + 1 END
           WHERE circle_id = $1 AND user_id = $2
           RETURNING id`,
          [circleId, userId, timestamp],
        );
        if (!activated.rows.length) {
          await client.query(
            // $2 cast explicitly — same type-deduction trap as in respond-join-request.
            `INSERT INTO _memberships
               (id, circle_id, user_id, role, payout_position, status, created_at, updated_at)
             VALUES ($1, $2::varchar, $3, 'MEMBER',
                     COALESCE((SELECT MAX(m.payout_position) FROM _memberships m
                               WHERE m.circle_id = $2::varchar AND m.deleted_at IS NULL), 0) + 1,
                     'ACTIVE', $4::timestamptz, $4::timestamptz)`,
            [newId(), circleId, userId, timestamp],
          );
        }
        await logActivity(
          client, circleId, userId, "MEMBER_JOINED", `${user.name} accepted their invitation`,
        );
        return updated.rows[0];
      });

      invalidateCircle(circleId);
      broadcast(circleId);
      await emails.invitationAccepted(
        invitation.owner_email, invitation.owner_name, user.name, invitation.circle_name, circleId,
      );

      return { ...accepted, circle_name: invitation.circle_name };
    },
  },

  "cancel-invitation": {
    auth: true,
    spec: { invitation_id: { type: "STRING", min_length: 1, max_length: 255 } },
    run: async ({ payload, userId }) => {
      const rows = await query<{
        id: string; circle_id: string; email: string; status: string;
        owner_id: string; circle_name: string;
      }>(
        `SELECT i.id, i.circle_id, i.email, i.status, c.owner_id, c.name AS circle_name
         FROM _invitations i
         JOIN _circles c ON c.id = i.circle_id
         WHERE i.id = $1 AND c.deleted_at IS NULL`,
        [str(payload.invitation_id)],
      );
      if (!rows.length) throw notFound("Invitation not found");
      const invitation = rows[0];
      if (invitation.owner_id !== userId) {
        throw forbidden("Only the circle owner can cancel an invitation");
      }

      const timestamp = now();
      const cancelled = await withTx(async (client) => {
        const updated = await client.query(
          `UPDATE _invitations SET status = 'CANCELLED', responded_at = $2::timestamptz
           WHERE id = $1 AND status = 'PENDING'
           RETURNING ${INVITATION_FIELDS}`,
          [invitation.id, timestamp],
        );
        if (!updated.rows.length) throw conflict("Only a pending invitation can be cancelled");
        // Release the seat the placeholder membership was holding.
        await client.query(
          `UPDATE _memberships m
           SET deleted_at = $3::timestamptz, updated_at = $3::timestamptz
           WHERE m.circle_id = $1 AND m.status = 'INVITED' AND m.deleted_at IS NULL
             AND EXISTS (SELECT 1 FROM _users u
                         WHERE u.id = m.user_id AND LOWER(u.email) = $2)`,
          [invitation.circle_id, invitation.email.toLowerCase(), timestamp],
        );
        return updated.rows[0];
      });

      invalidateCircle(invitation.circle_id);
      broadcast(invitation.circle_id);
      return { ...cancelled, circle_name: invitation.circle_name };
    },
  },

  /* --------------------------- Join requests -------------------------- */

  "request-to-join": {
    auth: true,
    rateLimit: { limit: 10, windowSeconds: 60 },
    spec: { ...CIRCLE_ID, message: { type: "STRING", max_length: 500, optional: true } },
    run: async ({ payload, userId }) => {
      // No verification gate

      const circleId = str(payload.circle_id);
      const message = str(payload.message) || null;
      const circle = await loadCircle(circleId);

      if (circle.visibility !== "PUBLIC") {
        throw forbidden("That circle is private — you need an invitation to join it");
      }
      if (circle.status !== "PENDING") {
        throw conflict("That circle has already started, so it is not taking new members");
      }
      if (seatsLeft(circle) <= 0) throw conflict("That circle is already full");

      const membership = await query<{ status: string }>(
        `SELECT status FROM _memberships
         WHERE circle_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [circleId, userId],
      );
      if (membership.length) {
        throw conflict(
          membership[0].status === "INVITED"
            ? "You already have an invitation to that circle"
            : "You are already a member of that circle",
        );
      }

      const user = await loadUser(userId);
      const timestamp = now();

      const created = await withTx(async (client) => {
        let request;
        try {
          request = await client.query(
            `INSERT INTO _join_requests (id, circle_id, user_id, message, status, created_at)
             VALUES ($1, $2, $3, $4, 'PENDING', $5::timestamptz)
             RETURNING ${JOIN_REQUEST_FIELDS}`,
            [newId(), circleId, userId, message, timestamp],
          );
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw conflict("You already have a request waiting on that circle");
          }
          throw err;
        }
        await logActivity(
          client, circleId, userId, "JOIN_REQUESTED", `${user.name} asked to join`,
        );
        return request.rows[0];
      });

      broadcast(circleId);
      // There is no link to fall back on here, but the requester should not be told the owner
      // was notified when the message never left the building.
      const delivery = await emails.joinRequestReceived(
        circle.owner_email, circle.owner_name, user.name, user.email,
        circle.name, circleId, message,
      );

      return {
        ...created,
        circle_name: circle.name,
        name: user.name,
        email: user.email,
        notified: delivery.status === "SENT",
      };
    },
  },

  "list-join-requests": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertCircleStaff(
        circleId, userId, "Only the circle owner or a treasurer can see join requests",
      );

      return query(
        `SELECT ${JOIN_REQUEST_COLUMNS}, u.name, u.email, c.name AS circle_name
         FROM _join_requests r
         JOIN _users u ON u.id = r.user_id
         JOIN _circles c ON c.id = r.circle_id
         WHERE r.circle_id = $1
         ORDER BY (r.status = 'PENDING') DESC, r.created_at DESC`,
        [circleId],
      );
    },
  },

  "respond-join-request": {
    auth: true,
    spec: {
      request_id: { type: "STRING", min_length: 1, max_length: 255 },
      action: { type: "STRING", min_length: 1, max_length: 20 },
    },
    run: async ({ payload, userId }) => {
      const action = choice(payload.action, ["APPROVE", "REJECT"] as const, "action");
      const requestId = str(payload.request_id);

      const rows = await query<{
        id: string; circle_id: string; user_id: string; message: string | null; status: string;
        name: string; email: string; circle_name: string; circle_status: string;
        owner_id: string; max_members: number; members_count: string;
      }>(
        `SELECT r.id, r.circle_id, r.user_id, r.message, r.status,
                u.name, u.email,
                c.name AS circle_name, c.status AS circle_status, c.owner_id, c.max_members,
                (SELECT COUNT(*) FROM _memberships m
                 WHERE m.circle_id = c.id AND m.deleted_at IS NULL) AS members_count
         FROM _join_requests r
         JOIN _users u ON u.id = r.user_id
         JOIN _circles c ON c.id = r.circle_id
         WHERE r.id = $1 AND c.deleted_at IS NULL`,
        [requestId],
      );
      if (!rows.length) throw notFound("Join request not found");
      const request = rows[0];

      // The one write an ADMIN may make on someone else's circle: answering the queue.
      if (request.owner_id !== userId && !(await isAdmin(userId))) {
        throw forbidden("Only the circle owner can answer join requests");
      }
      if (request.status !== "PENDING") {
        throw conflict("That request has already been answered");
      }

      const circleId = request.circle_id;
      const timestamp = now();
      const approved = action === "APPROVE";

      if (approved) {
        if (request.circle_status !== "PENDING") {
          throw conflict("That circle has already started, so nobody else can be added");
        }
        if (Number(request.members_count) >= Number(request.max_members)) {
          throw conflict("That circle is already full");
        }
        const membership = await query(
          `SELECT 1 FROM _memberships
           WHERE circle_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
          [circleId, request.user_id],
        );
        if (membership.length) throw conflict("That person is already in this circle");
      }

      const decided = await withTx(async (client) => {
        const updated = await client.query(
          `UPDATE _join_requests
           SET status = $2, decided_by = $3, decided_at = $4::timestamptz
           WHERE id = $1 AND status = 'PENDING'
           RETURNING ${JOIN_REQUEST_FIELDS}`,
          [request.id, approved ? "APPROVED" : "REJECTED", userId, timestamp],
        );
        if (!updated.rows.length) throw conflict("That request has already been answered");

        if (approved) {
          // Newcomers go to the back of the rotation. A revived membership keeps its old slot.
          await client.query(
            // $2 is cast explicitly: it appears both as an inserted column and inside the
            // subquery, and Postgres otherwise deduces text in one place and varchar in the
            // other ("inconsistent types deduced for parameter $2").
            `INSERT INTO _memberships
               (id, circle_id, user_id, role, payout_position, status, created_at, updated_at)
             VALUES ($1, $2::varchar, $3, 'MEMBER',
                     COALESCE((SELECT MAX(m.payout_position) FROM _memberships m
                               WHERE m.circle_id = $2::varchar AND m.deleted_at IS NULL), 0) + 1,
                     'ACTIVE', $4::timestamptz, $4::timestamptz)
             ON CONFLICT (circle_id, user_id) DO UPDATE
               SET status = 'ACTIVE', deleted_at = NULL, updated_at = EXCLUDED.updated_at,
                   payout_position = CASE WHEN _memberships.payout_position > 0
                                          THEN _memberships.payout_position
                                          ELSE EXCLUDED.payout_position END`,
            [newId(), circleId, request.user_id, timestamp],
          );
          await logActivity(
            client, circleId, userId, "MEMBER_JOINED",
            `${request.name} joined via a join request`,
          );
        }
        return updated.rows[0];
      });

      if (approved) {
        invalidateCircle(circleId);
        broadcast(circleId);
      }
      const delivery = await emails.joinRequestDecided(
        request.email, request.name, request.circle_name, circleId, approved,
      );

      return {
        ...decided,
        circle_name: request.circle_name,
        name: request.name,
        email: request.email,
        notified: delivery.status === "SENT",
      };
    },
  },

  "my-join-requests": {
    auth: true,
    run: ({ userId }) =>
      query(
        `SELECT ${JOIN_REQUEST_COLUMNS}, c.name AS circle_name, u.name, u.email
         FROM _join_requests r
         JOIN _circles c ON c.id = r.circle_id
         JOIN _users u ON u.id = r.user_id
         WHERE r.user_id = $1 AND c.deleted_at IS NULL
         ORDER BY r.created_at DESC`,
        [userId],
      ),
  },

  "cancel-join-request": {
    auth: true,
    spec: { request_id: { type: "STRING", min_length: 1, max_length: 255 } },
    run: async ({ payload, userId }) => {
      const rows = await query(
        `WITH cancelled AS (
           UPDATE _join_requests
           SET status = 'CANCELLED', decided_at = $3::timestamptz
           WHERE id = $1 AND user_id = $2 AND status = 'PENDING'
           RETURNING id, circle_id, user_id, message, status, created_at, decided_at
         )
         SELECT r.id, r.circle_id, r.user_id, r.message, r.status, r.created_at, r.decided_at,
                c.name AS circle_name
         FROM cancelled r
         JOIN _circles c ON c.id = r.circle_id`,
        [str(payload.request_id), userId, now()],
      );
      if (!rows.length) {
        throw forbidden("You can only cancel your own request, and only while it is pending");
      }
      return rows[0];
    },
  },

  /* ------------------------------ Members ----------------------------- */

  "join-circle": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);

      const result = await withTx(async (client) => {
        const joined = await client.query(
          `UPDATE _memberships
           SET status = 'ACTIVE', updated_at = $3::timestamptz,
               payout_position = CASE WHEN payout_position > 0 THEN payout_position
                 ELSE COALESCE((SELECT MAX(m.payout_position) FROM _memberships m
                                WHERE m.circle_id = $1 AND m.deleted_at IS NULL), 0) + 1 END
           WHERE circle_id = $1 AND user_id = $2 AND status = 'INVITED' AND deleted_at IS NULL
           RETURNING id, circle_id, user_id, status, payout_position`,
          [circleId, userId, now()],
        );
        if (!joined.rows.length) throw notFound("You have no pending invite to this circle");

        // Close the invitation the placeholder came from, so it can't be replayed by link.
        await client.query(
          `UPDATE _invitations i SET status = 'ACCEPTED', responded_at = $3::timestamptz
           WHERE i.circle_id = $1 AND i.status = 'PENDING'
             AND EXISTS (SELECT 1 FROM _users u
                         WHERE u.id = $2 AND LOWER(u.email) = LOWER(i.email))`,
          [circleId, userId, now()],
        );
        await logActivity(
          client, circleId, userId, "MEMBER_JOINED", "A member joined the circle",
        );
        return joined.rows[0];
      });

      invalidateCircle(circleId);
      broadcast(circleId);
      return result;
    },
  },

  "list-members": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      const scope = await memberListScope(circleId, userId);
      return query(
        `SELECT m.id, m.user_id, u.name, u.email, m.role, m.payout_position, m.status
         FROM _memberships m
         JOIN _users u ON u.id = m.user_id
         WHERE m.circle_id = $1 AND m.deleted_at IS NULL
           AND ($2::text IS NULL OR m.user_id = $2::text)
         ORDER BY m.payout_position ASC, u.name ASC`,
        [circleId, scope],
      );
    },
  },

  "set-payout-order": {
    auth: true,
    spec: {
      ...CIRCLE_ID,
      user_id: { type: "STRING", min_length: 1, max_length: 255 },
      payout_position: { type: "NUMBER", min: 1, max: 50 },
    },
    run: async ({ payload, userId }) => {
      const rows = await query(
        `UPDATE _memberships SET payout_position = $3::int, updated_at = $4::timestamptz
         WHERE circle_id = $1 AND user_id = $2
           AND EXISTS (SELECT 1 FROM _circles
                       WHERE id = $1 AND owner_id = $5 AND status = 'PENDING')
         RETURNING id, user_id, payout_position`,
        [
          str(payload.circle_id), str(payload.user_id), num(payload.payout_position), now(), userId,
        ],
      );
      if (!rows.length) {
        throw forbidden("Only the owner can set the payout order, and only while pending");
      }
      return rows[0];
    },
  },

  /* --------------------------- Contributions -------------------------- */

  "record-contribution": {
    auth: true,
    rateLimit: { limit: 30, windowSeconds: 60 },
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);

      // Chained action 1: the cycle and amount come from the circle, never from the client.
      const context = await query<{ current_cycle: number; contribution_amount: number }>(
        `SELECT c.current_cycle, c.contribution_amount
         FROM _circles c
         JOIN _memberships m ON m.circle_id = c.id
         WHERE c.id = $1 AND m.user_id = $2 AND m.status = 'ACTIVE' AND c.status = 'ACTIVE'
           AND m.deleted_at IS NULL AND c.deleted_at IS NULL`,
        [circleId, userId],
      );
      if (!context.length) {
        throw forbidden("You can only contribute to an active circle you actively belong to");
      }

      const result = await withTx(async (client) => {
        let contribution;
        try {
          contribution = await client.query(
            `INSERT INTO _contributions
               (id, circle_id, user_id, cycle, amount, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4::int, $5::numeric, 'PENDING', $6::timestamptz, $6::timestamptz)
             RETURNING id, cycle, amount, status`,
            [
              newId(), circleId, userId, context[0].current_cycle,
              context[0].contribution_amount, now(),
            ],
          );
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw conflict("You have already recorded a contribution for this cycle");
          }
          throw err;
        }
        await logActivity(
          client, circleId, userId, "CONTRIBUTION_RECORDED",
          "Contribution recorded (pending confirmation)",
        );
        return contribution.rows[0];
      });

      invalidateCircle(circleId);
      broadcast(circleId);
      return result;
    },
  },

  "confirm-contribution": {
    auth: true,
    spec: { contribution_id: { type: "STRING", min_length: 1, max_length: 255 } },
    run: async ({ payload, userId }) => {
      const result = await withTx(async (client) => {
        // RBAC lives in the statement: you must be OWNER or TREASURER *of that circle*.
        const confirmed = await client.query(
          `UPDATE _contributions
           SET status = 'CONFIRMED', confirmed_by = $2, updated_at = $3::timestamptz
           WHERE id = $1 AND status = 'PENDING'
             AND EXISTS (SELECT 1 FROM _memberships m
                         WHERE m.circle_id = _contributions.circle_id AND m.user_id = $2
                           AND m.role IN ('OWNER', 'TREASURER') AND m.deleted_at IS NULL)
           RETURNING id, circle_id, status`,
          [str(payload.contribution_id), userId, now()],
        );
        if (!confirmed.rows.length) {
          throw forbidden(
            "Only the owner or a treasurer can confirm, and only a pending contribution",
          );
        }
        const row = confirmed.rows[0];
        await logActivity(
          client, row.circle_id, userId, "CONTRIBUTION_CONFIRMED", "Contribution confirmed",
        );
        return row;
      });

      invalidateCircle(result.circle_id);
      broadcast(result.circle_id);
      return result;
    },
  },

  "list-contributions": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);
      return query(
        `SELECT ct.id, ct.user_id, u.name, ct.cycle, ct.amount, ct.status, ct.confirmed_by,
                ct.created_at
         FROM _contributions ct
         JOIN _users u ON u.id = ct.user_id
         WHERE ct.circle_id = $1 AND ct.deleted_at IS NULL
         ORDER BY ct.cycle DESC, ct.created_at DESC`,
        [circleId],
      );
    },
  },

  /* ------------------------------ Payouts ----------------------------- */

  "record-payout": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);

      const circles = await query<{ current_cycle: number }>(
        `SELECT current_cycle FROM _circles
         WHERE id = $1 AND owner_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
        [circleId, userId],
      );
      if (!circles.length) {
        throw forbidden("Only the owner can record a payout, and only while the circle is active");
      }

      const target = await query<{ recipient_id: string; cycle: number; amount: string }>(
        `SELECT m.user_id AS recipient_id, c.current_cycle AS cycle,
                COALESCE((SELECT SUM(ct.amount) FROM _contributions ct
                          WHERE ct.circle_id = c.id AND ct.cycle = c.current_cycle
                            AND ct.status = 'CONFIRMED'), 0) AS amount
         FROM _circles c
         JOIN _memberships m ON m.circle_id = c.id AND m.payout_position = c.current_cycle
         WHERE c.id = $1 AND c.owner_id = $2 AND c.status = 'ACTIVE' AND m.deleted_at IS NULL`,
        [circleId, userId],
      );
      if (!target.length) {
        throw notFound(
          `No member holds payout position ${circles[0].current_cycle} — set the payout order first`,
        );
      }

      const result = await withTx(async (client) => {
        let payout;
        try {
          payout = await client.query(
            `INSERT INTO _payouts
               (id, circle_id, cycle, recipient_id, amount, status, recorded_by,
                created_at, updated_at)
             VALUES ($1, $2, $3::int, $4, $5::numeric, 'PAID', $6, $7::timestamptz, $7::timestamptz)
             RETURNING id, recipient_id, amount, cycle, status`,
            [
              newId(), circleId, target[0].cycle, target[0].recipient_id,
              Number(target[0].amount), userId, now(),
            ],
          );
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw conflict("This cycle has already been paid out");
          }
          throw err;
        }

        // Advance the cycle; the circle completes once everyone has been paid.
        await client.query(
          `UPDATE _circles
           SET current_cycle = current_cycle + 1,
               status = CASE WHEN current_cycle + 1 > max_members THEN 'COMPLETED' ELSE 'ACTIVE' END,
               updated_at = $2::timestamptz
           WHERE id = $1`,
          [circleId, now()],
        );
        await logActivity(
          client, circleId, userId, "PAYOUT_RECORDED", "Payout recorded for this cycle",
        );
        return payout.rows[0];
      });

      invalidateCircle(circleId);
      broadcast(circleId);
      return result;
    },
  },

  "confirm-payout-received": {
    auth: true,
    spec: { payout_id: { type: "STRING", min_length: 1, max_length: 255 } },
    run: async ({ payload, userId }) => {
      const result = await withTx(async (client) => {
        const confirmed = await client.query(
          `UPDATE _payouts SET status = 'RECEIVED', updated_at = $3::timestamptz
           WHERE id = $1 AND recipient_id = $2 AND status = 'PAID'
           RETURNING id, circle_id, status`,
          [str(payload.payout_id), userId, now()],
        );
        if (!confirmed.rows.length) {
          throw forbidden("Only the recipient can confirm this payout, and only once");
        }
        const row = confirmed.rows[0];
        await logActivity(
          client, row.circle_id, userId, "PAYOUT_CONFIRMED",
          "Recipient confirmed payout received",
        );
        return row;
      });

      invalidateCircle(result.circle_id);
      broadcast(result.circle_id);
      return result;
    },
  },

  "list-payouts": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);
      return query(
        `SELECT p.id, p.cycle, p.recipient_id, u.name AS recipient_name, p.amount, p.status,
                p.recorded_by, p.created_at
         FROM _payouts p
         JOIN _users u ON u.id = p.recipient_id
         WHERE p.circle_id = $1
         ORDER BY p.cycle DESC`,
        [circleId],
      );
    },
  },

  /* ------------------------------- Admin ------------------------------ */

  "admin-overview": {
    auth: true,
    run: async ({ userId }) => {
      await assertAdmin(userId);
      const rows = await query(
        `SELECT
           (SELECT COUNT(*)::int FROM _users WHERE deleted_at IS NULL) AS users,
           (SELECT COUNT(*)::int FROM _users
           (SELECT COUNT(*)::int FROM _circles WHERE deleted_at IS NULL) AS circles,
           (SELECT COUNT(*)::int FROM _circles
            WHERE deleted_at IS NULL AND status = 'ACTIVE') AS active_circles,
           (SELECT COUNT(*)::int FROM _circles
            WHERE deleted_at IS NULL AND status = 'COMPLETED') AS completed_circles,
           (SELECT COUNT(*)::int FROM _contributions
            WHERE deleted_at IS NULL AND status = 'CONFIRMED') AS total_confirmed,
           (SELECT COALESCE(SUM(amount), 0) FROM _contributions
            WHERE deleted_at IS NULL AND status = 'CONFIRMED') AS total_saved,
           (SELECT COUNT(*)::int FROM _join_requests WHERE status = 'PENDING')
             AS pending_join_requests,
           (SELECT COUNT(*)::int FROM _invitations
            WHERE status = 'PENDING' AND expires_at > now()) AS pending_invitations,
           (SELECT COUNT(*)::int FROM _emails WHERE status = 'SENT') AS emails_sent,
           (SELECT COUNT(*)::int FROM _emails WHERE status = 'FAILED') AS emails_failed`,
      );
      return rows[0];
    },
  },

  "admin-list-circles": {
    auth: true,
    run: async ({ userId }) => {
      await assertAdmin(userId);
      return query(
        `SELECT c.id, c.name, o.name AS owner_name, o.email AS owner_email, c.status,
                c.visibility, c.current_cycle, c.max_members,
                (SELECT COUNT(*)::int FROM _memberships m
                 WHERE m.circle_id = c.id AND m.deleted_at IS NULL) AS members_count,
                c.contribution_amount, c.currency,
                (SELECT COUNT(*)::int FROM _contributions t
                 WHERE t.circle_id = c.id AND t.status = 'CONFIRMED' AND t.deleted_at IS NULL)
                  AS confirmed_contributions,
                (SELECT COUNT(*)::int FROM _contributions t
                 WHERE t.circle_id = c.id AND t.status = 'PENDING' AND t.deleted_at IS NULL)
                  AS pending_contributions,
                (SELECT COALESCE(SUM(t.amount), 0) FROM _contributions t
                 WHERE t.circle_id = c.id AND t.status = 'CONFIRMED' AND t.deleted_at IS NULL)
                  AS total_saved,
                (SELECT COUNT(*)::int FROM _payouts p WHERE p.circle_id = c.id) AS payouts_count,
                c.starts_at, c.created_at
         FROM _circles c
         JOIN _users o ON o.id = c.owner_id
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC`,
      );
    },
  },

  "admin-list-users": {
    auth: true,
    run: async ({ userId }) => {
      await assertAdmin(userId);
      return query(
        `SELECT u.id, u.name, u.email, u.role,
                (SELECT COUNT(*)::int FROM _memberships m
                 WHERE m.user_id = u.id AND m.deleted_at IS NULL) AS circles_count,
                u.created_at
         FROM _users u
         WHERE u.deleted_at IS NULL
         ORDER BY u.created_at DESC`,
      );
    },
  },

  "admin-list-emails": {
    auth: true,
    run: async ({ userId }) => {
      await assertAdmin(userId);
      return query(
        `SELECT id, to_email, subject, template, body, status, error, created_at
         FROM _emails
         ORDER BY created_at DESC
         LIMIT 200`,
      );
    },
  },

  /* ---------------------- Dashboard / Scores -------------------------- */

  "get-dashboard": {
    auth: true,
    spec: CIRCLE_ID,
    // Deliberately uncached: this is the number members watch during a cycle.
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);
      await maybeAutoStart(circleId);

      const rows = await query(
        `SELECT c.id, c.name, c.status, c.current_cycle, c.max_members, c.contribution_amount,
                c.currency, c.starts_at,
                COALESCE((SELECT SUM(ct.amount) FROM _contributions ct
                          WHERE ct.circle_id = c.id AND ct.cycle = c.current_cycle
                            AND ct.status = 'CONFIRMED'), 0) AS pot,
                (SELECT COUNT(*) FROM _contributions ct
                 WHERE ct.circle_id = c.id AND ct.cycle = c.current_cycle
                   AND ct.status = 'CONFIRMED') AS members_paid,
                (SELECT COUNT(*) FROM _memberships m
                 WHERE m.circle_id = c.id AND m.status = 'ACTIVE'
                   AND m.deleted_at IS NULL) AS total_members,
                (SELECT u.name FROM _memberships m
                 JOIN _users u ON u.id = m.user_id
                 WHERE m.circle_id = c.id AND m.payout_position = c.current_cycle
                 LIMIT 1) AS next_recipient,
                ROUND((GREATEST(c.current_cycle - 1, 0)::numeric
                       / NULLIF(c.max_members, 0)) * 100, 0) AS completion_pct
         FROM _circles c
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [circleId],
      );
      if (!rows.length) throw notFound("Circle not found");
      return rows[0];
    },
  },

  "get-insights": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);

      return cached(`insights_${circleId}`, 60, async () => {
        const rows = await query(
          `SELECT
             (SELECT u.name FROM _contributions ct
              JOIN _users u ON u.id = ct.user_id
              WHERE ct.circle_id = $1 AND ct.status = 'CONFIRMED'
              GROUP BY u.name ORDER BY COUNT(*) DESC LIMIT 1) AS most_reliable_member,
             (SELECT COALESCE(SUM(amount), 0) FROM _contributions
              WHERE circle_id = $1 AND status = 'CONFIRMED') AS total_savings,
             (SELECT COUNT(*) FROM _contributions
              WHERE circle_id = $1 AND status = 'CONFIRMED') AS total_confirmed,
             (SELECT u.name FROM _memberships m
              JOIN _users u ON u.id = m.user_id
              JOIN _circles c ON c.id = m.circle_id
              WHERE m.circle_id = $1 AND m.payout_position = c.current_cycle
              LIMIT 1) AS next_payout_member,
             (SELECT ROUND(AVG(cnt), 1) FROM (
                SELECT COUNT(*) AS cnt FROM _contributions
                WHERE circle_id = $1 AND status = 'CONFIRMED' GROUP BY cycle) s
             ) AS avg_confirmed_per_cycle`,
          [circleId],
        );
        return rows[0];
      });
    },
  },

  "get-trust-score": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);

      return cached(`trust_score_${circleId}`, 60, () =>
        query(
          `SELECT m.user_id, u.name,
                  COALESCE(SUM(CASE WHEN ct.status = 'CONFIRMED' THEN ct.amount ELSE 0 END), 0)
                    AS total_contributed,
                  COUNT(ct.id) FILTER (WHERE ct.status = 'CONFIRMED') AS confirmed_count,
                  COUNT(ct.id) FILTER (WHERE ct.status = 'PENDING')   AS pending_count,
                  CASE WHEN GREATEST(c.current_cycle - 1, 0) = 0 THEN 100
                       ELSE ROUND((COUNT(ct.id) FILTER (WHERE ct.status = 'CONFIRMED')::numeric
                                   / GREATEST(c.current_cycle - 1, 1)) * 100, 0)
                  END AS reliability_pct
           FROM _memberships m
           JOIN _users u ON u.id = m.user_id
           JOIN _circles c ON c.id = m.circle_id
           LEFT JOIN _contributions ct
                  ON ct.circle_id = m.circle_id AND ct.user_id = m.user_id
           WHERE m.circle_id = $1 AND m.status = 'ACTIVE' AND m.deleted_at IS NULL
           GROUP BY m.user_id, u.name, c.current_cycle
           ORDER BY reliability_pct DESC`,
          [circleId],
        ),
      );
    },
  },

  "get-circle-health": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);

      return cached(`circle_health_${circleId}`, 60, async () => {
        const rows = await query(
          `WITH base AS (
             SELECT c.id, c.name, c.status, c.current_cycle, c.max_members,
                    (SELECT COUNT(*) FROM _memberships m
                     WHERE m.circle_id = c.id AND m.status = 'ACTIVE'
                       AND m.deleted_at IS NULL) AS active_members,
                    (SELECT COUNT(*) FROM _contributions ct
                     WHERE ct.circle_id = c.id AND ct.status = 'CONFIRMED')
                      AS confirmed_contributions,
                    (SELECT COUNT(*) FROM _contributions ct
                     WHERE ct.circle_id = c.id AND ct.status = 'PENDING')
                      AS pending_contributions,
                    (SELECT COUNT(*) FROM _payouts p
                     WHERE p.circle_id = c.id AND p.status = 'RECEIVED') AS payouts_received
             FROM _circles c WHERE c.id = $1
           )
           SELECT id, name, status, current_cycle, max_members, active_members,
                  confirmed_contributions, pending_contributions, payouts_received,
                  ROUND(LEAST(100, (confirmed_contributions::numeric
                    / NULLIF(active_members * GREATEST(current_cycle - 1, 1), 0)) * 100), 0)
                    AS health_pct
           FROM base`,
          [circleId],
        );
        if (!rows.length) throw notFound("Circle not found");
        return rows[0];
      });
    },
  },

  "list-activity": {
    auth: true,
    spec: CIRCLE_ID,
    run: async ({ payload, userId }) => {
      const circleId = str(payload.circle_id);
      await assertMember(circleId, userId);
      return query(
        `SELECT a.id, a.actor_id, u.name AS actor_name, a.type, a.message, a.metadata, a.created_at
         FROM _activity a
         LEFT JOIN _users u ON u.id = a.actor_id
         WHERE a.circle_id = $1
         ORDER BY a.created_at DESC
         LIMIT 100`,
        [circleId],
      );
    },
  },
};

export const resourceNames = Object.keys(resources);
