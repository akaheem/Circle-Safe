#!/usr/bin/env node
/**
 * Applies lib/server/schema.sql to $DATABASE_URL once, so you can verify the connection and the
 * schema before starting the app. The server also applies it lazily on first request; this is the
 * explicit version with a readable error if the connection is wrong.
 *
 *   DATABASE_URL="postgres://..." npm run db:init
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "lib", "server", "schema.sql");
const sql = readFileSync(schemaPath, "utf8");

const needsSsl = process.env.DATABASE_SSL === "true" || /sslmode=require/.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(sql);

  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE '\\_%'
     ORDER BY table_name`,
  );
  console.log("Schema applied. Tables:");
  for (const row of rows) console.log(`  ${row.table_name}`);

  const expected = ["_activity", "_circles", "_contributions", "_memberships", "_payouts", "_users"];
  const missing = expected.filter((t) => !rows.some((r) => r.table_name === t));
  if (missing.length) {
    console.error(`\nMissing tables: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("\nAll six CircleSafe tables are present.");
} catch (err) {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
