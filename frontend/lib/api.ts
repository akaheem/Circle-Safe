import { getSession, getToken } from "./auth";
import type {
  ActivityItem, AdminCircleRow, AdminOverview, AdminUserRow, Circle, CircleHealth, Contribution,
  DashboardData, EmailRecord, Insights, Invitation, JoinRequest, Member, Payout, TrustScoreRow, User,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Which backend the app talks to. Every mode speaks the same resource contract.
 * - `sub0`  — a deployed Sub0 instance (`NEXT_PUBLIC_API_URL` set). The hackathon target.
 * - `local` — the self-hosted runtime in this app (`NEXT_PUBLIC_LOCAL_API=true`),
 *             i.e. `app/api/[resource]` executing the same SQL against Postgres.
 * - `mock`  — no backend at all: an in-memory demo circle so the whole UI is clickable.
 */
export type ApiMode = "sub0" | "local" | "mock";

export const API_MODE: ApiMode = API_URL
  ? "sub0"
  : process.env.NEXT_PUBLIC_LOCAL_API === "true"
    ? "local"
    : "mock";

export const USE_MOCK = API_MODE === "mock";

/**
 * Calls a backend resource by name.
 * `sub0`  → POST `${API_URL}/${resource}`; `local` → POST `/api/${resource}`.
 * Both take the JSON payload + Bearer token; `mock` runs the in-memory flow instead.
 * NOTE: adjust the response unwrap (data shape) once the live Sub0 response format is confirmed.
 */
async function call<T>(resource: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (USE_MOCK) return mock<T>(resource, payload);

  const token = getToken();
  const res = await fetch(API_MODE === "sub0" ? `${API_URL}/${resource}` : `/api/${resource}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/* ------------------------------- Auth ------------------------------- */
export const signUp = (p: { name: string; email: string; password: string }) =>
  call<User>("sign-up", p);
export const signIn = (p: { email: string; password: string }) =>
  call<User>("sign-in", p);
export const logout = (token: string) => call<unknown>("logout", { tokens: [token] });
/** The signed-in user, including verification state and platform role. */
export const me = () => call<User>("me");
export const verifyEmail = (token: string) =>
  call<{ verified: boolean; email: string }>("verify-email", { token });
export const resendVerification = () => call<{ sent: boolean }>("resend-verification");

/* ------------------------------ Circles ----------------------------- */
export const createCircle = (p: Partial<Circle>) => call<Circle>("create-circle", p);
export const startCircle = (circle_id: string) => call<Circle>("start-circle", { circle_id });
export const listMyCircles = () => call<Circle[]>("list-my-circles");
export const getCircle = (circle_id: string) => call<Circle>("get-circle", { circle_id });
export const updateCircleRules = (p: Partial<Circle> & { circle_id: string }) =>
  call<Circle>("update-circle-rules", p);

/* ------------------------------ Members ----------------------------- */
/** Invites by email address — the recipient does not need an account yet. */
export const inviteMember = (p: { circle_id: string; email: string }) =>
  call<Invitation & { invite_url?: string }>("invite-member", p);
export const joinCircle = (circle_id: string) => call<Member>("join-circle", { circle_id });
export const listMembers = (circle_id: string) => call<Member[]>("list-members", { circle_id });
export const setPayoutOrder = (p: { circle_id: string; user_id: string; payout_position: number }) =>
  call<Member>("set-payout-order", p);

/* --------------------------- Contributions -------------------------- */
export const recordContribution = (circle_id: string) =>
  call<Contribution>("record-contribution", { circle_id });
export const confirmContribution = (contribution_id: string) =>
  call<Contribution>("confirm-contribution", { contribution_id });
export const listContributions = (circle_id: string) =>
  call<Contribution[]>("list-contributions", { circle_id });

/* ------------------------------ Payouts ----------------------------- */
export const recordPayout = (circle_id: string) => call<Payout>("record-payout", { circle_id });
export const confirmPayoutReceived = (payout_id: string) =>
  call<Payout>("confirm-payout-received", { payout_id });
export const listPayouts = (circle_id: string) => call<Payout[]>("list-payouts", { circle_id });

/* --------------------------- Discovery ------------------------------ */
/** Public circles with seats left that haven't started yet. */
export const listPublicCircles = (search?: string) =>
  call<Circle[]>("list-public-circles", { search: search ?? "" });

/* ------------------------- Join requests ---------------------------- */
export const requestToJoin = (p: { circle_id: string; message?: string }) =>
  call<JoinRequest>("request-to-join", p);
export const listJoinRequests = (circle_id: string) =>
  call<JoinRequest[]>("list-join-requests", { circle_id });
export const respondJoinRequest = (p: { request_id: string; action: "APPROVE" | "REJECT" }) =>
  call<JoinRequest>("respond-join-request", p);
export const myJoinRequests = () => call<JoinRequest[]>("my-join-requests");
export const cancelJoinRequest = (request_id: string) =>
  call<JoinRequest>("cancel-join-request", { request_id });

/* -------------------------- Invitations ----------------------------- */
export const listInvitations = (circle_id: string) =>
  call<Invitation[]>("list-invitations", { circle_id });
export const myInvitations = () => call<Invitation[]>("my-invitations");
/** Public: look up an invitation by its emailed token. */
export const getInvitation = (token: string) => call<Invitation>("get-invitation", { token });
export const respondInvitation = (p: { token: string; action: "ACCEPT" | "DECLINE" }) =>
  call<Invitation>("respond-invitation", p);
export const cancelInvitation = (invitation_id: string) =>
  call<Invitation>("cancel-invitation", { invitation_id });

/* ------------------------------ Admin ------------------------------- */
export const adminOverview = () => call<AdminOverview>("admin-overview");
export const adminListCircles = () => call<AdminCircleRow[]>("admin-list-circles");
export const adminListUsers = () => call<AdminUserRow[]>("admin-list-users");
export const adminListEmails = () => call<EmailRecord[]>("admin-list-emails");

/* ---------------------- Dashboard / Scores -------------------------- */
export const getDashboard = (circle_id: string) => call<DashboardData>("get-dashboard", { circle_id });
export const getInsights = (circle_id: string) => call<Insights>("get-insights", { circle_id });
export const getTrustScore = (circle_id: string) => call<TrustScoreRow[]>("get-trust-score", { circle_id });
export const getCircleHealth = (circle_id: string) => call<CircleHealth>("get-circle-health", { circle_id });
export const listActivity = (circle_id: string) => call<ActivityItem[]>("list-activity", { circle_id });

/* =============================== MOCK ===============================
 * A small in-memory database so the UI is fully clickable in demo mode.
 * The seeded demo user is u1 (Amara Okafor), OWNER of circle c1.
 * None of this is a security boundary — it is one browser tab — but it enforces the same
 * rules as `lib/server/resources.ts`, so clicking around the demo never teaches anything
 * the real runtimes would not do.
 * ==================================================================== */

export const MOCK_USER_ID = "u1";

/** One password for every seeded persona: a demo nobody can sign into is no demo at all. */
const DEMO_PASSWORD = "demo1234";

/** Surfaced on the sign-in page, because mock now really does check what you type. */
export const MOCK_LOGIN = { email: "amara@example.com", password: DEMO_PASSWORD };

/**
 * The seeded demo persona, and the only ADMIN in the mock, so the admin console stays
 * explorable without a backend. Everybody else — including any account signed up in the
 * browser — is a plain USER and is turned away by the admin resources.
 */
const MOCK_ME: User = {
  id: MOCK_USER_ID, name: "Amara Okafor", email: "amara@example.com",
  email_verified_at: "2026-05-01T09:00:00Z", role: "ADMIN",
};

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const db = {
  circles: [
    {
      id: "c1", name: "Lagos Traders Circle", owner_id: "u1", contribution_amount: 5000,
      frequency: "WEEKLY", max_members: 4, currency: "NGN", status: "ACTIVE", current_cycle: 3,
      rules: { grace_period_days: 3, late_fee: 500 }, created_at: "2026-05-01T09:00:00Z",
      visibility: "PUBLIC", starts_at: null,
      description: "Market traders on Balogun Street pooling weekly stock money.",
    },
    {
      id: "c2", name: "Campus Savers", owner_id: "u1", contribution_amount: 2000,
      frequency: "MONTHLY", max_members: 6, currency: "NGN", status: "PENDING", current_cycle: 0,
      rules: { grace_period_days: 5, late_fee: 200 }, created_at: "2026-07-10T09:00:00Z",
      visibility: "PUBLIC", starts_at: inDays(9),
      description: "Final-year students saving for project fees.",
    },
    // Circles owned by other people — these are what discovery is for.
    {
      id: "c3", name: "Tailors Co-op", owner_id: "u9", contribution_amount: 3000,
      frequency: "WEEKLY", max_members: 8, currency: "NGN", status: "PENDING", current_cycle: 0,
      rules: { grace_period_days: 2, late_fee: 300 }, created_at: "2026-07-18T09:00:00Z",
      visibility: "PUBLIC", starts_at: inDays(4),
      description: "Tailors on Adeniran Ogunsanya saving for fabric bulk-buys.",
    },
    {
      id: "c4", name: "Keke Riders Union", owner_id: "u9", contribution_amount: 1500,
      frequency: "WEEKLY", max_members: 10, currency: "NGN", status: "PENDING", current_cycle: 0,
      rules: { grace_period_days: 3, late_fee: 100 }, created_at: "2026-07-22T09:00:00Z",
      visibility: "PUBLIC", starts_at: inDays(12),
      description: "Tricycle riders saving towards maintenance and spare parts.",
    },
  ] as Circle[],

  users: [
    { ...MOCK_ME, created_at: "2026-04-20T09:00:00Z" },
    { id: "u2", name: "John Mensah", email: "john@example.com", role: "USER", email_verified_at: "2026-05-02T09:00:00Z", created_at: "2026-05-02T09:00:00Z" },
    { id: "u3", name: "Sarah Bello", email: "sarah@example.com", role: "USER", email_verified_at: "2026-05-03T09:00:00Z", created_at: "2026-05-03T09:00:00Z" },
    { id: "u4", name: "David Nwosu", email: "david@example.com", role: "USER", email_verified_at: null, created_at: "2026-05-04T09:00:00Z" },
    { id: "u9", name: "Ngozi Eze", email: "ngozi@example.com", role: "USER", email_verified_at: "2026-06-01T09:00:00Z", created_at: "2026-06-01T09:00:00Z" },
  ] as (User & { created_at: string })[],

  /**
   * Sign-in credentials, keyed by lower-cased email. Plain text on purpose: this is an
   * in-memory demo store living in one browser tab and thrown away on reload, and there is no
   * server here to hash against. The `local` and `sub0` runtimes keep a bcrypt hash instead and
   * never see the password. Every seeded login uses `demo1234`:
   *   amara@example.com  — the ADMIN persona, OWNER of Lagos Traders Circle and Campus Savers
   *   john@example.com / sarah@example.com / david@example.com / ngozi@example.com — plain USERs
   */
  passwords: {
    "amara@example.com": DEMO_PASSWORD,
    "john@example.com": DEMO_PASSWORD,
    "sarah@example.com": DEMO_PASSWORD,
    "david@example.com": DEMO_PASSWORD,
    "ngozi@example.com": DEMO_PASSWORD,
  } as Record<string, string>,

  invitations: [
    {
      id: "i1", circle_id: "c2", circle_name: "Campus Savers", email: "tunde@example.com",
      invited_by: "u1", inviter_name: "Amara Okafor", status: "PENDING",
      created_at: "2026-07-24T09:00:00Z", expires_at: inDays(11),
    },
  ] as Invitation[],

  /** Invite token → invitation id. The real runtimes store only a SHA-256 hash of the token. */
  inviteTokens: { "demo-token": "i1" } as Record<string, string>,

  joinRequests: [
    {
      id: "j1", circle_id: "c2", circle_name: "Campus Savers", user_id: "u4", name: "David Nwosu",
      email: "david@example.com", message: "I save every month without fail — happy to go last.",
      status: "PENDING", created_at: "2026-07-25T09:00:00Z",
    },
  ] as JoinRequest[],

  emails: [
    {
      id: "e1", to_email: "tunde@example.com", subject: 'Amara Okafor invited you to the "Campus Savers" savings circle',
      template: "INVITATION", body: "View the invitation: http://localhost:3000/invite/demo-token",
      status: "LOGGED", created_at: "2026-07-24T09:00:00Z",
    },
  ] as EmailRecord[],

  members: {
    c1: [
      { id: "m1", user_id: "u1", name: "Amara Okafor", email: "amara@example.com", role: "OWNER", payout_position: 1, status: "ACTIVE" },
      { id: "m2", user_id: "u2", name: "John Mensah", email: "john@example.com", role: "TREASURER", payout_position: 2, status: "ACTIVE" },
      { id: "m3", user_id: "u3", name: "Sarah Bello", email: "sarah@example.com", role: "MEMBER", payout_position: 3, status: "ACTIVE" },
      { id: "m4", user_id: "u4", name: "David Nwosu", email: "david@example.com", role: "MEMBER", payout_position: 4, status: "ACTIVE" },
    ],
    c2: [
      { id: "m5", user_id: "u1", name: "Amara Okafor", email: "amara@example.com", role: "OWNER", payout_position: 1, status: "ACTIVE" },
    ],
  } as Record<string, Member[]>,

  contributions: {
    c1: [
      { id: "t1", user_id: "u1", name: "Amara Okafor", cycle: 1, amount: 5000, status: "CONFIRMED", created_at: "2026-06-01T10:00:00Z" },
      { id: "t2", user_id: "u2", name: "John Mensah", cycle: 1, amount: 5000, status: "CONFIRMED", created_at: "2026-06-01T11:00:00Z" },
      { id: "t3", user_id: "u3", name: "Sarah Bello", cycle: 1, amount: 5000, status: "CONFIRMED", created_at: "2026-06-02T09:00:00Z" },
      { id: "t4", user_id: "u4", name: "David Nwosu", cycle: 1, amount: 5000, status: "CONFIRMED", created_at: "2026-06-03T09:00:00Z" },
      { id: "t5", user_id: "u1", name: "Amara Okafor", cycle: 2, amount: 5000, status: "CONFIRMED", created_at: "2026-06-08T10:00:00Z" },
      { id: "t6", user_id: "u2", name: "John Mensah", cycle: 2, amount: 5000, status: "CONFIRMED", created_at: "2026-06-08T10:30:00Z" },
      { id: "t7", user_id: "u3", name: "Sarah Bello", cycle: 2, amount: 5000, status: "CONFIRMED", created_at: "2026-06-09T14:00:00Z" },
      { id: "t8", user_id: "u2", name: "John Mensah", cycle: 3, amount: 5000, status: "CONFIRMED", created_at: "2026-07-20T10:00:00Z" },
      { id: "t9", user_id: "u3", name: "Sarah Bello", cycle: 3, amount: 5000, status: "PENDING", created_at: "2026-07-21T08:00:00Z" },
    ],
    c2: [],
  } as Record<string, Contribution[]>,

  payouts: {
    c1: [
      { id: "p1", cycle: 1, recipient_id: "u1", recipient_name: "Amara Okafor", amount: 20000, status: "RECEIVED", recorded_by: "u1", created_at: "2026-06-05T12:00:00Z" },
      { id: "p2", cycle: 2, recipient_id: "u2", recipient_name: "John Mensah", amount: 15000, status: "PAID", recorded_by: "u1", created_at: "2026-06-12T12:00:00Z" },
    ],
    c2: [],
  } as Record<string, Payout[]>,

  activity: {
    c1: [
      { id: "a1", actor_id: "u2", actor_name: "John Mensah", type: "CONTRIBUTION_CONFIRMED", message: "Contribution confirmed", created_at: "2026-07-21T10:04:00Z" },
      { id: "a2", actor_id: "u1", actor_name: "Amara Okafor", type: "CONTRIBUTION_RECORDED", message: "Contribution recorded (pending confirmation)", created_at: "2026-07-21T10:02:00Z" },
      { id: "a3", actor_id: "u1", actor_name: "Amara Okafor", type: "PAYOUT_RECORDED", message: "Payout recorded for this cycle", created_at: "2026-06-12T12:00:00Z" },
      { id: "a4", actor_id: "u3", actor_name: "Sarah Bello", type: "MEMBER_JOINED", message: "A member joined the circle", created_at: "2026-05-19T08:00:00Z" },
      { id: "a5", actor_id: "u1", actor_name: "Amara Okafor", type: "CIRCLE_CREATED", message: "Circle created", created_at: "2026-05-01T09:00:00Z" },
    ],
    c2: [
      { id: "b1", actor_id: "u1", actor_name: "Amara Okafor", type: "CIRCLE_CREATED", message: "Circle created", created_at: "2026-07-10T09:00:00Z" },
    ],
  } as Record<string, ActivityItem[]>,
};

let seq = 100;
const nextId = (prefix: string) => `${prefix}${++seq}`;
const now = () => new Date().toISOString();

function circleOf(id: string): Circle {
  return db.circles.find((c) => c.id === id) ?? db.circles[0];
}

/**
 * Who the mock is acting as. The session in localStorage outlives this in-memory db — a reload
 * reseeds it — so an account signed up in this tab is re-registered from the session on the way
 * back in, always as a plain USER and never with whatever role the browser claims.
 */
function currentUser(): User {
  const session = getSession()?.user;
  if (!session) return MOCK_ME;
  const known = db.users.find(
    (u) => u.id === session.id || u.email.toLowerCase() === session.email.toLowerCase(),
  );
  if (known) return known;
  const restored = { ...session, role: "USER" as const, created_at: now() };
  db.users.push(restored);
  return restored;
}

/**
 * Mirrors assertMember() in lib/server/resources.ts, ADMIN bypass included: an admin reads any
 * circle so they can audit it. READ authorisation only — every write still checks the caller's
 * role in the circle itself.
 */
function assertMember(circleId: string): void {
  const user = currentUser();
  if ((db.members[circleId] ?? []).some((m) => m.user_id === user.id)) return;
  if (user.role === "ADMIN") return;
  throw new Error("You are not a member of this circle");
}

/** Mirrors assertAdmin() in lib/server/resources.ts. */
function assertAdmin(): void {
  if (currentUser().role !== "ADMIN") throw new Error("Administrator access only");
}

/** Newcomers go to the back of the rotation, so an existing order is never moved. */
const maxPosition = (members: Member[]) =>
  members.reduce((top, m) => Math.max(top, Number(m.payout_position)), 0);

/** Mirrors optionalFutureDate() in lib/server/resources.ts. */
function futureDate(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) throw new Error('"starts_at" must be a valid date');
  if (at.getTime() <= Date.now()) throw new Error("The start date has to be in the future");
  return at.toISOString();
}

/** Demo tokens are readable and unhashed; the real runtimes store only a SHA-256 hash. */
const newToken = () => `demo-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

/** Absolute so it can be copied out of the page, exactly as fallbackLink() hands it back. */
const inviteLink = (token: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/invite/${token}`;

function invitationByToken(token: string): Invitation {
  const invitation = db.invitations.find((i) => i.id === db.inviteTokens[token]);
  if (!invitation) throw new Error("That invitation link is not valid");
  return invitation;
}

/**
 * Mirrors maybeAutoStart() in lib/server/resources.ts. There is no cron here either, so a
 * scheduled start fires lazily on the next read of the circle — the moment it matters to anyone.
 */
function maybeAutoStart(circle: Circle): void {
  if (circle.status !== "PENDING" || !circle.starts_at) return;
  if (new Date(circle.starts_at).getTime() > Date.now()) return;
  if ((db.members[circle.id] ?? []).filter((m) => m.status === "ACTIVE").length < 2) return;
  circle.status = "ACTIVE";
  circle.current_cycle = 1;
  logActivity(
    circle.id, "CIRCLE_STARTED", "Circle started on its scheduled date - cycle 1 begins", null,
  );
}

/** `actor` is null for the one thing nobody pressed a button for: a scheduled start. */
function logActivity(
  circleId: string, type: string, message: string, actor: User | null = currentUser(),
) {
  (db.activity[circleId] ??= []).unshift({
    id: nextId("a"), actor_id: actor?.id ?? null, actor_name: actor?.name ?? null,
    type, message, created_at: now(),
  });
}

async function mock<T>(resource: string, payload: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 220)); // simulate latency
  const cid = (payload.circle_id as string) ?? "c1";

  switch (resource) {
    case "sign-up": {
      const email = String(payload.email ?? "").toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === email)) {
        throw new Error("An account with that email already exists");
      }
      // A new account is a plain USER: only the seeded persona has the admin role.
      const user = {
        id: nextId("u"), name: (payload.name as string) || "Demo User", email,
        email_verified_at: null, role: "USER" as const, created_at: now(),
      };
      db.users.push(user);
      db.passwords[email] = String(payload.password ?? "");
      return { ...user, token: "mock.jwt.token" } as T;
    }
    case "sign-in": {
      const email = String(payload.email ?? "").toLowerCase();
      const user = db.users.find((u) => u.email.toLowerCase() === email);
      // One message for both failures, exactly as the real runtimes answer.
      if (!user || db.passwords[email] !== String(payload.password ?? "")) {
        throw new Error("Invalid email or password");
      }
      return { ...user, token: "mock.jwt.token" } as T;
    }
    case "logout":
      return { ok: true } as T;
    case "me":
      return currentUser() as T;
    case "verify-email":
      return { verified: true, email: currentUser().email } as T;
    case "resend-verification":
      return { sent: true } as T;

    case "create-circle": {
      const rules = (payload.rules as Circle["rules"]) ?? {};
      const owner = currentUser();
      const circle: Circle = {
        id: nextId("c"), name: payload.name as string, owner_id: owner.id,
        contribution_amount: Number(payload.contribution_amount) || 0,
        frequency: (payload.frequency as Circle["frequency"]) ?? "MONTHLY",
        max_members: Number(payload.max_members) || 2,
        currency: (payload.currency as string) ?? "NGN",
        status: "PENDING", current_cycle: 0, rules, created_at: now(),
        starts_at: futureDate(payload.starts_at),
        visibility: (payload.visibility as Circle["visibility"]) ?? "PUBLIC",
        description: (payload.description as string) ?? null,
      };
      db.circles.unshift(circle);
      db.members[circle.id] = [{
        id: nextId("m"), user_id: owner.id, name: owner.name, email: owner.email,
        role: "OWNER", payout_position: 1, status: "ACTIVE",
      }];
      db.contributions[circle.id] = [];
      db.payouts[circle.id] = [];
      db.activity[circle.id] = [];
      logActivity(circle.id, "CIRCLE_CREATED", "Circle created");
      return circle as T;
    }

    case "start-circle": {
      const c = circleOf(cid);
      if (c.owner_id !== currentUser().id || c.status !== "PENDING") {
        throw new Error("Only the owner can start this circle, and only while it is pending");
      }
      c.status = "ACTIVE";
      c.current_cycle = 1;
      logActivity(cid, "CIRCLE_STARTED", "Circle started - cycle 1 begins");
      return c as T;
    }

    case "list-my-circles":
      return db.circles.filter((c) =>
        (db.members[c.id] ?? []).some((m) => m.user_id === currentUser().id),
      ) as T;
    case "get-circle": {
      assertMember(cid);
      const c = circleOf(cid);
      maybeAutoStart(c);
      const members = db.members[c.id] ?? [];
      return {
        ...c,
        members_count: members.length,
        seats_left: Math.max(0, c.max_members - members.length),
        owner_name: db.users.find((u) => u.id === c.owner_id)?.name ?? "Unknown",
        my_request_status:
          db.joinRequests.find((r) => r.circle_id === c.id && r.user_id === currentUser().id)?.status ?? null,
      } as T;
    }

    case "update-circle-rules": {
      const c = circleOf(cid);
      if (c.owner_id !== currentUser().id || c.status !== "PENDING") {
        throw new Error("Rules can only be changed by the owner while the circle is pending");
      }
      if (payload.frequency) c.frequency = payload.frequency as Circle["frequency"];
      if (payload.contribution_amount != null) c.contribution_amount = Number(payload.contribution_amount);
      if (payload.rules) c.rules = payload.rules as Circle["rules"];
      // Absent keys keep their stored value; a present-but-empty key clears it.
      if ("starts_at" in payload) c.starts_at = futureDate(payload.starts_at);
      if ("visibility" in payload) c.visibility = payload.visibility as Circle["visibility"];
      if ("description" in payload) c.description = (payload.description as string) || null;
      logActivity(cid, "RULES_UPDATED", "Circle rules updated");
      return c as T;
    }

    case "invite-member": {
      const email = String(payload.email ?? "").toLowerCase();
      const circle = circleOf(cid);
      const inviter = currentUser();
      const members = (db.members[cid] ??= []);

      if (circle.owner_id !== inviter.id) {
        throw new Error("Only the owner can invite people to this circle");
      }
      if (circle.status !== "PENDING") {
        throw new Error("Invitations can only be sent before the circle starts");
      }
      if (members.length >= circle.max_members) throw new Error("This circle is already full");
      const seated = members.find((m) => m.email.toLowerCase() === email);
      if (seated && seated.status !== "INVITED") {
        throw new Error("That person is already in this circle");
      }
      if (db.invitations.some(
        (i) => i.circle_id === cid && i.email.toLowerCase() === email && i.status === "PENDING",
      )) {
        throw new Error("That address already has a pending invitation to this circle");
      }

      // An invitation is addressed to an EMAIL, so people without an account can be invited.
      const token = newToken();
      const invitation: Invitation = {
        id: nextId("i"), circle_id: cid, circle_name: circle.name, email,
        invited_by: inviter.id, inviter_name: inviter.name, status: "PENDING",
        created_at: now(), expires_at: inDays(14),
      };
      db.invitations.unshift(invitation);
      db.inviteTokens[token] = invitation.id;

      // Someone who already has an account also gets a placeholder membership row.
      const known = db.users.find((u) => u.email.toLowerCase() === email);
      if (known && !seated) {
        members.push({
          id: nextId("m"), user_id: known.id, name: known.name, email: known.email,
          role: "MEMBER", payout_position: 0, status: "INVITED",
        });
      }

      db.emails.unshift({
        id: nextId("e"), to_email: email,
        subject: `${inviter.name} invited you to the "${circle.name}" savings circle`,
        template: "INVITATION", body: `Open the invitation: ${inviteLink(token)}`,
        status: "LOGGED", created_at: now(),
      });
      logActivity(cid, "MEMBER_INVITED", `Member invited: ${email}`);
      // Nothing left this page, so the link has to come back to the caller — as the local
      // runtime does through fallbackLink() whenever no mail provider is configured.
      return { ...invitation, invite_url: inviteLink(token) } as T;
    }

    case "join-circle": {
      const user = currentUser();
      const members = (db.members[cid] ??= []);
      const m = members.find((x) => x.user_id === user.id && x.status === "INVITED");
      if (!m) throw new Error("You have no pending invite to this circle");
      m.status = "ACTIVE";
      if (Number(m.payout_position) <= 0) m.payout_position = maxPosition(members) + 1;

      // Close the invitation the placeholder came from, so it can't be replayed by link.
      const invitation = db.invitations.find(
        (i) => i.circle_id === cid && i.status === "PENDING" &&
          i.email.toLowerCase() === user.email.toLowerCase(),
      );
      if (invitation) {
        invitation.status = "ACCEPTED";
        invitation.responded_at = now();
      }
      logActivity(cid, "MEMBER_JOINED", "A member joined the circle");
      return m as T;
    }

    case "list-members":
      assertMember(cid);
      return [...(db.members[cid] ?? [])].sort((a, b) => a.payout_position - b.payout_position) as T;

    case "set-payout-order": {
      const m = (db.members[cid] ?? []).find((x) => x.user_id === payload.user_id);
      if (m) m.payout_position = Number(payload.payout_position);
      return (m ?? {}) as T;
    }

    case "record-contribution": {
      const c = circleOf(cid);
      const user = currentUser();
      const contribution: Contribution = {
        id: nextId("t"), user_id: user.id, name: user.name, cycle: c.current_cycle,
        amount: c.contribution_amount, status: "PENDING", created_at: now(),
      };
      (db.contributions[cid] ??= []).unshift(contribution);
      logActivity(cid, "CONTRIBUTION_RECORDED", "Contribution recorded (pending confirmation)");
      return contribution as T;
    }

    case "confirm-contribution": {
      for (const list of Object.values(db.contributions)) {
        const t = list.find((x) => x.id === payload.contribution_id);
        if (t) {
          t.status = "CONFIRMED";
          t.confirmed_by = currentUser().id;
          logActivity(cid, "CONTRIBUTION_CONFIRMED", "Contribution confirmed");
          return t as T;
        }
      }
      throw new Error("Contribution not found");
    }

    case "list-contributions":
      assertMember(cid);
      return [...(db.contributions[cid] ?? [])].sort(
        (a, b) => b.cycle - a.cycle || b.created_at.localeCompare(a.created_at),
      ) as T;

    case "record-payout": {
      const c = circleOf(cid);
      const recipient = (db.members[cid] ?? []).find((m) => m.payout_position === c.current_cycle);
      const amount = (db.contributions[cid] ?? [])
        .filter((t) => t.cycle === c.current_cycle && t.status === "CONFIRMED")
        .reduce((sum, t) => sum + t.amount, 0);
      const payout: Payout = {
        id: nextId("p"), cycle: c.current_cycle,
        recipient_id: recipient?.user_id ?? "u?", recipient_name: recipient?.name ?? "Unknown",
        amount, status: "PAID", recorded_by: currentUser().id, created_at: now(),
      };
      (db.payouts[cid] ??= []).unshift(payout);
      c.current_cycle += 1;
      if (c.current_cycle > c.max_members) c.status = "COMPLETED";
      logActivity(cid, "PAYOUT_RECORDED", "Payout recorded for this cycle");
      return payout as T;
    }

    case "confirm-payout-received": {
      for (const list of Object.values(db.payouts)) {
        const p = list.find((x) => x.id === payload.payout_id);
        if (p) {
          p.status = "RECEIVED";
          logActivity(cid, "PAYOUT_CONFIRMED", "Recipient confirmed payout received");
          return p as T;
        }
      }
      throw new Error("Payout not found");
    }

    case "list-payouts":
      assertMember(cid);
      return [...(db.payouts[cid] ?? [])].sort((a, b) => b.cycle - a.cycle) as T;

    /* --------------------- discovery + join requests --------------------- */

    case "list-public-circles": {
      const search = String(payload.search ?? "").toLowerCase();
      const viewer = currentUser();
      return db.circles
        .filter((c) => {
          const members = db.members[c.id] ?? [];
          const iAmIn = members.some((m) => m.user_id === viewer.id);
          const seats = c.max_members - members.length;
          return (
            c.visibility !== "PRIVATE" && c.status === "PENDING" && !iAmIn && seats > 0 &&
            (!search || `${c.name} ${c.description ?? ""}`.toLowerCase().includes(search))
          );
        })
        .map((c) => {
          const members = db.members[c.id] ?? [];
          return {
            ...c,
            members_count: members.length,
            seats_left: c.max_members - members.length,
            owner_name: db.users.find((u) => u.id === c.owner_id)?.name ?? "Unknown",
            my_request_status:
              db.joinRequests.find((r) => r.circle_id === c.id && r.user_id === viewer.id)?.status ?? null,
          };
        }) as T;
    }

    case "request-to-join": {
      const circle = circleOf(cid);
      const user = currentUser();
      const request: JoinRequest = {
        id: nextId("j"), circle_id: cid, circle_name: circle.name, user_id: user.id,
        name: user.name, email: user.email, message: (payload.message as string) || null,
        status: "PENDING", created_at: now(),
      };
      db.joinRequests.unshift(request);
      db.emails.unshift({
        id: nextId("e"), to_email: "owner@example.com",
        subject: `${user.name} asked to join "${circle.name}"`, template: "JOIN_REQUEST",
        body: `Review the request: /circles/${cid}?tab=requests`, status: "LOGGED", created_at: now(),
      });
      return request as T;
    }

    case "list-join-requests":
      return db.joinRequests.filter((r) => r.circle_id === cid) as T;

    case "my-join-requests":
      return db.joinRequests.filter((r) => r.user_id === currentUser().id) as T;

    case "cancel-join-request": {
      const request = db.joinRequests.find((r) => r.id === payload.request_id);
      if (!request) throw new Error("Request not found");
      request.status = "CANCELLED";
      return request as T;
    }

    case "respond-join-request": {
      const request = db.joinRequests.find((r) => r.id === payload.request_id);
      if (!request) throw new Error("Request not found");
      const approved = payload.action === "APPROVE";
      request.status = approved ? "APPROVED" : "REJECTED";
      request.decided_at = now();

      if (approved) {
        const list = (db.members[request.circle_id] ??= []);
        list.push({
          id: nextId("m"), user_id: request.user_id, name: request.name ?? "New member",
          email: request.email ?? "", role: "MEMBER",
          payout_position: list.length + 1, status: "ACTIVE",
        });
        logActivity(request.circle_id, "MEMBER_JOINED", `${request.name} joined via a join request`);
      }
      db.emails.unshift({
        id: nextId("e"), to_email: request.email ?? "",
        subject: approved ? "You're in" : "Your request was declined",
        template: approved ? "JOIN_APPROVED" : "JOIN_REJECTED",
        body: `Circle: ${request.circle_name}`, status: "LOGGED", created_at: now(),
      });
      return request as T;
    }

    /* ----------------------------- invitations --------------------------- */

    case "list-invitations":
      return db.invitations.filter((i) => i.circle_id === cid) as T;

    case "my-invitations":
      return db.invitations.filter(
        (i) => i.status === "PENDING" && i.email.toLowerCase() === currentUser().email.toLowerCase(),
      ) as T;

    case "get-invitation": {
      // The link is the credential: an unknown token is a 404, never somebody else's invitation.
      const invitation = invitationByToken(String(payload.token ?? ""));
      // An answered or dead link must stop rendering as a live invitation, the same refusals the
      // local runtime hands back — otherwise the demo teaches that a link can be spent twice.
      if (invitation.status === "ACCEPTED") {
        throw new Error("That invitation has already been accepted — sign in to open the circle");
      }
      if (invitation.status === "DECLINED") throw new Error("That invitation was declined");
      if (invitation.status === "CANCELLED") {
        throw new Error("That invitation was cancelled by the circle owner");
      }
      if (
        invitation.status === "EXPIRED" ||
        new Date(invitation.expires_at).getTime() <= Date.now()
      ) {
        invitation.status = "EXPIRED";
        throw new Error("That invitation has expired — ask the owner to send a new one");
      }
      const circle = circleOf(invitation.circle_id);
      const members = db.members[circle.id] ?? [];
      return {
        ...invitation,
        circle_name: circle.name, contribution_amount: circle.contribution_amount,
        currency: circle.currency, frequency: circle.frequency, max_members: circle.max_members,
        seats_left: Math.max(0, circle.max_members - members.length),
      } as T;
    }

    case "respond-invitation": {
      const invitation = invitationByToken(String(payload.token ?? ""));
      const user = currentUser();
      // The seat is held for the address, not for whoever happens to hold the link.
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error("That invitation was sent to a different email address");
      }
      if (invitation.status !== "PENDING") {
        throw new Error(`That invitation was already ${invitation.status.toLowerCase()}`);
      }
      if (new Date(invitation.expires_at).getTime() <= Date.now()) {
        invitation.status = "EXPIRED";
        throw new Error("That invitation has expired — ask the owner to send a new one");
      }

      const accepted = payload.action === "ACCEPT";
      invitation.status = accepted ? "ACCEPTED" : "DECLINED";
      invitation.responded_at = now();
      if (accepted) {
        // Activate the placeholder if there is one, otherwise join at the back of the rotation.
        const list = (db.members[invitation.circle_id] ??= []);
        const held = list.find((m) => m.user_id === user.id);
        if (held) {
          held.status = "ACTIVE";
          if (Number(held.payout_position) <= 0) held.payout_position = maxPosition(list) + 1;
        } else {
          list.push({
            id: nextId("m"), user_id: user.id, name: user.name, email: user.email,
            role: "MEMBER", payout_position: maxPosition(list) + 1, status: "ACTIVE",
          });
        }
        logActivity(
          invitation.circle_id, "MEMBER_JOINED", `${user.name} accepted their invitation`,
        );
      }
      return invitation as T;
    }

    case "cancel-invitation": {
      const invitation = db.invitations.find((i) => i.id === payload.invitation_id);
      if (!invitation) throw new Error("Invitation not found");
      invitation.status = "CANCELLED";
      return invitation as T;
    }

    /* -------------------------------- admin ------------------------------ */

    case "admin-overview": {
      assertAdmin();
      const contributions = Object.values(db.contributions).flat();
      return {
        users: db.users.length,
        verified_users: db.users.filter((u) => u.email_verified_at).length,
        circles: db.circles.length,
        active_circles: db.circles.filter((c) => c.status === "ACTIVE").length,
        completed_circles: db.circles.filter((c) => c.status === "COMPLETED").length,
        total_confirmed: contributions.filter((t) => t.status === "CONFIRMED").length,
        total_saved: contributions.filter((t) => t.status === "CONFIRMED").reduce((s, t) => s + t.amount, 0),
        pending_join_requests: db.joinRequests.filter((r) => r.status === "PENDING").length,
        pending_invitations: db.invitations.filter((i) => i.status === "PENDING").length,
        emails_sent: db.emails.filter((e) => e.status === "SENT").length,
        emails_failed: db.emails.filter((e) => e.status === "FAILED").length,
      } as T;
    }

    case "admin-list-circles":
      assertAdmin();
      return db.circles.map((c) => {
        const contributions = db.contributions[c.id] ?? [];
        const owner = db.users.find((u) => u.id === c.owner_id);
        return {
          id: c.id, name: c.name, owner_name: owner?.name ?? "Unknown",
          owner_email: owner?.email ?? "", status: c.status, visibility: c.visibility ?? "PUBLIC",
          current_cycle: c.current_cycle, max_members: c.max_members,
          members_count: (db.members[c.id] ?? []).length,
          contribution_amount: c.contribution_amount, currency: c.currency,
          confirmed_contributions: contributions.filter((t) => t.status === "CONFIRMED").length,
          pending_contributions: contributions.filter((t) => t.status === "PENDING").length,
          total_saved: contributions.filter((t) => t.status === "CONFIRMED").reduce((s, t) => s + t.amount, 0),
          payouts_count: (db.payouts[c.id] ?? []).length,
          starts_at: c.starts_at ?? null, created_at: c.created_at ?? now(),
        };
      }) as T;

    case "admin-list-users":
      assertAdmin();
      return db.users.map((u) => ({
        id: u.id, name: u.name, email: u.email, role: u.role ?? "USER",
        email_verified_at: u.email_verified_at ?? null,
        circles_count: Object.values(db.members).filter((list) =>
          list.some((m) => m.user_id === u.id),
        ).length,
        created_at: u.created_at,
      })) as T;

    case "admin-list-emails":
      assertAdmin();
      return db.emails as T;

    case "get-dashboard": {
      assertMember(cid);
      const c = circleOf(cid);
      maybeAutoStart(c);
      const members = db.members[cid] ?? [];
      const cycleContribs = (db.contributions[cid] ?? []).filter(
        (t) => t.cycle === c.current_cycle && t.status === "CONFIRMED",
      );
      const dash: DashboardData = {
        id: c.id, name: c.name, status: c.status, current_cycle: c.current_cycle,
        max_members: c.max_members, contribution_amount: c.contribution_amount, currency: c.currency,
        pot: cycleContribs.reduce((s, t) => s + t.amount, 0),
        members_paid: cycleContribs.length,
        total_members: members.filter((m) => m.status === "ACTIVE").length,
        next_recipient: members.find((m) => m.payout_position === c.current_cycle)?.name ?? null,
        completion_pct: Math.round((Math.max(c.current_cycle - 1, 0) / Math.max(c.max_members, 1)) * 100),
      };
      return dash as T;
    }

    case "get-insights": {
      assertMember(cid);
      const c = circleOf(cid);
      const confirmed = (db.contributions[cid] ?? []).filter((t) => t.status === "CONFIRMED");
      const byMember = new Map<string, number>();
      confirmed.forEach((t) => byMember.set(t.name, (byMember.get(t.name) ?? 0) + 1));
      const top = [...byMember.entries()].sort((a, b) => b[1] - a[1])[0];
      const cycles = new Set(confirmed.map((t) => t.cycle)).size;
      const insights: Insights = {
        most_reliable_member: top?.[0] ?? null,
        total_savings: confirmed.reduce((s, t) => s + t.amount, 0),
        total_confirmed: confirmed.length,
        next_payout_member:
          (db.members[cid] ?? []).find((m) => m.payout_position === c.current_cycle)?.name ?? null,
        avg_confirmed_per_cycle: cycles ? Math.round((confirmed.length / cycles) * 10) / 10 : null,
      };
      return insights as T;
    }

    case "get-trust-score": {
      assertMember(cid);
      const c = circleOf(cid);
      const elapsed = Math.max(c.current_cycle - 1, 1);
      const rows: TrustScoreRow[] = (db.members[cid] ?? [])
        .filter((m) => m.status === "ACTIVE")
        .map((m) => {
          const mine = (db.contributions[cid] ?? []).filter((t) => t.user_id === m.user_id);
          const confirmed = mine.filter((t) => t.status === "CONFIRMED");
          return {
            user_id: m.user_id, name: m.name,
            total_contributed: confirmed.reduce((s, t) => s + t.amount, 0),
            confirmed_count: confirmed.length,
            pending_count: mine.filter((t) => t.status === "PENDING").length,
            reliability_pct:
              c.current_cycle <= 1 ? 100 : Math.min(100, Math.round((confirmed.length / elapsed) * 100)),
          };
        })
        .sort((a, b) => b.reliability_pct - a.reliability_pct);
      return rows as T;
    }

    case "get-circle-health": {
      assertMember(cid);
      const c = circleOf(cid);
      const contribs = db.contributions[cid] ?? [];
      const active = (db.members[cid] ?? []).filter((m) => m.status === "ACTIVE").length;
      const confirmed = contribs.filter((t) => t.status === "CONFIRMED").length;
      const expected = active * Math.max(c.current_cycle - 1, 1);
      const health: CircleHealth = {
        id: c.id, name: c.name, status: c.status, current_cycle: c.current_cycle,
        max_members: c.max_members, active_members: active,
        confirmed_contributions: confirmed,
        pending_contributions: contribs.filter((t) => t.status === "PENDING").length,
        payouts_received: (db.payouts[cid] ?? []).filter((p) => p.status === "RECEIVED").length,
        health_pct: expected ? Math.min(100, Math.round((confirmed / expected) * 100)) : 100,
      };
      return health as T;
    }

    case "list-activity":
      assertMember(cid);
      return (db.activity[cid] ?? []) as T;

    default:
      throw new Error(`No mock for resource "${resource}"`);
  }
}
