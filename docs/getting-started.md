# Getting Started

bunfx is a lightweight web framework for Bun. It provides utilities for routing, RPC, database access, sessions, and more.

## Installation

```bash
bun add bunfx
```

## Entry Points

bunfx provides two entry points:

```ts
// Browser-safe code (can be bundled for client)
import { makeRouter, makeRPCClient, ClientError } from "bunfx";

// Server-only code (uses Bun builtins)
import { makeSQLite, createLogger, makeSessionStore } from "bunfx/server";
```

**Why two entry points?** Client bundlers (Vite, esbuild) will fail if they encounter Bun-specific APIs. The separation ensures browser bundles only include browser-safe code.

## Quick Example

Here's a minimal server with routing and RPC:

```ts
import { makeRouter, endpoint, ClientError } from "bunfx";
import { makeSQLite, createLogger, makeRPCHandler } from "bunfx/server";
import { z } from "zod";

// Create a logger
const log = createLogger({ name: "app" });

// Create a database connection
const sql = await makeSQLite("sqlite://./data.db");

// Define an RPC endpoint
const getUser = endpoint({
  schema: z.object({ id: z.string() }),
  async fn({ opts }) {
    const [user] = await sql`SELECT * FROM users WHERE id = ${opts.id}`;
    if (!user) throw ClientError.notFound("User not found");
    return user;
  },
});

// Create RPC handler
const rpcHandler = makeRPCHandler({ users: { getUser } });

// Create router for static routes
const routes = makeRouter({
  "/": () => new Response("Hello, World!"),
  "/health": () => new Response("OK"),
});

// Start server
Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle RPC requests
    if (url.pathname.startsWith("/rpc/")) {
      return rpcHandler(req);
    }

    // Handle static routes
    const match = routes(url.pathname);
    if (match) {
      return match.value();
    }

    return new Response("Not Found", { status: 404 });
  },
});

log.info({ port: 3000 }, "Server started");
```

## Modules Overview

### Browser-safe (`bunfx`)

| Export | Description |
|--------|-------------|
| `makeRouter` | Trie-based route matching |
| `RedirectError` | Trigger redirects in loaders |
| `makeRPCClient` | Type-safe RPC client |
| `endpoint` | Define RPC endpoints |
| `ClientError` | User-facing errors |
| `makeLRUCache` | LRU cache with TTL |

### Server-only (`bunfx/server`)

| Export | Description |
|--------|-------------|
| `makeSQLite` | SQLite connection with sensible defaults |
| `camelize` | Transform snake_case results to camelCase |
| `createLogger` | Structured logging with redaction |
| `makeSessionStore` | Encrypted cookie sessions |
| `makeRPCHandler` | Handle RPC requests |
| `migrate` | Database migrations |
| `generateTypes` | Generate TS types from DB schema |

## Documentation

- [Router](./router.md) - Route matching with parameters and wildcards
- [RPC](./rpc.md) - Type-safe remote procedure calls
- [Database](./db.md) - SQLite utilities
- [Sessions](./sessions.md) - Cookie-based encrypted sessions
- [Logger](./logger.md) - Structured logging
- [Migrations](./migrations.md) - Database migrations
- [Cache](./cache.md) - LRU cache
- [Server Entry Point](./server.md) - Full list of server exports

## Peer Dependencies

Some modules require peer dependencies:

| Module | Requires |
|--------|----------|
| RPC endpoints | `zod` |
| HTM templates | `preact`, `@preact/signals` |

Install only what you need:

```bash
bun add zod                    # For RPC
bun add preact @preact/signals # For HTM
```
