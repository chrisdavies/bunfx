/**
 * SQLite utilities for Bun SQL.
 */

import { SQL } from "bun";

/**
 * Create a SQLite connection with sensible defaults.
 *
 * - WAL mode for better concurrency
 * - Foreign keys enabled
 * - 5s busy timeout
 * - 20MB cache
 */
export async function makeSQLite(url: string): Promise<SQL> {
  const sql = new SQL(url);
  await sql`PRAGMA journal_mode = WAL`;
  await sql`PRAGMA synchronous = NORMAL`;
  await sql`PRAGMA foreign_keys = ON`;
  await sql`PRAGMA busy_timeout = 5000`;
  await sql`PRAGMA cache_size = -20000`;
  return sql;
}

/**
 * Run SQLite maintenance tasks.
 *
 * - PRAGMA optimize: Analyzes tables that need it
 * - VACUUM (optional): Rebuilds the database file to reclaim space
 */
export async function runSQLiteMaintenance(opts: {
  sql: SQL;
  vacuum?: boolean;
}): Promise<void> {
  await opts.sql`PRAGMA optimize`;
  if (opts.vacuum) {
    await opts.sql`VACUUM`;
  }
}
