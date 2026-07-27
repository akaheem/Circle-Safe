import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, types as pgTypes, type PoolClient } from "pg";

// Postgres NUMERIC (OID 1700) → JavaScript number. The storage type is NUMERIC(14,2) for
// exact-decimal currency arithmetic; parsing to float64 is safe in that range, and the app is
// built around JavaScript numbers throughout the client + mock. A future version with millions
// of rows may want a more precise server-side aggregation, but for a savings group of ~10-50
// people this avoids spreading string-to-number boilerplate across every handler.
pgTypes.setTypeParser(1700, parseFloat);

/**
 * Postgres access for the self-hosted runtime.
 *
 * The pool is cached on globalThis so Next.js dev hot-reloads don't leak connections.
 * `DATABASE_URL` is required; `?sslmode=require` (or DATABASE_SSL=true) for hosted Postgres
 * like Neon or Supabase.
 */

declare global {
  // eslint-disable-next-line no-var
  var __circlesafePool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __circlesafeSchema: Promise<void> | undefined;
}

export function pool(): Pool {
  if (!globalThis.__circlesafePool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — the self-hosted API cannot start.");
    }
    const needsSsl =
      process.env.DATABASE_SSL === "true" || /sslmode=require/.test(connectionString);
    globalThis.__circlesafePool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__circlesafePool;
}

/** Applies schema.sql once per process. Safe to call on every request. */
export function ensureSchema(): Promise<void> {
  if (!globalThis.__circlesafeSchema) {
    globalThis.__circlesafeSchema = (async () => {
      let sql: string;
      try {
        sql = readFileSync(join(process.cwd(), "lib", "server", "schema.sql"), "utf8");
      } catch {
        throw new Error(
          "Could not read lib/server/schema.sql. Apply it manually once: " +
            'psql "$DATABASE_URL" -f lib/server/schema.sql',
        );
      }
      await pool().query(sql);
    })().catch((err) => {
      globalThis.__circlesafeSchema = undefined; // let the next request retry
      throw err;
    });
  }
  return globalThis.__circlesafeSchema;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query(sql, params);
  return result.rows as T[];
}

/**
 * Runs `fn` inside a transaction. Sub0 endpoints chain several actionables against one
 * request (insert + audit row + counter bump); wrapping them in a transaction gives the
 * self-hosted runtime the same all-or-nothing behaviour.
 */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
