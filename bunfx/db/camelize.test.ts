import { describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { camelize } from "./camelize";

describe("camelize", () => {
  test("transforms snake_case keys to camelCase", async () => {
    const rows = [
      { user_name: "alice", created_at: "2024-01-01" },
      { user_name: "bob", created_at: "2024-01-02" },
    ];
    const result = await camelize(Promise.resolve(rows));

    expect(result).toEqual([
      { userName: "alice", createdAt: "2024-01-01" },
      { userName: "bob", createdAt: "2024-01-02" },
    ]);
  });

  test("skips transform when keys are already camelCase", async () => {
    const rows = [{ userName: "alice", createdAt: "2024-01-01" }];
    const result = await camelize(Promise.resolve(rows));

    expect(result).toEqual([{ userName: "alice", createdAt: "2024-01-01" }]);
  });

  test("handles empty arrays", async () => {
    const result = await camelize(Promise.resolve([]));
    expect(result).toEqual([]);
  });

  test("handles nested objects", async () => {
    const rows = [
      {
        user_name: "alice",
        user_meta: { last_login: "2024-01-01", is_active: true },
      },
    ];
    const result = await camelize(Promise.resolve(rows));

    expect(result).toEqual([
      {
        userName: "alice",
        userMeta: { lastLogin: "2024-01-01", isActive: true },
      },
    ]);
  });

  test("handles mixed snake_case and camelCase keys", async () => {
    const rows = [{ user_name: "alice", isActive: true }];
    const result = await camelize(Promise.resolve(rows));

    expect(result).toEqual([{ userName: "alice", isActive: true }]);
  });

  test("transforms PascalCase keys to camelCase", async () => {
    const rows = [{ UserName: "alice", IsActive: true }];
    const result = await camelize(Promise.resolve(rows));

    expect(result).toEqual([{ userName: "alice", isActive: true }]);
  });

  test("transforms kebab-case keys to camelCase", async () => {
    const rows = [{ "user-name": "alice", "is-active": true }];
    const result = await camelize(Promise.resolve(rows));

    expect(result).toEqual([{ userName: "alice", isActive: true }]);
  });

  test("handles unicode column names without underscores", async () => {
    const rows = [{ prénom: "Marie", naïveté: 100 }];
    const result = await camelize(Promise.resolve(rows));

    // No transformation needed - no underscores
    expect(result).toEqual([{ prénom: "Marie", naïveté: 100 }]);
  });

  test("transforms unicode snake_case to camelCase", async () => {
    const rows = [{ prénom_famille: "Dupont" }];
    const result = await camelize(Promise.resolve(rows));

    expect(result).toEqual([{ prénomFamille: "Dupont" }]);
  });

  test("works with Bun SQL results", async () => {
    const sql = new SQL(":memory:");
    await sql`CREATE TABLE users (user_name TEXT, is_active INTEGER)`;
    await sql`INSERT INTO users VALUES ('alice', 1)`;

    const result = await camelize(sql`SELECT * FROM users`);

    expect(result).toEqual([{ userName: "alice", isActive: 1 }]);

    sql.close();
  });

  test("skips transform for Bun SQL results already camelCase", async () => {
    const sql = new SQL(":memory:");
    await sql`CREATE TABLE users (userName TEXT)`;
    await sql`INSERT INTO users VALUES ('alice')`;

    const rows = await sql`SELECT * FROM users`;
    const result = await camelize(Promise.resolve(rows));

    // Should return same reference since no transform needed
    expect(result[0]).toBe(rows[0]);

    sql.close();
  });
});
