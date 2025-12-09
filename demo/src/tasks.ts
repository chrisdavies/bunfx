import { runSQLiteMaintenance } from "bunfx/server";
import { config } from "./config";
import { sql } from "./db";

const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function logErr(err: unknown): void {
  console.error(err);
}

/**
 * Delete expired secrets and secrets that have reached their download limit.
 */
async function cleanupSecrets(): Promise<void> {
  const now = new Date().toISOString();
  const result = await sql`
    DELETE FROM secrets
    WHERE expires_at < ${now} OR download_count >= max_downloads
  `;
  const count = result.length;
  if (count > 0) {
    console.log(`Cleaned up ${count} expired/exhausted secrets`);
  }
}

/**
 * Creates a maintenance function that runs once per day after the configured time.
 * Vacuums on Sundays.
 */
function makeMaintenanceFn() {
  let lastRun: Date | undefined;

  return async function runMaintenance(): Promise<void> {
    const now = new Date();

    // Already ran today
    if (lastRun?.toDateString() === now.toDateString()) return;

    // Only run after the maintenance time
    const utcTime = now.toISOString().slice(11, 16);
    if (utcTime < config.MAINTENANCE_TIME_UTC) return;

    lastRun = now;
    const isWeekly = now.getUTCDay() === 0; // Sunday

    await runSQLiteMaintenance({ sql, vacuum: isWeekly });
    console.log(
      `SQLite maintenance complete${isWeekly ? " (with vacuum)" : ""}`,
    );
  };
}

export function startBackgroundTasks(): void {
  const runMaintenance = makeMaintenanceFn();

  async function tick(): Promise<void> {
    await cleanupSecrets().catch(logErr);
    await runMaintenance().catch(logErr);
    setTimeout(tick, TICK_INTERVAL_MS);
  }

  setTimeout(tick, TICK_INTERVAL_MS);

  console.log("Background tasks started");
}
