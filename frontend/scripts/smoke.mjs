#!/usr/bin/env node
/**
 * End-to-end smoke test for the self-hosted CircleSafe runtime.
 *
 * Runs the whole lifecycle against a running server with a real Postgres behind it, plus the
 * authorization checks that MUST fail. Exits non-zero if anything is wrong.
 *
 *   # terminal 1
 *   DATABASE_URL=... JWT_SECRET_KEY=... NEXT_PUBLIC_LOCAL_API=true npm run dev
 *   # terminal 2
 *   npm run smoke                       # or: npm run smoke -- http://localhost:3000/api
 *
 * It writes real rows (throwaway users, circles, invitations and outbox emails) — point it at a
 * scratch database. The admin assertions need an account whose address is in ADMIN_EMAILS; with
 * no such account that one section is skipped rather than failed.
 */

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE ?? "http://localhost:3000/api").replace(
  /\/$/,
  "",
);

let passed = 0;
let skipped = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push({ name, detail });
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** For coverage that depends on how the runner configured the environment, not on the code. */
function skip(name, why) {
  skipped += 1;
  console.log(`  skip ${name} — ${why}`);
}

/**
 * Each persona gets its own client IP. Rate limits bucket per resource + IP, and these accounts
 * stand in for different people on different connections — sharing one IP would trip the
 * sign-up limiter halfway through the suite.
 */
const ipByToken = new Map();
let ipSeq = 0;
const nextIp = () => `10.0.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
const ipOf = (user) => ipByToken.get(user?.token);

async function call(resource, payload = {}, token, ip) {
  const from = ip ?? (token ? ipByToken.get(token) : undefined);
  const res = await fetch(`${BASE}/${resource}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(from ? { "x-forwarded-for": from } : {}),
    },
    body: JSON.stringify(payload),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body };
}

/** Fails loudly: used for the calls the happy path depends on. */
async function must(resource, payload, token, ip) {
  const { status, body } = await call(resource, payload, token, ip);
  if (status >= 400) {
    console.error(`\nAborting: ${resource} returned ${status} — ${body?.message ?? "no message"}`);
    process.exit(1);
  }
  return body;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

/** Invite and verification links are only handed back over the API when SMTP is unconfigured. */
const linkToken = (url) => (url ? String(url).split("/").pop() : null);

/** Answer an invitation by its emailed token, or by id when there is no link to read. */
const respondTo = (invitation, action) => {
  const token = linkToken(invitation?.invite_url);
  return token ? { token, action } : { invitation_id: invitation.id, action };
};

const stamp = Date.now();
const person = (slug, name) => ({
  name,
  email: `${slug}.${stamp}@example.com`,
  password: "correct-horse-battery",
});

/** Signs up a throwaway persona without confirming the address. */
async function signUpRaw(user) {
  const ip = nextIp();
  const created = await must("sign-up", user, undefined, ip);
  ipByToken.set(created.token, ip);
  return created;
}

/** Signs up a test user without phone verification. */
async function signUp(user) {
  return signUpRaw(user);
}

const amara = person("amara", "Amara Okafor");
const john = person("john", "John Mensah");

console.log(`CircleSafe smoke test → ${BASE}\n`);

/* ------------------------------- auth ------------------------------- */
console.log("auth");
const a = await signUp(amara);
check("sign-up returns an id and a token", Boolean(a?.id && a?.token));
check("sign-up never returns the password", !("password" in (a ?? {})));

const dupe = await call("sign-up", amara);
check("duplicate email is rejected with 409", dupe.status === 409, `got ${dupe.status}`);

const b = await signUp(john);

const signedIn = await must("sign-in", { email: amara.email, password: amara.password });
check("sign-in returns a token", Boolean(signedIn?.token));

const wrongPassword = await call("sign-in", { email: amara.email, password: "not-the-password" });
check("wrong password is rejected with 401", wrongPassword.status === 401, `got ${wrongPassword.status}`);

const badEmail = await call("sign-up", { ...john, email: "not-an-email" });
check("invalid email fails validation with 400", badEmail.status === 400, `got ${badEmail.status}`);

const shortPassword = await call("sign-up", { name: "Too Short", email: `x.${stamp}@example.com`, password: "abc" });
check("short password fails validation with 400", shortPassword.status === 400, `got ${shortPassword.status}`);

const noToken = await call("list-my-circles");
check("protected resource without a token is 401", noToken.status === 401, `got ${noToken.status}`);

