/**
 * Mirrors Sub0's `read_from_cache` / `cache_key` / `duration` for the heavy aggregations
 * (`get-trust-score`, `get-circle-health`, `get-insights` — 60s each). `get-dashboard` is
 * deliberately uncached so live numbers stay live.
 *
 * In-process, like the rate limiter: per instance, cleared on restart.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __circlesafeCache: Map<string, Entry> | undefined;
}

const store = (globalThis.__circlesafeCache ??= new Map<string, Entry>());

export async function cached<T>(key: string, seconds: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await load();
  store.set(key, { value, expiresAt: now + seconds * 1000 });

  if (store.size > 5_000) {
    for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
  }
  return value;
}

/** Called after mutations so a member never sees their own action as stale. */
export function invalidateCircle(circleId: string): void {
  for (const key of store.keys()) {
    if (key.endsWith(`_${circleId}`)) store.delete(key);
  }
}
