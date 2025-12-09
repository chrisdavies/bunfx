import type { Migration } from "bunfx/server";

export default {
  async up(sql) {
    await sql`
      CREATE TABLE secrets (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        encrypted_content TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        max_downloads INTEGER NOT NULL DEFAULT 1,
        download_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `;

    await sql`CREATE INDEX secrets_expires_at ON secrets(expires_at)`;
  },

  async down(sql) {
    await sql`DROP TABLE IF EXISTS secrets`;
  },
} satisfies Migration;
