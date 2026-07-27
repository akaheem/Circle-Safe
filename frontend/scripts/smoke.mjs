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

/** The same, then confirms the address so the suite works with verification enforced. */
async function signUp(user) {
  const created = await signUpRaw(user);
  const token = linkToken(created.verify_url);
  if (token) await must("verify-email", { token }, undefined, ipOf(created));
  return created;
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

/* ------------------------- email verification ----------------------- */
console.log("\nemail verification");
const verifier = person("verify", "Ada Balogun");
const fresh = await signUpRaw(verifier);
check("sign-up leaves the address unconfirmed", fresh.email_verified_at === null, `got ${fresh.email_verified_at}`);
check("sign-up returns the platform role", fresh.role === "USER", `got ${fresh.role}`);

const verifyToken = linkToken(fresh.verify_url);
if (!verifyToken) {
  skip("email verification flow", "SMTP is configured, so verify_url is not returned");
} else {
  check("sign-up hands back a verification link without SMTP", verifyToken.length >= 20, `got "${fresh.verify_url}"`);

  const confirmed = await must("verify-email", { token: verifyToken }, undefined, ipOf(fresh));
  check("verify-email confirms the address",
    confirmed?.verified === true && confirmed?.email === verifier.email, JSON.stringify(confirmed));

  const nonsense = await call("verify-email", { token: "definitely-not-a-real-verification-token" });
  check("a nonsense verification token is rejected", nonsense.status === 404, `got ${nonsense.status}`);

  // Clicking the emailed link twice is deliberately idempotent (mail clients pre-fetch links),
  // so what has to hold here is that a replay can never confirm anybody else.
  const replay = await call("verify-email", { token: verifyToken }, undefined, ipOf(fresh));
  check("replaying the link confirms nobody new",
    replay.status >= 400 || replay.body?.email === verifier.email, `got ${replay.status}`);

  const whoami = await must("me", {}, fresh.token);
  check("me reports the confirmed address", Boolean(whoami?.email_verified_at));
  check("me reports the account role", whoami?.role === "USER", `got ${whoami?.role}`);

  const alreadyDone = await call("resend-verification", {}, fresh.token);
  check("resend-verification refuses once confirmed", alreadyDone.status === 409, `got ${alreadyDone.status}`);

  // Single use, proved on a token the runtime has superseded rather than on a repeat click.
  const rotating = await signUpRaw(person("rotate", "Chidi Obi"));
  const firstLink = linkToken(rotating.verify_url);
  const resent = await must("resend-verification", {}, rotating.token);
  check("resend-verification issues a fresh link", resent?.sent === true);

  const superseded = await call("verify-email", { token: firstLink }, undefined, ipOf(rotating));
  check("a superseded verification token is dead", superseded.status >= 400, `got ${superseded.status}`);

  const newest = await must("verify-email", { token: linkToken(resent.verify_url) }, undefined, ipOf(rotating));
  check("the newest verification link works", newest?.verified === true);
}

/* ------------------------------ circle ------------------------------ */
console.log("\ncircle setup");
const circle = await must(
  "create-circle",
  {
    name: `Smoke Circle ${stamp}`,
    contribution_amount: 5000,
    frequency: "WEEKLY",
    max_members: 2,
    currency: "NGN",
    rules: { grace_period_days: 3, late_fee: 500 },
  },
  a.token,
);
check("create-circle returns an id", Boolean(circle?.id));
check("new circle starts PENDING", circle?.status === "PENDING", `status ${circle?.status}`);

const mine = await must("list-my-circles", {}, a.token);
check("list-my-circles includes it", mine.some((c) => c.id === circle.id));

const notMine = await call("get-circle", { circle_id: circle.id }, b.token);
check("a non-member cannot read the circle", notMine.status >= 400, `got ${notMine.status}`);

// An invitation is addressed to an EMAIL, so someone with no account can be invited.
const inviteUnknown = await must("invite-member", { circle_id: circle.id, email: `nobody.${stamp}@example.com` }, a.token);
check("inviting an email with no account succeeds", inviteUnknown?.status === "PENDING", `got ${inviteUnknown?.status}`);

const invited = await must("invite-member", { circle_id: circle.id, email: john.email }, a.token);
check("invite-member creates a PENDING invitation", invited?.status === "PENDING", `got ${invited?.status}`);

const holding = await must("list-members", { circle_id: circle.id }, a.token);
check("an invitee who has an account also holds a seat",
  holding.some((m) => m.user_id === b.id && m.status === "INVITED"));

const inviteAgain = await call("invite-member", { circle_id: circle.id, email: john.email }, a.token);
check("inviting the same person twice is 409", inviteAgain.status === 409, `got ${inviteAgain.status}`);

const memberInvites = await call("invite-member", { circle_id: circle.id, email: amara.email }, b.token);
check("a non-owner cannot invite", memberInvites.status >= 400, `got ${memberInvites.status}`);

await must("join-circle", { circle_id: circle.id }, b.token);
const members = await must("list-members", { circle_id: circle.id }, a.token);
check("circle now has 2 members", members.length === 2, `got ${members.length}`);
check("both members are ACTIVE", members.every((m) => m.status === "ACTIVE"));

const full = await call("invite-member", { circle_id: circle.id, email: `extra.${stamp}@example.com` }, a.token);
check("a full circle rejects further invites", full.status >= 400, `got ${full.status}`);

/* --------------------------- payout order --------------------------- */
console.log("\npayout order + start");
await must("set-payout-order", { circle_id: circle.id, user_id: a.id, payout_position: 1 }, a.token);
await must("set-payout-order", { circle_id: circle.id, user_id: b.id, payout_position: 2 }, a.token);

const orderByMember = await call("set-payout-order", { circle_id: circle.id, user_id: a.id, payout_position: 2 }, b.token);
check("a member cannot change the payout order", orderByMember.status >= 400, `got ${orderByMember.status}`);

const contributeEarly = await call("record-contribution", { circle_id: circle.id }, b.token);
check("cannot contribute before the circle starts", contributeEarly.status >= 400, `got ${contributeEarly.status}`);

const startByMember = await call("start-circle", { circle_id: circle.id }, b.token);
check("a member cannot start the circle", startByMember.status >= 400, `got ${startByMember.status}`);

const started = await must("start-circle", { circle_id: circle.id }, a.token);
check("start-circle sets ACTIVE at cycle 1", started?.status === "ACTIVE" && Number(started?.current_cycle) === 1);

const lockedRules = await call(
  "update-circle-rules",
  { circle_id: circle.id, frequency: "MONTHLY", contribution_amount: 9999, rules: { grace_period_days: 1, late_fee: 0 } },
  a.token,
);
check("rules are locked once ACTIVE", lockedRules.status >= 400, `got ${lockedRules.status}`);

const lockedOrder = await call("set-payout-order", { circle_id: circle.id, user_id: b.id, payout_position: 1 }, a.token);
check("payout order is locked once ACTIVE", lockedOrder.status >= 400, `got ${lockedOrder.status}`);

/* -------------------------- contributions --------------------------- */
console.log("\ncontributions");
const contributionA = await must("record-contribution", { circle_id: circle.id }, a.token);
check("contribution is PENDING on record", contributionA?.status === "PENDING");
check("amount comes from the circle, not the client", Number(contributionA?.amount) === 5000, `got ${contributionA?.amount}`);

const twice = await call("record-contribution", { circle_id: circle.id }, a.token);
check("a second contribution in the same cycle is 409", twice.status === 409, `got ${twice.status}`);

const contributionB = await must("record-contribution", { circle_id: circle.id }, b.token);

const memberConfirms = await call("confirm-contribution", { contribution_id: contributionB.id }, b.token);
check("a MEMBER cannot confirm a contribution", memberConfirms.status === 403, `got ${memberConfirms.status}`);

await must("confirm-contribution", { contribution_id: contributionA.id }, a.token);
const confirmedB = await must("confirm-contribution", { contribution_id: contributionB.id }, a.token);
check("owner can confirm", confirmedB?.status === "CONFIRMED");

const reconfirm = await call("confirm-contribution", { contribution_id: contributionB.id }, a.token);
check("confirming twice fails", reconfirm.status >= 400, `got ${reconfirm.status}`);

const ledger = await must("list-contributions", { circle_id: circle.id }, b.token);
check("ledger shows both contributions", ledger.length === 2, `got ${ledger.length}`);

/* ---------------------------- dashboard ----------------------------- */
console.log("\ndashboard + scores");
const dash = await must("get-dashboard", { circle_id: circle.id }, b.token);
check("pot is the sum of confirmed contributions", Number(dash.pot) === 10000, `got ${dash.pot}`);
check("members_paid counts confirmations", Number(dash.members_paid) === 2, `got ${dash.members_paid}`);
check("next recipient is position 1", dash.next_recipient === amara.name, `got ${dash.next_recipient}`);

const scores = await must("get-trust-score", { circle_id: circle.id }, a.token);
check("trust score returns a row per member", scores.length === 2, `got ${scores.length}`);

const health = await must("get-circle-health", { circle_id: circle.id }, a.token);
check("health reports 2 confirmed contributions", Number(health.confirmed_contributions) === 2);

const insights = await must("get-insights", { circle_id: circle.id }, a.token);
check("insights total savings is 10000", Number(insights.total_savings) === 10000, `got ${insights.total_savings}`);

const outsiderScores = await call("get-trust-score", { circle_id: circle.id }, undefined);
check("scores require a token", outsiderScores.status === 401, `got ${outsiderScores.status}`);

/* ------------------------------ payouts ----------------------------- */
console.log("\npayouts");
const payoutByMember = await call("record-payout", { circle_id: circle.id }, b.token);
check("a member cannot record a payout", payoutByMember.status >= 400, `got ${payoutByMember.status}`);

const payout = await must("record-payout", { circle_id: circle.id }, a.token);
check("payout goes to position 1", payout?.recipient_id === a.id, `got ${payout?.recipient_id}`);
check("payout equals the confirmed pot", Number(payout?.amount) === 10000, `got ${payout?.amount}`);
check("payout is PAID", payout?.status === "PAID");

const wrongRecipient = await call("confirm-payout-received", { payout_id: payout.id }, b.token);
check("only the recipient can confirm receipt", wrongRecipient.status === 403, `got ${wrongRecipient.status}`);

const received = await must("confirm-payout-received", { payout_id: payout.id }, a.token);
check("recipient confirms receipt", received?.status === "RECEIVED");

const payouts = await must("list-payouts", { circle_id: circle.id }, b.token);
check("list-payouts returns the payout", payouts.length === 1 && payouts[0].recipient_name === amara.name);

const afterPayout = await must("get-circle", { circle_id: circle.id }, a.token);
check("cycle advanced to 2", Number(afterPayout.current_cycle) === 2, `got ${afterPayout.current_cycle}`);

// Second (final) cycle: no contributions confirmed, so the pot is 0 and the circle completes.
const finalPayout = await must("record-payout", { circle_id: circle.id }, a.token);
check("final payout goes to position 2", finalPayout?.recipient_id === b.id, `got ${finalPayout?.recipient_id}`);

const completed = await must("get-circle", { circle_id: circle.id }, a.token);
check("circle is COMPLETED after the last payout", completed.status === "COMPLETED", `got ${completed.status}`);

const payoutAfterEnd = await call("record-payout", { circle_id: circle.id }, a.token);
check("no payouts after completion", payoutAfterEnd.status >= 400, `got ${payoutAfterEnd.status}`);

/* ------------------------------ activity ---------------------------- */
console.log("\nactivity log");
const activity = await must("list-activity", { circle_id: circle.id }, b.token);
const types = activity.map((x) => x.type);
for (const expected of [
  "CIRCLE_CREATED", "MEMBER_INVITED", "MEMBER_JOINED", "CONTRIBUTION_RECORDED",
  "CONTRIBUTION_CONFIRMED", "PAYOUT_RECORDED", "PAYOUT_CONFIRMED", "CIRCLE_STARTED",
]) {
  check(`activity log contains ${expected}`, types.includes(expected));
}
check("activity is newest-first", activity.length > 1 && activity[0].created_at >= activity[activity.length - 1].created_at);

/* ----------------------------- invitations -------------------------- */
console.log("\ninvitations");
const invOwner = await signUp(person("inv-owner", "Ngozi Eze"));
const invGuest = await signUp(person("inv-guest", "Tunde Adeyemi"));
const invOther = await signUp(person("inv-other", "Bisi Lawal"));

const invCircleName = `Invite Circle ${stamp}`;
const invCircle = await must(
  "create-circle",
  {
    name: invCircleName, contribution_amount: 2500, frequency: "MONTHLY", max_members: 5,
    currency: "NGN", description: "Somewhere to test the invitation flow.",
  },
  invOwner.token,
);

const stranger = `stranger.${stamp}@example.com`;
const strangerInvite = await must("invite-member", { circle_id: invCircle.id, email: stranger }, invOwner.token);
check("an address with no account can be invited", strangerInvite?.status === "PENDING", `got ${strangerInvite?.status}`);
check("the invitation is addressed to that email", strangerInvite?.email === stranger, `got ${strangerInvite?.email}`);

const inviteDuplicate = await call("invite-member", { circle_id: invCircle.id, email: stranger }, invOwner.token);
check("a second invitation while one is pending is 409", inviteDuplicate.status === 409, `got ${inviteDuplicate.status}`);

const sentInvites = await must("list-invitations", { circle_id: invCircle.id }, invOwner.token);
check("list-invitations shows the owner their invitations", sentInvites.some((i) => i.id === strangerInvite.id));

const nosyInvites = await call("list-invitations", { circle_id: invCircle.id }, invOther.token);
check("only the owner can list invitations", nosyInvites.status === 403, `got ${nosyInvites.status}`);

const strangerToken = linkToken(strangerInvite.invite_url);
if (!strangerToken) {
  skip("public invitation lookup", "SMTP is configured, so invite_url is not returned");
} else {
  const lookup = await must("get-invitation", { token: strangerToken });
  check("get-invitation works with no session at all", lookup?.circle_id === invCircle.id);
  check("get-invitation names the circle", lookup?.circle_name === invCircleName, `got ${lookup?.circle_name}`);
  check("get-invitation reports the seats left", Number(lookup?.seats_left) === 4, `got ${lookup?.seats_left}`);
  check("get-invitation names the inviter", lookup?.inviter_name === invOwner.name, `got ${lookup?.inviter_name}`);
  check("get-invitation carries the circle terms",
    Number(lookup?.contribution_amount) === 2500 && lookup?.frequency === "MONTHLY");
}

const guestInvite = await must("invite-member", { circle_id: invCircle.id, email: invGuest.email }, invOwner.token);
const guestInbox = await must("my-invitations", {}, invGuest.token);
check("my-invitations lists a pending invitation with its circle",
  guestInbox.some((i) => i.id === guestInvite.id && i.circle_name === invCircleName));

const wrongPerson = await call("respond-invitation", respondTo(guestInvite, "ACCEPT"), invOther.token);
check("someone else cannot accept an invitation", wrongPerson.status === 403, `got ${wrongPerson.status}`);

const accepted = await must("respond-invitation", respondTo(guestInvite, "ACCEPT"), invGuest.token);
check("accepting marks the invitation ACCEPTED", accepted?.status === "ACCEPTED", `got ${accepted?.status}`);

const invMembers = await must("list-members", { circle_id: invCircle.id }, invOwner.token);
const guestMember = invMembers.find((m) => m.user_id === invGuest.id);
check("the invitee is now an ACTIVE member", guestMember?.status === "ACTIVE", `got ${guestMember?.status}`);
check("the invitee takes the next payout position",
  Number(guestMember?.payout_position) === 2, `got ${guestMember?.payout_position}`);

const acceptTwice = await call("respond-invitation", respondTo(guestInvite, "ACCEPT"), invGuest.token);
check("accepting twice fails", acceptTwice.status === 409, `got ${acceptTwice.status}`);

const declineAfterAccept = await call("respond-invitation", respondTo(guestInvite, "DECLINE"), invGuest.token);
check("declining an accepted invitation fails", declineAfterAccept.status === 409, `got ${declineAfterAccept.status}`);

const cancelByMember = await call("cancel-invitation", { invitation_id: strangerInvite.id }, invGuest.token);
check("a member cannot cancel an invitation", cancelByMember.status === 403, `got ${cancelByMember.status}`);

const cancelled = await must("cancel-invitation", { invitation_id: strangerInvite.id }, invOwner.token);
check("the owner can cancel an invitation", cancelled?.status === "CANCELLED", `got ${cancelled?.status}`);

if (strangerToken) {
  const deadLink = await call("get-invitation", { token: strangerToken });
  check("a cancelled invitation link stops working", deadLink.status === 409, `got ${deadLink.status}`);
}

/* ------------------------------ discovery --------------------------- */
console.log("\ndiscovery");
const discOwner = await signUp(person("disc-owner", "Kemi Adebayo"));
const discUser = await signUp(person("disc-user", "Femi Ade"));
const discMember = await signUp(person("disc-member", "Uche Okeke"));

const marker = `disco${stamp}`;
const openCircle = await must(
  "create-circle",
  {
    name: `Open Circle ${marker}`, contribution_amount: 4000, frequency: "WEEKLY", max_members: 3,
    currency: "NGN", visibility: "PUBLIC", starts_at: inDays(6),
    description: `Market women saving together okrika${stamp}`,
  },
  discOwner.token,
);
const privateCircle = await must(
  "create-circle",
  {
    name: `Hidden Circle ${marker}`, contribution_amount: 4000, frequency: "WEEKLY",
    max_members: 4, currency: "NGN", visibility: "PRIVATE",
  },
  discOwner.token,
);
const fullCircle = await must(
  "create-circle",
  {
    name: `Full Circle ${marker}`, contribution_amount: 1000, frequency: "WEEKLY",
    max_members: 2, currency: "NGN", visibility: "PUBLIC",
  },
  discOwner.token,
);
const fullInvite = await must("invite-member", { circle_id: fullCircle.id, email: discMember.email }, discOwner.token);
await must("respond-invitation", respondTo(fullInvite, "ACCEPT"), discMember.token);

const found = await must("list-public-circles", { search: marker }, discUser.token);
const listed = found.find((c) => c.id === openCircle.id);
check("a public pending circle is discoverable", Boolean(listed));
check("discovery reports the seats left", Number(listed?.seats_left) === 2, `got ${listed?.seats_left}`);
check("discovery reports the member count", Number(listed?.members_count) === 1, `got ${listed?.members_count}`);
check("discovery names the owner", listed?.owner_name === discOwner.name, `got ${listed?.owner_name}`);
check("discovery shows when the circle is due to start", Boolean(listed?.starts_at));
check("discovery reports that I have not asked to join", listed?.my_request_status === null, `got ${listed?.my_request_status}`);
check("a private circle never appears", !found.some((c) => c.id === privateCircle.id));
check("a circle with no seats left never appears", !found.some((c) => c.id === fullCircle.id));

const ownersView = await must("list-public-circles", { search: marker }, discOwner.token);
check("a circle you are already in is not offered to you", !ownersView.some((c) => c.id === openCircle.id));

const byDescription = await must("list-public-circles", { search: `OKRIKA${stamp}` }, discUser.token);
check("search matches the description, ignoring case", byDescription.some((c) => c.id === openCircle.id));

const everything = await must("list-public-circles", { search: "" }, discUser.token);
check("an empty search returns everything eligible",
  everything.some((c) => c.id === openCircle.id) || everything.length >= 100,
  `${everything.length} rows`);

/* ---------------------------- join requests ------------------------- */
console.log("\njoin requests");
const jrOwner = await signUp(person("jr-owner", "Sade Ojo"));
const jrUser = await signUp(person("jr-user", "Musa Bello"));
const jrOther = await signUp(person("jr-other", "Halima Sule"));

const jrCircleName = `Request Circle ${stamp}`;
const jrCircle = await must(
  "create-circle",
  {
    name: jrCircleName, contribution_amount: 3000, frequency: "MONTHLY", max_members: 4,
    currency: "NGN", visibility: "PUBLIC", description: "Open to anyone who asks.",
  },
  jrOwner.token,
);

const request = await must("request-to-join", { circle_id: jrCircle.id, message: "I pay on time." }, jrUser.token);
check("request-to-join creates a PENDING request", request?.status === "PENDING", `got ${request?.status}`);

const requestAgain = await call("request-to-join", { circle_id: jrCircle.id }, jrUser.token);
check("a second open request is 409", requestAgain.status === 409, `got ${requestAgain.status}`);

const queue = await must("list-join-requests", { circle_id: jrCircle.id }, jrOwner.token);
const queued = queue.find((r) => r.id === request.id);
check("the owner sees the request", Boolean(queued));
check("the request names the person asking",
  queued?.name === jrUser.name && queued?.email === jrUser.email, `got ${queued?.name} <${queued?.email}>`);
check("the request carries their message", queued?.message === "I pay on time.", `got ${queued?.message}`);

const nosyQueue = await call("list-join-requests", { circle_id: jrCircle.id }, discUser.token);
check("an outsider cannot read the request queue", nosyQueue.status === 403, `got ${nosyQueue.status}`);

const privateAsk = await call("request-to-join", { circle_id: privateCircle.id }, jrUser.token);
check("a private circle refuses join requests", privateAsk.status === 403, `got ${privateAsk.status}`);

const fullAsk = await call("request-to-join", { circle_id: fullCircle.id }, jrUser.token);
check("a full circle refuses join requests", fullAsk.status === 409, `got ${fullAsk.status}`);

const beforeApproval = await must("list-members", { circle_id: jrCircle.id }, jrOwner.token);
const lastPosition = Math.max(...beforeApproval.map((m) => Number(m.payout_position)));

const approved = await must("respond-join-request", { request_id: request.id, action: "APPROVE" }, jrOwner.token);
check("approving marks the request APPROVED", approved?.status === "APPROVED", `got ${approved?.status}`);

const afterApproval = await must("list-members", { circle_id: jrCircle.id }, jrOwner.token);
const joined = afterApproval.find((m) => m.user_id === jrUser.id);
check("an approved requester becomes an ACTIVE member", joined?.status === "ACTIVE", `got ${joined?.status}`);
check("they go to the back of the rotation",
  Number(joined?.payout_position) === lastPosition + 1, `got ${joined?.payout_position}`);

const askAfterApproval = await call("request-to-join", { circle_id: jrCircle.id }, jrUser.token);
check("an approved member cannot ask again", askAfterApproval.status === 409, `got ${askAfterApproval.status}`);

const otherRequest = await must("request-to-join", { circle_id: jrCircle.id }, jrOther.token);
const rejected = await must("respond-join-request", { request_id: otherRequest.id, action: "REJECT" }, jrOwner.token);
check("rejecting marks the request REJECTED", rejected?.status === "REJECTED", `got ${rejected?.status}`);

const afterRejection = await must("list-members", { circle_id: jrCircle.id }, jrOwner.token);
check("a rejection adds nobody to the circle", !afterRejection.some((m) => m.user_id === jrOther.id));

const askAgain = await must("request-to-join", { circle_id: jrCircle.id }, jrOther.token);
check("a rejected person can ask again", askAgain?.status === "PENDING", `got ${askAgain?.status}`);

const wrongCanceller = await call("cancel-join-request", { request_id: askAgain.id }, jrUser.token);
check("only the requester can cancel their request", wrongCanceller.status === 403, `got ${wrongCanceller.status}`);

const cancelledRequest = await must("cancel-join-request", { request_id: askAgain.id }, jrOther.token);
check("the requester can cancel while it is pending", cancelledRequest?.status === "CANCELLED", `got ${cancelledRequest?.status}`);

const cancelTwice = await call("cancel-join-request", { request_id: askAgain.id }, jrOther.token);
check("cancelling twice fails", cancelTwice.status >= 400, `got ${cancelTwice.status}`);

const myRequests = await must("my-join-requests", {}, jrOther.token);
check("my-join-requests names the circle",
  myRequests.some((r) => r.id === askAgain.id && r.circle_name === jrCircleName));

/* --------------------------- scheduled start ------------------------ */
console.log("\nscheduled start");
const schedOwner = await signUp(person("sched-owner", "Ifeanyi Nwachukwu"));
const schedMember = await signUp(person("sched-member", "Zainab Yusuf"));

const plannedStart = inDays(3);
const plannedDescription = "Starts in three days, so there is time to invite people.";
const planned = await must(
  "create-circle",
  {
    name: `Scheduled Circle ${stamp}`, contribution_amount: 6000, frequency: "MONTHLY",
    max_members: 4, currency: "NGN", starts_at: plannedStart, visibility: "PRIVATE",
    description: plannedDescription,
  },
  schedOwner.token,
);
check("create-circle accepts a scheduled start",
  new Date(planned?.starts_at).getTime() === new Date(plannedStart).getTime(), `got ${planned?.starts_at}`);
check("create-circle keeps the visibility", planned?.visibility === "PRIVATE", `got ${planned?.visibility}`);
check("create-circle keeps the description", planned?.description === plannedDescription, `got ${planned?.description}`);

const readBack = await must("get-circle", { circle_id: planned.id }, schedOwner.token);
check("get-circle returns the scheduled start",
  new Date(readBack?.starts_at).getTime() === new Date(plannedStart).getTime(), `got ${readBack?.starts_at}`);
check("get-circle returns visibility and description",
  readBack?.visibility === "PRIVATE" && readBack?.description === plannedDescription);
check("a scheduled circle stays PENDING until its date", readBack?.status === "PENDING", `got ${readBack?.status}`);

const pastStart = await call(
  "create-circle",
  {
    name: `Backdated Circle ${stamp}`, contribution_amount: 1000, frequency: "WEEKLY",
    max_members: 2, currency: "NGN", starts_at: inDays(-1),
  },
  schedOwner.token,
);
check("a start date in the past is rejected", pastStart.status === 400, `got ${pastStart.status}`);

const reopened = await must(
  "update-circle-rules",
  {
    circle_id: planned.id, frequency: "WEEKLY", contribution_amount: 6500,
    visibility: "PUBLIC", description: "Now open to anyone.",
    rules: { grace_period_days: 2, late_fee: 100 },
  },
  schedOwner.token,
);
check("update-circle-rules can open a pending circle up", reopened?.visibility === "PUBLIC", `got ${reopened?.visibility}`);
check("update-circle-rules leaves a schedule it was not asked to change",
  new Date(reopened?.starts_at).getTime() === new Date(plannedStart).getTime(), `got ${reopened?.starts_at}`);

// There is no cron in this runtime: a due circle is promoted on the next read of it.
const dueAt = Date.now() + 4000;
const scheduled = await must(
  "create-circle",
  {
    name: `Auto Start Circle ${stamp}`, contribution_amount: 1200, frequency: "WEEKLY",
    max_members: 3, currency: "NGN", starts_at: new Date(dueAt).toISOString(),
  },
  schedOwner.token,
);
check("a scheduled circle is created PENDING at cycle 0",
  scheduled?.status === "PENDING" && Number(scheduled?.current_cycle) === 0);

const autoInvite = await must("invite-member", { circle_id: scheduled.id, email: schedMember.email }, schedOwner.token);
await must("respond-invitation", respondTo(autoInvite, "ACCEPT"), schedMember.token);

await sleep(Math.max(0, dueAt - Date.now()) + 1000);
const autoStarted = await must("get-circle", { circle_id: scheduled.id }, schedOwner.token);
check("a due circle with 2 members auto-starts when it is read",
  autoStarted?.status === "ACTIVE", `got ${autoStarted?.status}`);
check("auto-start opens cycle 1", Number(autoStarted?.current_cycle) === 1, `got ${autoStarted?.current_cycle}`);

const autoLog = await must("list-activity", { circle_id: scheduled.id }, schedMember.token);
check("auto-start is written to the activity log", autoLog.some((x) => x.type === "CIRCLE_STARTED"));

/* -------------------------------- admin ----------------------------- */
console.log("\nadmin");
for (const resource of ["admin-overview", "admin-list-circles", "admin-list-users", "admin-list-emails"]) {
  const denied = await call(resource, {}, jrUser.token);
  check(`${resource} is 403 for a normal user`, denied.status === 403, `got ${denied.status}`);
}

/**
 * The admin is seeded by signing up with an address the server treats as one. Re-runs find the
 * account already there, so fall back to signing in with the same password.
 */
const adminEmail = (process.env.SMOKE_ADMIN_EMAIL ?? (process.env.ADMIN_EMAILS ?? "").split(",")[0]).trim();
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "smoke-admin-password";
let admin = null;

if (adminEmail) {
  const ip = nextIp();
  const seeded = await call("sign-up", { name: "Smoke Admin", email: adminEmail, password: adminPassword }, undefined, ip);
  const session = seeded.status < 400
    ? seeded
    : await call("sign-in", { email: adminEmail, password: adminPassword }, undefined, ip);

  if (session.status < 400 && session.body?.token) {
    ipByToken.set(session.body.token, ip);
    const whoami = await call("me", {}, session.body.token);
    if (whoami.body?.role === "ADMIN") admin = session.body;
  }
}

if (!admin) {
  skip(
    "admin reads",
    `no admin account available — skipped (set ADMIN_EMAILS=<address> for the server, and ` +
      `SMOKE_ADMIN_PASSWORD if that account already exists)`,
  );
} else {
  const overview = await must("admin-overview", {}, admin.token);
  check("admin-overview counts users and circles",
    Number(overview?.users) >= 5 && Number(overview?.circles) >= 4,
    `users ${overview?.users}, circles ${overview?.circles}`);
  check("admin-overview keeps verified users inside the total",
    Number(overview.verified_users) <= Number(overview.users),
    `${overview.verified_users} of ${overview.users}`);
  check("admin-overview totals the money saved", Number(overview.total_saved) >= 10000, `got ${overview.total_saved}`);
  check("admin-overview counts invitations still waiting",
    Number(overview.pending_invitations) >= 1, `got ${overview.pending_invitations}`);

  const allCircles = await must("admin-list-circles", {}, admin.token);
  const foreign = allCircles.find((c) => c.id === jrCircle.id);
  check("admin-list-circles includes a circle the admin is not in", Boolean(foreign));
  check("admin-list-circles carries the owner and the progress",
    foreign?.owner_email === jrOwner.email && Number(foreign?.members_count) >= 2,
    `${foreign?.owner_email}, ${foreign?.members_count} members`);

  const allUsers = await must("admin-list-users", {}, admin.token);
  check("admin-list-users includes this run's users", allUsers.some((u) => u.email === jrUser.email));

  const outbox = await must("admin-list-emails", {}, admin.token);
  check("admin-list-emails shows the invitation that went out",
    outbox.some((e) => e.to_email === stranger), `${outbox.length} rows`);

  const adminRead = await must("get-circle", { circle_id: jrCircle.id }, admin.token);
  check("an admin can read any circle", adminRead?.id === jrCircle.id);

  const adminMembers = await must("list-members", { circle_id: jrCircle.id }, admin.token);
  check("an admin sees the members of a circle they are not in", adminMembers.length >= 2, `got ${adminMembers.length}`);

  const adminDash = await must("get-dashboard", { circle_id: jrCircle.id }, admin.token);
  check("an admin sees the same dashboard as the leader", adminDash?.id === jrCircle.id);

  const outsiderRead = await call("get-circle", { circle_id: jrCircle.id }, discMember.token);
  check("a normal non-member still cannot read it", outsiderRead.status === 403, `got ${outsiderRead.status}`);

  const adminWrite = await call("invite-member", { circle_id: jrCircle.id, email: `nope.${stamp}@example.com` }, admin.token);
  check("an admin cannot write to a circle they do not own", adminWrite.status === 403, `got ${adminWrite.status}`);

  // Answering the queue is the one write an admin may make on someone else's circle.
  const queuedForAdmin = await must("request-to-join", { circle_id: jrCircle.id }, discUser.token);
  const adminDecision = await must("respond-join-request", { request_id: queuedForAdmin.id, action: "APPROVE" }, admin.token);
  check("an admin can answer a join request", adminDecision?.status === "APPROVED", `got ${adminDecision?.status}`);

  const adminAdded = await must("list-members", { circle_id: jrCircle.id }, jrOwner.token);
  check("the admin's approval added the member", adminAdded.some((m) => m.user_id === discUser.id));
}

/* ------------------------------- logout ----------------------------- */
console.log("\nlogout");
await must("logout", { tokens: [b.token] });
const afterLogout = await call("list-my-circles", {}, b.token);
check("a revoked token is rejected", afterLogout.status === 401, `got ${afterLogout.status}`);

const stillValid = await call("list-my-circles", {}, a.token);
check("other sessions keep working", stillValid.status === 200, `got ${stillValid.status}`);

/* ------------------------------ summary ----------------------------- */
console.log(`\n${passed} passed, ${failures.length} failed${skipped ? `, ${skipped} skipped` : ""}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
  process.exit(1);
}
console.log("All good — the self-hosted runtime behaves like the Sub0 contract.");
