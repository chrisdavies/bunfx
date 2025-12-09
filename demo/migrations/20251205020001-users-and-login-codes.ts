import type { Migration } from "bunfx/server";

export default {
  async up(sql) {
    await sql`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE login_codes (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `;
  },

  async down(sql) {
    await sql`DROP TABLE IF EXISTS login_codes`;
    await sql`DROP TABLE IF EXISTS users`;
  },
} satisfies Migration;
