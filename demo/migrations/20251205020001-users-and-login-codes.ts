import type { Migration } from "bunfx/server";

export default {
  async up(sql) {
    await sql`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE login_codes (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`
      CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at()
    `;
  },

  async down(sql) {
    await sql`DROP TRIGGER IF EXISTS users_updated_at ON users`;
    await sql`DROP FUNCTION IF EXISTS update_updated_at`;
    await sql`DROP TABLE IF EXISTS login_codes`;
    await sql`DROP TABLE IF EXISTS users`;
  },
} satisfies Migration;
