# Server

Entry point for server-only modules. Use this import path for modules that depend on Bun builtins and cannot run in the browser.

## Import

```ts
import { ... } from "bunfx/server";
```

## Entry Points

bunfx provides two entry points:

### `bunfx` (Browser-safe)

Safe to import in browser code, client-side bundles, and shared modules.

```ts
import {
  // Cache
  makeLRUCache,

  // Router
  makeRouter,
  RedirectError,

  // RPC Client
  makeRPCClient,

  // RPC Endpoint (for type definitions)
  endpoint,
  ClientError,
} from "bunfx";
```

### `bunfx/server` (Server-only)

Only for server-side code. Depends on Bun builtins (SQL, crypto, filesystem).

```ts
import {
  // Database
  camelize,
  makeSQLite,
  runSQLiteMaintenance,

  // Type Generation
  generateTypes,
  introspectDatabase,
  generateTypeFiles,

  // Logger
  createLogger,
  withLogContext,
  jsonFormat,
  prettyFormat,

  // Migrations
  migrate,

  // Request Logger
  withRequestLogging,
  genRequestId,

  // RPC Server
  makeRPCHandler,

  // Sessions
  makeSessionStore,
} from "bunfx/server";
```

## Module Summary

### Browser-safe (`bunfx`)

| Module | Exports |
|--------|---------|
| cache | `makeLRUCache` |
| router | `makeRouter`, `RedirectError` |
| rpc/client | `makeRPCClient` |
| rpc/endpoint | `endpoint`, `JSONResponse` |
| rpc/error | `ClientError` |

### Server-only (`bunfx/server`)

| Module | Exports |
|--------|---------|
| db | `camelize`, `makeSQLite`, `runSQLiteMaintenance` |
| gentypes | `generateTypes`, `introspectDatabase`, `generateTypeFiles` |
| logger | `createLogger`, `withLogContext`, `jsonFormat`, `prettyFormat`, `makePrettyFormat` |
| migrations | `migrate` |
| request-logger | `withRequestLogging`, `genRequestId` |
| rpc/server | `makeRPCHandler` |
| sessions | `makeSessionStore` |

## Direct Module Imports

You can also import from specific module paths:

```ts
// Browser-safe
import { makeLRUCache } from "bunfx/cache/lru";
import { makeRouter } from "bunfx/router";
import { makeRPCClient } from "bunfx/rpc/client";
import { endpoint } from "bunfx/rpc/endpoint";
import { ClientError } from "bunfx/rpc/error";

// Server-only
import { camelize, makeSQLite } from "bunfx/db";
import { generateTypes } from "bunfx/gentypes";
import { createLogger } from "bunfx/logger";
import { migrate } from "bunfx/migrations/migrate";
import { withRequestLogging } from "bunfx/request-logger";
import { makeRPCHandler } from "bunfx/rpc/server";
import { makeSessionStore } from "bunfx/sessions/server";
```

## Why Two Entry Points?

Bundlers (Vite, esbuild, etc.) may try to include all imports in client bundles. Server-only code that uses Bun builtins (like `SQL`, `crypto`, filesystem APIs) will cause errors when bundled for the browser.

The separation ensures:
1. Client bundles only include browser-safe code
2. Server code has access to all modules
3. Shared code (types, utilities) can be imported anywhere
