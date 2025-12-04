import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SQL } from "bun";
import { migrate } from "./migrate.ts";

const TEST_DIR = path.join(import.meta.dir, ".test-migrations");
const MIGRATIONS_DIR = path.join(TEST_DIR, "migrations");
const DB_PATH = path.join(TEST_DIR, "test.db");
const CONNECTION_STRING = `sqlite://${DB_PATH}`;

function createMigration(id: string, up: string, down: string): void {
  const content = `import type { Migration } from "./migrate.ts";

export default {
  async up(sql) {
    await sql\`${up}\`;
  },
  async down(sql) {
    await sql\`${down}\`;
  },
} satisfies Migration;
`;
  writeFileSync(path.join(MIGRATIONS_DIR, id), content);
}

async function getAppliedMigrations(): Promise<string[]> {
  const sql = new SQL(CONNECTION_STRING);
  try {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM bunfx_migrations ORDER BY id
    `;
    return rows.map((r) => r.id);
  } finally {
    await sql.close();
  }
}

async function tableExists(tableName: string): Promise<boolean> {
  const sql = new SQL(CONNECTION_STRING);
  try {
    const rows = await sql<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='table' AND name=${tableName}
    `;
    return rows.length > 0;
  } finally {
    await sql.close();
  }
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(MIGRATIONS_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("migrate new", () => {
  test("creates a new migration file", async () => {
    await migrate({
      command: "new",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
      name: "create-users",
    });

    const files = readdirSync(MIGRATIONS_DIR);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d{14}-create-users\.ts$/);
  });

  test("slugifies the migration name", async () => {
    await migrate({
      command: "new",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
      name: "Create Users Table",
    });

    const files = readdirSync(MIGRATIONS_DIR);
    expect(files[0]).toMatch(/^\d{14}-Create-Users-Table\.ts$/);
  });

  test("throws when name is missing", async () => {
    await expect(
      migrate({
        command: "new",
        migrationsDirectory: MIGRATIONS_DIR,
        connectionString: CONNECTION_STRING,
      }),
    ).rejects.toThrow();
  });
});

describe("migrate up", () => {
  test("applies pending migrations", async () => {
    createMigration(
      "20240101000000-create-users.ts",
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
      "DROP TABLE users",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual(["20240101000000-create-users.ts"]);
    expect(await tableExists("users")).toBe(true);
  });

  test("applies multiple migrations in order", async () => {
    createMigration(
      "20240101000000-create-users.ts",
      "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      "DROP TABLE users",
    );
    createMigration(
      "20240102000000-create-posts.ts",
      "CREATE TABLE posts (id INTEGER PRIMARY KEY)",
      "DROP TABLE posts",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual([
      "20240101000000-create-users.ts",
      "20240102000000-create-posts.ts",
    ]);
  });

  test("does nothing when no pending migrations", async () => {
    createMigration(
      "20240101000000-create-users.ts",
      "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      "DROP TABLE users",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });
    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual(["20240101000000-create-users.ts"]);
  });

  test("throws when database is ahead of disk", async () => {
    createMigration(
      "20240101000000-first.ts",
      "CREATE TABLE t1 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t1",
    );
    createMigration(
      "20240102000000-second.ts",
      "CREATE TABLE t2 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t2",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    rmSync(path.join(MIGRATIONS_DIR, "20240102000000-second.ts"));

    await expect(
      migrate({
        command: "up",
        migrationsDirectory: MIGRATIONS_DIR,
        connectionString: CONNECTION_STRING,
      }),
    ).rejects.toThrow();

    // DB state unchanged
    const applied = await getAppliedMigrations();
    expect(applied).toEqual([
      "20240101000000-first.ts",
      "20240102000000-second.ts",
    ]);
  });

  test("throws when migrations mismatch", async () => {
    createMigration(
      "20240101000000-first.ts",
      "CREATE TABLE t1 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t1",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    rmSync(path.join(MIGRATIONS_DIR, "20240101000000-first.ts"));
    createMigration(
      "20240101000000-different.ts",
      "CREATE TABLE t2 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t2",
    );

    await expect(
      migrate({
        command: "up",
        migrationsDirectory: MIGRATIONS_DIR,
        connectionString: CONNECTION_STRING,
      }),
    ).rejects.toThrow();
  });
});

describe("migrate down", () => {
  test("rolls back the latest migration", async () => {
    createMigration(
      "20240101000000-create-users.ts",
      "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      "DROP TABLE users",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });
    expect(await tableExists("users")).toBe(true);

    await migrate({
      command: "down",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual([]);
    expect(await tableExists("users")).toBe(false);
  });

  test("only rolls back one migration at a time", async () => {
    createMigration(
      "20240101000000-first.ts",
      "CREATE TABLE t1 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t1",
    );
    createMigration(
      "20240102000000-second.ts",
      "CREATE TABLE t2 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t2",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    await migrate({
      command: "down",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual(["20240101000000-first.ts"]);
  });

  test("does nothing when no migrations to roll back", async () => {
    await migrate({
      command: "down",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual([]);
  });

  test("throws when migration file is missing", async () => {
    createMigration(
      "20240101000000-create-users.ts",
      "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      "DROP TABLE users",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    rmSync(path.join(MIGRATIONS_DIR, "20240101000000-create-users.ts"));

    await expect(
      migrate({
        command: "down",
        migrationsDirectory: MIGRATIONS_DIR,
        connectionString: CONNECTION_STRING,
      }),
    ).rejects.toThrow();

    // DB state unchanged
    const applied = await getAppliedMigrations();
    expect(applied).toEqual(["20240101000000-create-users.ts"]);
  });
});

describe("migrate sync", () => {
  test("rolls back migrations not on disk and applies new ones", async () => {
    createMigration(
      "20240101000000-first.ts",
      "CREATE TABLE t1 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t1",
    );
    createMigration(
      "20240102000000-second.ts",
      "CREATE TABLE t2 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t2",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    rmSync(path.join(MIGRATIONS_DIR, "20240102000000-second.ts"));
    createMigration(
      "20240102000000-different.ts",
      "CREATE TABLE t3 (id INTEGER PRIMARY KEY)",
      "DROP TABLE t3",
    );

    await migrate({
      command: "sync",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual([
      "20240101000000-first.ts",
      "20240102000000-different.ts",
    ]);

    expect(await tableExists("t1")).toBe(true);
    expect(await tableExists("t2")).toBe(false);
    expect(await tableExists("t3")).toBe(true);
  });

  test("uses stored source code when file is missing", async () => {
    createMigration(
      "20240101000000-create-users.ts",
      "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      "DROP TABLE users",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    rmSync(path.join(MIGRATIONS_DIR, "20240101000000-create-users.ts"));

    await migrate({
      command: "sync",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual([]);
    expect(await tableExists("users")).toBe(false);
  });

  test("does nothing when already in sync", async () => {
    createMigration(
      "20240101000000-create-users.ts",
      "CREATE TABLE users (id INTEGER PRIMARY KEY)",
      "DROP TABLE users",
    );

    await migrate({
      command: "up",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    await migrate({
      command: "sync",
      migrationsDirectory: MIGRATIONS_DIR,
      connectionString: CONNECTION_STRING,
    });

    const applied = await getAppliedMigrations();
    expect(applied).toEqual(["20240101000000-create-users.ts"]);
  });

  test("throws in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      await expect(
        migrate({
          command: "sync",
          migrationsDirectory: MIGRATIONS_DIR,
          connectionString: CONNECTION_STRING,
        }),
      ).rejects.toThrow();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
