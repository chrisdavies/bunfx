# Database

Database utilities for Bun SQL, including snake_case to camelCase transformation and SQLite connection helpers.

## Import

```ts
import { camelize, makeSQLite, runSQLiteMaintenance } from "bunfx/server";
```

## camelize

Transforms query results from snake_case (typical database column naming) to camelCase (typical JavaScript naming).

### Basic Usage

```ts
// With Bun SQL
const users = await camelize(sql`SELECT user_name, created_at FROM users`);
// users[0].userName, users[0].createdAt

// With explicit type annotation
type UserRow = { user_name: string; created_at: string };
const users = await camelize<UserRow>(sql`SELECT user_name, created_at FROM users`);
// TypeScript knows: users is { userName: string; createdAt: string }[]
```

### Supported Formats

`camelize` handles multiple naming conventions:

| Input Format | Example | Output |
|--------------|---------|--------|
| snake_case | `user_name` | `userName` |
| PascalCase | `UserName` | `userName` |
| kebab-case | `user-name` | `userName` |

```ts
// All these become camelCase
const rows = [{ user_name: "alice", IsActive: true, "last-login": "2024-01-01" }];
const result = await camelize(Promise.resolve(rows));
// { userName: "alice", isActive: true, lastLogin: "2024-01-01" }
```

### Nested Objects

Transformation is applied recursively to nested objects:

```ts
const rows = [{
  user_name: "alice",
  user_meta: { last_login: "2024-01-01", is_active: true }
}];
const result = await camelize(Promise.resolve(rows));
// { userName: "alice", userMeta: { lastLogin: "2024-01-01", isActive: true } }
```

### Performance

- **Bun SQL optimization**: For Bun SQL results, only the first row's keys are checked. If already camelCase, no transformation occurs.
- **Structural sharing**: Objects are only recreated when changes are detected.
- **Key memoization**: Key transformations are cached during batch processing.

## makeSQLite

Creates a SQLite connection with sensible defaults for production use.

```ts
const sql = await makeSQLite("./data/app.db");
```

### Default Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| `journal_mode` | WAL | Better concurrency for reads/writes |
| `synchronous` | NORMAL | Balance of safety and performance |
| `foreign_keys` | ON | Enforce referential integrity |
| `busy_timeout` | 5000ms | Wait up to 5s for locks |
| `cache_size` | 20MB | In-memory page cache |

## runSQLiteMaintenance

Runs SQLite maintenance tasks. Call periodically (e.g., daily via cron) or on application shutdown.

```ts
// Basic optimization
await runSQLiteMaintenance({ sql });

// With VACUUM to reclaim disk space
await runSQLiteMaintenance({ sql, vacuum: true });
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sql` | `SQL` | Required | The Bun SQL connection |
| `vacuum` | `boolean` | `false` | Rebuild database file to reclaim space |

### What It Does

- **`PRAGMA optimize`**: Analyzes tables that need it based on query patterns
- **`VACUUM`** (optional): Rebuilds the entire database file, reclaiming space from deleted rows

Note: `VACUUM` can be slow on large databases and requires exclusive access. Use sparingly.
