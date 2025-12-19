# Gentypes

Generate TypeScript types from PostgreSQL or SQLite database schemas.

## Import

```ts
import { generateTypes, introspectDatabase, generateTypeFiles } from "bunfx/gentypes";
```

## CLI Usage

```bash
# Set the database connection
export DATABASE_URL="./data/app.db"           # SQLite
export DATABASE_URL="postgres://user:pass@localhost/db"  # PostgreSQL

# Run with default config (db.config.ts)
bun bunfx/gentypes/cli.ts

# Run with custom config
bun bunfx/gentypes/cli.ts --config path/to/config.ts
```

## Configuration

Create a `db.config.ts` file:

```ts
export default {
  output: "./src/generated",
  overrides: {
    // Optional: custom type mappings
    Types: {
      from: "./src/types/overrides",
      mappings: {
        "users.role": "UserRole",
        "public.posts.status": "PostStatus",  // PostgreSQL with schema
      },
    },
  },
};
```

### Config Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `output` | `string` | Yes | Directory where generated files are written |
| `overrides` | `Record<string, OverrideMapping>` | No | Custom type mappings |

### Override Mapping

```ts
type OverrideMapping = {
  from: string;                    // Import path for the custom types
  mappings: Record<string, string>; // column path → type name
};
```

Column paths can be:
- `table.column` (SQLite or default PostgreSQL schema)
- `schema.table.column` (PostgreSQL with explicit schema)

## Generated Output

### SQLite

Generates a single `db.ts` file:

```ts
// db.ts - auto-generated
/** Table: users */
export type UserRow = {
  id: number;
  name: string;
  email?: string | null;
  created_at: string;
};

/** Insert type for: users */
export type InsertUserRow = {
  id: number;
  name: string;
  email?: string | null;
  created_at?: string;  // Optional - has default
};
```

### PostgreSQL

Generates one file per schema (e.g., `public.ts`, `auth.ts`):

```ts
// public.ts - auto-generated
/** Table: users */
export type UserRow = {
  id: string;        // uuid
  email: string;
  created_at: Date;  // timestamptz
};
```

## Type Mappings

### SQLite

| SQLite Type | TypeScript |
|-------------|------------|
| INTEGER, INT | `number` |
| REAL, FLOAT, DOUBLE | `number` |
| NUMERIC | `number` |
| TEXT, VARCHAR, CHAR, CLOB | `string` |
| BLOB | `Uint8Array` |
| BOOLEAN | `boolean` |

### PostgreSQL

| PostgreSQL Type | TypeScript |
|-----------------|------------|
| integer, smallint, bigint | `number` |
| numeric, real, double precision | `number` |
| uuid | `string` |
| boolean | `boolean` |
| text, varchar, char | `string` |
| date, timestamp, timestamptz | `Date` |
| json, jsonb | `unknown` |
| bytea | `Uint8Array` |
| ARRAY (e.g., text[]) | `T[]` |

## Table Name Handling

Table names are converted to PascalCase with pluralization removed:

| Table Name | Generated Type |
|------------|----------------|
| `users` | `UserRow` |
| `companies` | `CompanyRow` |
| `addresses` | `AddressRow` |
| `statuses` | `StatusRow` |
| `boxes` | `BoxRow` |

Column names are preserved as-is (typically snake_case). Use `camelize` from `bunfx/db` at runtime to convert to camelCase.

## Insert Types

For each table, an insert type is also generated where:
- Columns with defaults are optional
- Nullable columns are optional
- Required columns remain required

```ts
// users table has: id (serial), name (text), created_at (default now())
export type InsertUserRow = {
  id?: number;        // Has default (serial)
  name: string;       // Required
  created_at?: string; // Has default
};
```

## Custom Type Overrides

Override default type mappings for specific columns:

```ts
// db.config.ts
export default {
  output: "./src/generated",
  overrides: {
    Auth: {
      from: "./src/types/auth",
      mappings: {
        "users.role": "UserRole",
      },
    },
    Common: {
      from: "./src/types/common",
      mappings: {
        "users.status": "Status",
      },
    },
  },
};

// src/types/auth.ts
export type UserRole = "admin" | "user" | "guest";

// Generated output includes:
// import type * as Auth from "./src/types/auth";
// import type * as Common from "./src/types/common";
// ...
// role: Auth.UserRole;
// status: Common.Status;
```

### Override Validation

The generator validates overrides and throws errors for:
- Non-existent tables
- Non-existent columns
- Unused override mappings

## Programmatic API

```ts
import { introspectDatabase, generateTypeFiles, generateTypes } from "bunfx/gentypes";

// Full generation (introspect + write files)
await generateTypes({
  connectionString: process.env.DATABASE_URL!,
  config: { output: "./src/generated" },
});

// Or step by step:
const schema = await introspectDatabase(connectionString);
const files = generateTypeFiles(schema, config);
// files is Array<{ filename: string; content: string }>
```
