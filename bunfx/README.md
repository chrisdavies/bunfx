# bunfx

A collection of utilities for building web applications with Bun.

## Modules

### Database (`bunfx/db`)

Utilities for working with Bun's native SQL.

#### `makeSQLite(url)`

Creates a SQLite connection with sensible defaults (WAL mode, foreign keys, etc.):

```ts
import { makeSQLite } from "bunfx/db";

export const sql = await makeSQLite("sqlite://./data.db");
```

#### `camelize(query)`

Transforms query results from snake_case to camelCase. Works with snake_case, PascalCase, and kebab-case keys:

```ts
import { camelize } from "bunfx/db";

// Define types matching your DB schema (snake_case)
type UserRow = { user_name: string; created_at: string };

// Query returns camelCase
const users = await camelize(sql<UserRow>`SELECT * FROM users`);
// users[0].userName, users[0].createdAt

// Type is automatically transformed
// users: { userName: string; createdAt: string }[]
```

For best results, generate your DB types with `bunfx/gentypes` which outputs snake_case types matching your schema.

#### `runSQLiteMaintenance({ sql, vacuum? })`

Runs SQLite maintenance tasks:

```ts
import { runSQLiteMaintenance } from "bunfx/db";

// Run PRAGMA optimize
await runSQLiteMaintenance({ sql });

// Run PRAGMA optimize + VACUUM (slower, reclaims disk space)
await runSQLiteMaintenance({ sql, vacuum: true });
```

### Logger (`bunfx/logger`)

Structured logging with automatic redaction. See [logger/README.md](./logger/README.md).

### Migrations (`bunfx/migrations`)

Database migrations for SQLite and PostgreSQL.

### Type Generation (`bunfx/gentypes`)

Generate TypeScript types from your database schema:

```ts
import { generateTypes } from "bunfx/gentypes";

await generateTypes({
  connectionString: "sqlite://./data.db",
  config: { output: "./src/db-schema" },
});
```

### RPC (`bunfx/rpc`)

Type-safe RPC with Zod schema validation.

### Sessions (`bunfx/sessions`)

Cookie-based encrypted sessions. See [sessions/README.md](./sessions/README.md).
