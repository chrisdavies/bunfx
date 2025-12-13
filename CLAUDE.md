# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Run all checks (lint + typecheck)
bun check

# Run tests (from bunfx directory)
cd bunfx && bun test

# Run a single test file
bun test bunfx/router/core.test.ts

# Development server (secrets-share)
cd secrets-share && bun dev

# Production server
cd secrets-share && bun start

# Database migrations (from secrets-share directory)
bun run migrate:new <name>   # Create new migration
bun run migrate:up           # Run migrations + regenerate types
bun run migrate:down         # Rollback migrations
bun run migrate:sync         # Sync schema + regenerate types
```

## Architecture

This is a Bun monorepo with two packages:

- **bunfx** - Low-dependency web framework utilities
- **secrets-share** - Example app demonstrating the framework

### bunfx Framework Modules

| Module | Purpose |
|--------|---------|
| `bunfx/router` | Trie-based route matching with pattern support (`:id`, `*`) |
| `bunfx/rpc` | Type-safe RPC with Zod validation, namespaced endpoints |
| `bunfx/db` | SQLite/PostgreSQL utilities, `camelize()` for snake_case→camelCase |
| `bunfx/sessions` | Cookie-based encrypted sessions with LRU cache |
| `bunfx/logger` | Structured logging with automatic sensitive key redaction |
| `bunfx/migrations` | SQL migrations with transaction support |
| `bunfx/gentypes` | Generate TypeScript types from DB schema |
| `bunfx/mailer` | Email abstraction (Mailgun + local dev provider at `/devmail`) |
| `bunfx/htm` | HTML templating with automatic escaping |
| `bunfx/cache` | LRU cache with TTL support |

### Key Patterns

**RPC Endpoints**: Use `endpoint()` with Zod schemas, throw `ClientError` for user-facing errors:
```ts
import { endpoint, ClientError } from "bunfx/rpc/endpoint";
```

**Database Queries**: Use `camelize()` to transform snake_case results to camelCase:
```ts
import { camelize } from "bunfx/db";
const users = await camelize(sql<UserRow>`SELECT * FROM users`);
```

**Sessions**: Access via `SessionStore` wrapper around `bunfx/sessions`:
```ts
const session = await sessions.get(request);
```

**Imports**: bunfx has two entry points:
- `bunfx` - Browser-safe exports (router, RPC client, htm)
- `bunfx/server` - Server-only exports (db, sessions, logger, mailer)

### Frontend

- Preact with `@preact/signals` for state
- Client-side routing via `bunfx/router`
- Tailwind CSS 4.x for styling
- Client-side AES-GCM encryption in `secrets-share/src/crypto.ts`

## Code Style

- Biome for formatting (2-space indent, double quotes) and linting
- TypeScript strict mode
- Path alias: `@/*` maps to `src/*` in secrets-share
