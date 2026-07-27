import { getToken } from "./auth";
import type {
  ActivityItem, Circle, CircleHealth, Contribution, DashboardData,
  Insights, Member, Payout, TrustScoreRow, User,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const USE_MOCK = !API_URL;

/**
 * Calls a Sub0 endpoint by its resource name.
 * Real mode: POST `${API_URL}/${resource}` with JSON payload + Bearer token.
 * Mock mode (no API URL set): runs against an in-memory demo circle so every flow
 * (invite → order → contribute → confirm → payout) actually works before Sub0 is live.
 * NOTE: adjust the response unwrap (data shape) once the live Sub0 response format is confirmed.
 */
async function call<T>(resource: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (USE_MOCK) return mock<T>(resource, payload);

  const token = getToken();
  const res = await fetch(`${API_URL}/${resource}`, {
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

/* ------------------------------ Circles ----------------------------- */
export const createCircle = (p: Partial<Circle>) => call<Circle>("create-circle", p);
export const startCircle = (circle_id: string) => call<Circle>("start-circle", { circle_id });
export const listMyCircles = () => call<Circle[]>("list-my-circles");
export const getCircle = (circle_id: string) => call<Circle>("get-circle", { circle_id });
export const updateCircleRules = (p: Partial<Circle> & { circle_id: string }) =>
  call<Circle>("update-circle-rules", p);

/* ------------------------------ Members ----------------------------- */
export const inviteMember = (p: { circle_id: string; email: string }) =>
  call<Member>("invite-member", p);
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

/* ---------------------- Dashboard / Scores -------------------------- */
export const getDashboard = (circle_id: string) => call<DashboardData>("get-dashboard", { circle_id });
export const getInsights = (circle_id: string) => call<Insights>("get-insights", { circle_id });
export const getTrustScore = (circle_id: string) => call<TrustScoreRow[]>("get-trust-score", { circle_id });
export const getCircleHealth = (circle_id: string) => call<CircleHealth>("get-circle-health", { circle_id });
export const listActivity = (circle_id: string) => call<ActivityItem[]>("list-activity", { circle_id });

/* =============================== MOCK ===============================
 * A small in-memory database so the UI is fully clickable in demo mode.
 * The signed-in demo user is u1 (Amara Okafor), OWNER of circle c1.
 * ==================================================================== */

export const MOCK_USER_ID = "u1";

const db = {
  circles: [
    {
      id: "c1", name: "Lagos Traders Circle", owner_id: "u1", contribution_amount: 5000,
      frequency: "WEEKLY", max_members: 4, currency: "NGN", status: "ACTIVE", current_cycle: 3,
      rules: { grace_period_days: 3, late_fee: 500 }, created_at: "2026-05-01T09:00:00Z",
    },
    {
      id: "c2", name: "Campus Savers", owner_id: "u1", contribution_amount: 2000,
      frequency: "MONTHLY", max_members: 6, currency: "NGN", status: "PENDING", current_cycle: 0,
      rules: { grace_period_days: 5, late_fee: 200 }, created_at: "2026-07-10T09:00:00Z",
    },
  ] as Circle[],

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

function logActivity(circleId: string, type: string, message: string) {
  (db.activity[circleId] ??= []).unshift({
    id: nextId("a"), actor_id: MOCK_USER_ID, actor_name: "Amara Okafor",
    type, message, created_at: now(),
  });
}

async function mock<T>(resource: string, payload: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 220)); // simulate latency
  const cid = (payload.circle_id as string) ?? "c1";

  switch (resource) {
    case "sign-up":
      return { id: MOCK_USER_ID, name: (payload.name as string) || "Demo User", email: payload.email as string, token: "mock.jwt.token" } as T;
    case "sign-in":
      return { id: MOCK_USER_ID, name: "Amara Okafor", email: payload.email as string, token: "mock.jwt.token" } as T;
    case "logout":
      return { ok: true } as T;

    case "create-circle": {
      const rules = (payload.rules as Circle["rules"]) ?? {};
      const circle: Circle = {
        id: nextId("c"), name: payload.name as string, owner_id: MOCK_USER_ID,
        contribution_amount: Number(payload.contribution_amount) || 0,
        frequency: (payload.frequency as Circle["frequency"]) ?? "MONTHLY",
        max_members: Number(payload.max_members) || 2,
        currency: (payload.currency as string) ?? "NGN",
        status: "PENDING", current_cycle: 0, rules, created_at: now(),
      };
      db.circles.unshift(circle);
      db.members[circle.id] = [{
        id: nextId("m"), user_id: MOCK_USER_ID, name: "Amara Okafor", email: "amara@example.com",
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
      c.status = "ACTIVE";
      c.current_cycle = 1;
      logActivity(cid, "CIRCLE_STARTED", "Circle started - cycle 1 begins");
      return c as T;
    }

    case "list-my-circles":
      return db.circles as T;
    case "get-circle":
      return circleOf(cid) as T;

    case "update-circle-rules": {
      const c = circleOf(cid);
      if (payload.frequency) c.frequency = payload.frequency as Circle["frequency"];
      if (payload.contribution_amount != null) c.contribution_amount = Number(payload.contribution_amount);
      if (payload.rules) c.rules = payload.rules as Circle["rules"];
      logActivity(cid, "RULES_UPDATED", "Circle rules updated");
      return c as T;
    }

    case "invite-member": {
      const email = payload.email as string;
      const list = (db.members[cid] ??= []);
      const member: Member = {
        id: nextId("m"), user_id: nextId("u"),
        name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (s) => s.toUpperCase()),
        email, role: "MEMBER", payout_position: 0, status: "INVITED",
      };
      list.push(member);
      logActivity(cid, "MEMBER_INVITED", `Member invited: ${email}`);
      return member as T;
    }

    case "join-circle": {
      const m = (db.members[cid] ?? []).find((x) => x.status === "INVITED");
      if (m) m.status = "ACTIVE";
      logActivity(cid, "MEMBER_JOINED", "A member joined the circle");
      return (m ?? {}) as T;
    }

    case "list-members":
      return [...(db.members[cid] ?? [])].sort((a, b) => a.payout_position - b.payout_position) as T;

    case "set-payout-order": {
      const m = (db.members[cid] ?? []).find((x) => x.user_id === payload.user_id);
      if (m) m.payout_position = Number(payload.payout_position);
      return (m ?? {}) as T;
    }

    case "record-contribution": {
      const c = circleOf(cid);
      const contribution: Contribution = {
        id: nextId("t"), user_id: MOCK_USER_ID, name: "Amara Okafor", cycle: c.current_cycle,
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
          t.confirmed_by = MOCK_USER_ID;
          logActivity(cid, "CONTRIBUTION_CONFIRMED", "Contribution confirmed");
          return t as T;
        }
      }
      throw new Error("Contribution not found");
    }

    case "list-contributions":
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
        amount, status: "PAID", recorded_by: MOCK_USER_ID, created_at: now(),
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
      return [...(db.payouts[cid] ?? [])].sort((a, b) => b.cycle - a.cycle) as T;

    case "get-dashboard": {
      const c = circleOf(cid);
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
      return (db.activity[cid] ?? []) as T;

    default:
      throw new Error(`No mock for resource "${resource}"`);
  }
}
