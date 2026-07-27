# Real-time (WebSockets) — how CircleSafe does live updates

CircleSafe does NOT need a separate socket server. Real-time dashboard updates are achieved
with Sub0's native `broadcast_websocket_message`, already added to every state-changing
endpoint that affects the dashboard:
- `start-circle`, `join-circle`, `record-contribution`, `confirm-contribution`,
  `record-payout`, `confirm-payout-received`

Each of those broadcasts `{ broadcast_type: "ALL", action: "circle_update" }` after its
mutation commits.

## Setup (env vars in Sub0/LingoQL)
- `ALLOW_WEBSOCKET_CONNECTIONS=true`  (required to enable the `/ws` route)
- Optional: `FORCE_WEBSOCKET_WITH_UID=true` if you want every socket to carry a uid.

## Frontend flow (for later, when UI is unblocked)
1. Open a socket: `new WebSocket("wss://<SUB0_URL>/ws?uid=<userId>")`.
   For protected calls over WS, pass the token as a subprotocol:
   `new WebSocket(url, ["x-access-token", "<jwt>"])`.
2. Load initial data by calling the `get-dashboard` resource (over HTTP or WS).
3. Listen for messages; when `action === "circle_update"` arrives, re-fetch
   `get-dashboard` / `get-insights` / `list-activity` for the open circle.

## Note
`get-dashboard` is intentionally NOT cached so it always returns fresh numbers after a
broadcast. The heavier `get-trust-score` / `get-circle-health` / `get-insights` are cached
(60s) since they tolerate slight staleness.
