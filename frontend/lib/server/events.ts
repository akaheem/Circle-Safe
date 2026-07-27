/**
 * Stands in for Sub0's `broadcast_websocket_message`.
 *
 * Sub0 pushes `{ action: "circle_update" }` over its own WebSocket after a mutation commits.
 * Self-hosted, Next.js route handlers can't hold a WebSocket, so we broadcast the identical
 * payload over Server-Sent Events (`GET /api/events`) and the client hook treats both the same.
 *
 * The subscriber set is in-process: fine for a single Node instance (`next start` on Render /
 * Railway / a VPS), not for serverless or multi-replica. See SELF_HOSTING.md.
 */

export interface LiveMessage {
  action: "circle_update";
  circle_id?: string;
}

type Listener = (message: LiveMessage) => void;

/**
 * A subscriber and the circles it is allowed to hear about. `visible` is asked per message
 * rather than captured once, so a membership gained (or lost) mid-stream takes effect without
 * the client reconnecting — the stream is long-lived and a snapshot would go stale.
 */
interface Subscriber {
  listener: Listener;
  visible: (circleId: string) => Promise<boolean>;
}

declare global {
  // eslint-disable-next-line no-var
  var __circlesafeListeners: Set<Subscriber> | undefined;
}

const listeners = (globalThis.__circlesafeListeners ??= new Set<Subscriber>());

export function subscribe(
  listener: Listener,
  visible: (circleId: string) => Promise<boolean>,
): () => void {
  const subscriber: Subscriber = { listener, visible };
  listeners.add(subscriber);
  return () => listeners.delete(subscriber);
}

/**
 * Fans a mutation out to the subscribers entitled to see it. Delivery is filtered per
 * subscriber: a circle's updates reach that circle's members, not every open stream.
 *
 * Deliberately not awaited by callers — a slow membership lookup must not hold up the request
 * that committed the mutation.
 */
export function broadcast(circleId?: string): void {
  const message: LiveMessage = { action: "circle_update", circle_id: circleId };
  for (const { listener, visible } of listeners) {
    void (async () => {
      try {
        // A message with no circle attached is a global ping; nobody's data rides on it.
        if (circleId && !(await visible(circleId))) return;
        listener(message);
      } catch {
        /* a dead stream shouldn't break the request that triggered the broadcast */
      }
    })();
  }
}

export const subscriberCount = () => listeners.size;
