/**
 * Core migration logic.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TransactionSQL } from "bun";
import { SQL } from "bun";

export type Migration = {
  up(sql: TransactionSQL): Promise<void>;
  down(sql: TransactionSQL): Promise<void>;
};

export type Command = "new" | "up" | "down" | "sync";

export type Options = {
  command: Command;
  connectionString: string;
  migrationsDirectory: string;
  name?: string;
};

type RunnerOptions = Options & {
  tx: TransactionSQL;
  isPostgres: boolean;
  tableName: SQL.Query<unknown>;
};

type Runner = (opts: RunnerOptions) => Promise<void>;

const commands: Record<Command, Runner> = { new: newMigration, up, down, sync };

export async function migrate(opts: Options) {
  const command = commands[opts.command];
  const sql = new SQL(opts.connectionString);
  const isPostgres = opts.connectionString.startsWith("postgres");
  const tableName = sql(isPostgres ? "bunfx.migrations" : "bunfx_migrations");
  try {
    await sql.begin(async (tx) => {
      const runnerOpts: RunnerOptions = { ...opts, tx, isPostgres, tableName };
      await ensureMigrationsTable(runnerOpts);
      await command(runnerOpts);
    });
  } finally {
    sql.close();
  }
}

async function ensureMigrationsTable(opts: RunnerOptions): Promise<void> {
  const { tx, isPostgres, tableName } = opts;
  if (isPostgres) {
    await tx`CREATE SCHEMA IF NOT EXISTS bunfx`;
  }
  await tx`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      migrated_on TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      source_code TEXT NOT NULL
    )
  `;
}

async function getAppliedMigrations(opts: RunnerOptions) {
  const ids = await opts.tx<
    { id: string }[]
  >`SELECT id FROM ${opts.tableName} ORDER BY id ASC`;
  return ids.map((x) => x.id);
}

function getMigrationFiles(opts: RunnerOptions) {
  return fs
    .readdirSync(opts.migrationsDirectory)
    .filter((x) => x.endsWith(".ts"))
    .sort((a, b) => a.localeCompare(b));
}

async function bundleMigration(filepath: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [filepath],
    target: "bun",
  });

  if (!result.success) {
    throw new Error(`Failed to bundle migration: ${result.logs.join("\n")}`);
  }

  const output = result.outputs[0];
  if (!output) {
    throw new Error("No output from bundler");
  }

  return output.text();
}

async function down(opts: RunnerOptions) {
  const rows = await getAppliedMigrations(opts);
  const filename = rows[rows.length - 1];
  if (!filename) {
    console.log("Nothing to do.");
    return;
  }
  await migrateDownFromFile(
    opts,
    path.join(opts.migrationsDirectory, filename),
  );
}

async function sync(opts: RunnerOptions) {
  const rows = await getAppliedMigrations(opts);
  const files = getMigrationFiles(opts);
  if (process.env.NODE_ENV === "production") {
    throw new Error(`migrate sync is not supported in production.`);
  }
  const badIndex = rows.findIndex((id, i) => files[i] !== id);
  if (badIndex < 0 && rows.length === files.length) {
    console.log("Nothing to do.");
    return;
  }
  const toRollback = rows
    .slice(badIndex < 0 ? files.length : badIndex)
    .reverse();
  for (const filename of toRollback) {
    const tmp = path.join(os.tmpdir(), filename);
    const [row] = await opts.tx<Array<{ sourceCode: string }>>`
      SELECT source_code "sourceCode"
      FROM ${opts.tableName}
      WHERE id = ${filename}
    `;
    if (!row) {
      throw new Error(`Migration ${filename} not found.`);
    }
    fs.writeFileSync(tmp, row.sourceCode, "utf8");
    await migrateDownFromFile(opts, tmp);
    fs.rmSync(tmp);
  }

  await up(opts);
}

async function loadMigration(filename: string) {
  const migration: Migration = (await import(filename)).default;
  return migration;
}

async function migrateDownFromFile(opts: RunnerOptions, filepath: string) {
  const { tx } = opts;
  if (!fs.existsSync(filepath)) {
    throw new Error(`Migration not found ${filepath}`);
  }
  console.log("Down:", filepath);
  const migration = await loadMigration(filepath);
  await migration.down(tx);
  await tx`DELETE FROM ${opts.tableName} WHERE id = ${path.basename(filepath)}`;
}

async function up(opts: RunnerOptions) {
  const rows = await getAppliedMigrations(opts);
  const files = getMigrationFiles(opts);
  if (rows.length > files.length) {
    throw new Error(`Migrations in the DB are ahead of migrations on disk.`);
  }
  const badIndex = rows.findIndex((id, i) => files[i] !== id);
  if (badIndex >= 0) {
    throw new Error(
      `Migration ${rows[badIndex]} does not match disk ${files[badIndex]}`,
    );
  }
  const pending = files.slice(rows.length);
  if (!pending.length) {
    console.log("Database is up to date.");
    return;
  }
  for (const file of pending) {
    console.log("Up:", file);
    const filepath = path.join(opts.migrationsDirectory, file);
    const sourceCode = await bundleMigration(filepath);
    const migration = await loadMigration(filepath);
    await migration.up(opts.tx);
    await opts.tx`
      INSERT INTO ${opts.tableName} ${opts.tx({
      id: file,
      migrated_on: new Date().toISOString(),
      source_hash: Bun.hash(sourceCode).toString(),
      source_code: sourceCode,
    })}
    `;
  }
  console.log("Applied", pending.length, "migrations");
}

async function newMigration(opts: RunnerOptions) {
  if (!opts.name) {
    throw new Error(`Migration name is required.`);
  }

  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[-:T]/g, "")
    .slice(0, 14);
  const name = opts.name.replaceAll(/[_\s]+|[/\\:*?"<>|.\p{Cc}]+/gu, "-");
  const filename = path.join(
    opts.migrationsDirectory,
    `${timestamp}-${name}.ts`,
  );
  fs.mkdirSync(opts.migrationsDirectory, { recursive: true });
  const template = `import type { Migration } from "bunfx";

export default {
  async up(sql) {
    // await sql\`CREATE TABLE ...\`;
  },

  async down(sql) {
    // await sql\`DROP TABLE ...\`;
  },
} satisfies Migration;
`;
  fs.writeFileSync(filename, template, "utf8");
  console.log(`Created ${filename}`);
}
