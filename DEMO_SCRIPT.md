# CircleSafe — demo video script (3–5 min)

Judging weights this script is built around: Technical 30% · Innovation 25% · Utility 25% ·
Presentation 20%. So: show the product working, then show the Sub0 code that makes it work.

## Before you hit record

- [ ] Two browser windows side by side: **left = Amara (owner)**, **right = John (member)**.
      Not tabs — the live update only lands if both are visible at once.
- [ ] **Seed one mature circle first** ("Lagos Traders Circle", 4 members, run it to cycle 3 with
      confirmed contributions and one recorded payout). Empty charts and 100% trust scores
      demo badly; a circle with history makes the Trust and Health screens mean something.
- [ ] Leave a **second circle in `PENDING`** so you can demo the Rules Builder unlocked.
- [ ] One editor window with `backend/endpoints/contributions/record-contribution.json` and
      `backend/endpoints/scores/get-trust-score.json` already open.
- [ ] Zoom the browser to ~110–125% so text is readable in a compressed video.
- [ ] Close notifications. Record at 1080p.

---

## 0:00–0:30 · The problem (landing page)

> "Across West Africa, millions save through rotating circles — Ajo, Esusu, Susu. Ten traders each
> put in ₦5,000 a week; every week the pot goes to one member. It works. But it runs on a notebook.
> The collector disappears, the notebook is lost, and nobody can prove who paid."

Scroll the landing page slowly through the hero and the four feature cards. Land on the security
section.

> "CircleSafe keeps the tradition and replaces the notebook — with an append-only ledger."

## 0:30–1:15 · Set up a circle (Rules Builder ⭐)

Open the `PENDING` circle → **Members** tab.

> "The owner invites members by email."

Invite John. Switch to the right window: John opens the circle and hits **Accept invite**.

Back on the left → **Rules & Order** tab. This is the money shot.

> "Then the rules — before any money moves. Contribution amount, weekly or monthly, grace period,
> late fee. And the payout order: who gets the pot in which cycle."

**Drag two members to reorder.** Then click **Random draw**.

> "Or draw it randomly, the way a physical ballot works."

Hit **Save rules & order**, then **Start circle**. Return to Rules & Order.

> "The moment the circle goes active, the rules lock — and not just in the interface. The SQL only
> updates a circle where status is still PENDING. You cannot change the deal mid-cycle."

## 1:15–2:15 · The live loop (the core value)

Right window (John) → **Record my contribution**.

> "A member records their contribution…"

**Point at the left window updating on its own.**

> "…and every other member sees it instantly. No refresh. That's a native Sub0 WebSocket broadcast
> fired by the endpoint itself — there's no socket server in this project."

Left window → **Ledger** → **Confirm**.

> "The treasurer or owner confirms it. Two different people have to act before the record says money
> arrived — that's the fraud control. And the SQL enforces the role: confirming requires an EXISTS
> check that you're the owner or treasurer *of this circle*."

→ **Payouts** tab.

> "Payouts follow the order we set. The owner records the cycle payout — Sub0 sums the confirmed
> contributions, pays the member at that position, and advances the cycle in one chained action."

Record the payout. Switch to the recipient's window → **I received this**.

> "And the recipient confirms receipt. Both sides of every transfer are on the record."

## 2:15–3:00 · The innovation: trust that travels

→ **Trust & Health** tab.

> "Everything here is computed from the ledger, never stored. Each member's Trust Score is confirmed
> contributions over cycles elapsed — years of reliable saving finally become a portable financial
> history, which is what informal savers have never had. Circle Health is one number for whether the
> group is actually collecting what it's owed."

→ **Activity** tab, scroll to the bottom of the log.

> "And every action wrote one row here. Append-only — no endpoint in the system can update or delete
> it. When there's a dispute, this is the answer."

## 3:00–4:00 · Under the hood (the 30%)

Switch to the editor. `record-contribution.json`.

> "The backend is Sub0 — declarative JSON, zero hand-written server code. This one endpoint shows
> most of it: payload validation, a rate limit keyed on the caller's IP, `protected` so the user ID
> comes from the verified JWT and never from the request body. Then chained actionables —
> `depends_on` reads the current cycle and amount, the next action inserts the contribution, the
> third writes the audit row, and the broadcast goes out."

Open `get-trust-score.json`.

> "Trust scores are a cached aggregation — 60 seconds, so the heavy query stays cheap. The live
> dashboard is deliberately *not* cached. Passwords are BCRYPT via Sub0's `hashables`; logout
> revokes the token with `invalidate_tokenize`; every query is parameterized."

*(Optional, if you have time: show the LingoQL console — Postgres, the Sub0 service, the Next.js
service, all on one platform with TLS.)*

## 4:00–4:30 · Close

> "Six tables, twenty-three endpoints, no server code. Postgres, backend, and frontend all on
> LingoQL. CircleSafe doesn't ask anyone to change how they save — it just makes the record
> impossible to lose, and impossible to fake."

Live URL on screen. End.

---

## Notes

- **If the deployed backend is misbehaving on recording day:** run the frontend in demo mode
  (unset `NEXT_PUBLIC_API_URL`) — every flow works against the in-memory mock, and the "Demo mode"
  banner is honest about it. Say so in one line rather than hiding it; then still show the Sub0
  endpoint JSON, which is the part being scored.
- **Cut first if you're over time:** the landing-page scroll (0:00–0:30 → 15s) and the optional
  LingoQL console tour. Never cut the live-update moment or the endpoint walkthrough.
- Say "Sub0" and "LingoQL" out loud — judges are scoring platform usage explicitly.
