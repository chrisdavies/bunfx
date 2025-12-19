# Migrations

SQL migrations with transaction support for SQLite and PostgreSQL. Migrations run within transactions and store source code for rollback safety.

## Import

```ts
import type { Migration } from "bunfx";
```

## CLI Usage

```bash
# Set the database connection
export DATABASE_URL="./data/app.db"           # SQLite
export DATABASE_URL="postgres://user:pass@localhost/db"  # PostgreSQL

# Create a new migration
bun bunfx/migrations/cli.ts new create-users

# Run pending migrations
bun bunfx/migrations/cli.ts up

# Rollback the latest migration
bun bunfx/migrations/cli.ts down

# Sync database with local migrations (development only)
bun bunfx/migrations/cli.ts sync
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Required | Database connection string |
| `MIGRATIONS_DIR` | `./migrations` | Directory containing migration files |

## Commands

### `new <name>`

Creates a new timestamped migration file.

```bash
bun bunfx/migrations/cli.ts new create-users
# Creates: migrations/20241219143052-create-users.ts
```

Generated template:

```ts
import type { Migration } from "bunfx";

export default {
  async up(sql) {
    // await sql`CREATE TABLE ...`;
  },

  async down(sql) {
    // await sql`DROP TABLE ...`;
  },
} satisfies Migration;
```

### `up`

Runs all pending migrations in order.

- Migrations are applied within a transaction
- If any migration fails, all changes are rolled back
- Source code is stored in the database for rollback safety
- Throws if database is ahead of disk or migrations mismatch

### `down`

Rolls back the most recent migration.

- Only one migration is rolled back per invocation
- Uses the migration file from disk
- Throws if the migration file is missing

### `sync`

Syncs database with local migration files. **Development only**.

- Rolls back migrations not present on disk
- Applies new migrations
- Uses stored source code when files are missing
- Throws in production (`NODE_ENV=production`)

## Migration File Format

```ts
import type { Migration } from "bunfx";

export default {
  async up(sql) {
    await sql`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
  },

  async down(sql) {
    await sql`DROP TABLE users`;
  },
} satisfies Migration;
```

The `sql` parameter is a transaction-scoped query function (`TransactionSQL` from Bun).

## Migration Naming

Files are named with a timestamp prefix for ordering:

```
YYYYMMDDHHmmss-name.ts
```

Examples:
- `20241219143052-create-users.ts`
- `20241219150000-add-posts-table.ts`

## Storage

Migrations are tracked in a database table:

| Database | Table Name |
|----------|------------|
| SQLite | `bunfx_migrations` |
| PostgreSQL | `bunfx.migrations` (in `bunfx` schema) |

Table schema:

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Migration filename |
| `migrated_on` | TEXT | ISO timestamp when applied |
| `source_hash` | TEXT | Hash of bundled source |
| `source_code` | TEXT | Bundled migration source |

The stored `source_code` enables rollback even if the original file is deleted.

## Programmatic API

```ts
import { migrate } from "bunfx/server";

await migrate({
  command: "up",
  connectionString: process.env.DATABASE_URL!,
  migrationsDirectory: "./migrations",
});

// Create new migration
await migrate({
  command: "new",
  connectionString: process.env.DATABASE_URL!,
  migrationsDirectory: "./migrations",
  name: "add-posts",
});
```

## Safety Features

- **Transactions**: All migrations run in a transaction; failures roll back completely
- **Order validation**: Detects if database migrations don't match disk files
- **Source storage**: Bundled source is stored for safe rollbacks
- **Sync protection**: `sync` command is disabled in production
