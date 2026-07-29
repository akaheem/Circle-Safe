# CircleSafe — Project Description

**Tagline:** Trustworthy Ajo. Every naira accounted for.

---

## Short version (for character-limited fields)

CircleSafe is a transparent, append-only system of record for rotating savings circles — *Ajo*,
*Esusu*, *Susu*, *Tontine* — the informal groups that move enormous amounts of money across West
Africa every week on nothing but a notebook and trust. It replaces the notebook with a shared,
auditable ledger: every contribution and payout is recorded by one person and confirmed by
another, the rules are frozen before the money moves, and every member sees the same numbers live.
Years of reliable payments become a Trust Score — the portable financial history the tradition
never produced.

---

## The problem

A rotating savings circle works like this: ten traders each contribute ₦5,000 a week, and each
week the ₦50,000 pot goes to one member until everyone has taken a turn. It is one of the most
widely used savings instruments in West Africa — and it runs on paper.

That creates four failure modes people live with today:

- **Fraud.** The collector disappears with the pot, and there is no independent record to point to.
- **Lost records.** The notebook goes missing or the WhatsApp group is deleted, and nobody can
  prove who paid.
- **Disputes.** "I paid you last Tuesday." "You didn't." "Whose turn is it now?"
- **No financial history.** Years of disciplined, on-time payments produce zero credit signal that
  a bank or lender will accept.

The tradition works. The bookkeeping doesn't. People are not asking for a replacement for Ajo —
they are asking for a record they can trust.

## The solution

CircleSafe keeps the tradition intact and replaces only the notebook.

- **Append-only ledger.** Every action writes a row to an activity log that is never updated and
  never deleted. The audit trail *is* the data model, not a feature bolted on top.
- **Two-party confirmation.** A member records their contribution; a treasurer or the circle owner
  confirms it. Neither side can move money in the record alone.
- **Rules locked before the money moves.** Contribution amount, rhythm, grace period, late fee and
  the full payout order are agreed while a circle is `PENDING`, using a drag-and-drop rules
  builder, and freeze the moment it goes `ACTIVE` — enforced in SQL, not just in the UI.
- **Trust Score.** Each member's reliability — confirmed contributions ÷ cycles elapsed — computed
  live from the ledger. This is the portable financial history informal savings never produced.
- **Circle Health.** One number for whether a circle is actually collecting what it is owed, so
  trouble is visible while there is still time to act.
- **Live shared truth.** Every mutation pushes to every member in real time, so disputes start
  from one set of numbers instead of four different recollections.

**How it's built.** The backend is designed for **Sub0** as declarative JSON — models plus ABI
endpoints, with no hand-written server code — using `hashables` for BCRYPT, `tokenize`/`protected`
for JWT auth, `payload_validation`, `rate_limit`, action chaining via `depends_on`, cached
aggregations for the scores, and WebSocket broadcasts on every lifecycle event. It's deployed on
**LingoQL** (managed PostgreSQL, backend service, SSR frontend, TLS). The running app implements
that same contract across **39 resources over 11 tables**, with the frontend in Next.js 16, React
19, TypeScript and Tailwind.

## Target user

**Primary:** members and organizers of informal rotating savings circles in West Africa — market
traders, artisans, drivers, small-business owners, salaried colleagues running an office Ajo. The
person who feels the pain most sharply is the **circle owner or treasurer**, who today carries all
the bookkeeping and all the suspicion personally, and the **member** who has no way to prove what
they paid.

**Also directly served:** student and youth savings groups (the kind HolyDigits101's 70,000+ West
African students run among themselves), cooperative and market associations that manage several
circles at once, and diaspora contributors sending money into a circle back home who currently
have the least visibility of anyone.

These are people who already save this way. CircleSafe does not need to teach a new financial
behaviour — only to give an existing one a record.

## Why it matters

Rotating savings circles are, for millions of people, the *only* functioning financial
infrastructure they have — no bank account required, no credit check, no paperwork. When one
collapses through fraud or a lost notebook, the loss isn't an inconvenience; it's a family's
school fees or a trader's restock money, and the trust that made the group possible doesn't come
back.

CircleSafe attacks that on two fronts. In the short term it removes the single points of failure —
one person's memory, one person's notebook, one person's honesty — by making every movement of
money a two-party, timestamped, undeletable record everyone can see. In the long term it converts
a decade of invisible financial discipline into a Trust Score: evidence a lender can read. That is
the bridge from informal savings to formal credit that hundreds of millions of people currently
have no way to cross.

It is a small change to how a circle operates and a large change to what a circle can prove.
