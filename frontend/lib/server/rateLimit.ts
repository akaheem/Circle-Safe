import { tooMany } from "./errors";

/**
 * Mirrors Sub0's `rate_limit: { limit, identifier: $HEADER.ip, expires_after }`.
 *
 * In-process fixed window. That's per instance, so it's a speed bump rather than a hard
 * guarantee behind multiple replicas — noted in SELF_HOSTING.md. Move to Redis if this
 * ever runs multi-instance.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __circlesafeBuckets: Map<string, Bucket> | undefined;
}

const buckets = (globalThis.__circlesafeBuckets ??= new Map<string, Bucket>());

export function enforceRateLimit(key: string, limit: number, windowSeconds: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw tooMany(`Too many requests — try again in ${seconds}s`);
  }
}
