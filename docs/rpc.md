# RPC

Type-safe RPC (Remote Procedure Call) system with Zod schema validation. Provides end-to-end type safety from server endpoints to client calls.

## Import

```ts
// Server
import { makeRPCHandler } from "bunfx/server";
import { endpoint, ClientError } from "bunfx";

// Client (browser-safe)
import { makeRPCClient } from "bunfx";
```

## Defining Endpoints

Create endpoints with Zod schema validation:

```ts
import { z } from "zod";
import { endpoint } from "bunfx";

export const getUser = endpoint({
  schema: z.object({ id: z.string() }),
  async fn({ opts }) {
    const user = await db.users.find(opts.id);
    if (!user) {
      throw ClientError.notFound("User not found");
    }
    return { id: user.id, name: user.name };
  },
});
```

### Endpoint Context

The `fn` receives a context object:

```ts
type EndpointContext<TSchema> = {
  opts: z.infer<TSchema>;  // Validated request data
  req: Request;            // Original HTTP request
};
```

### Returning Data

Simple return values are automatically wrapped in `{ result: ... }`:

```ts
export const getUser = endpoint({
  schema: z.object({ id: z.string() }),
  async fn({ opts }) {
    return { name: "John", id: opts.id };
  },
});
// Response: { "result": { "name": "John", "id": "123" } }
```

### Custom Headers with JSONResponse

Use `JSONResponse` when you need to set response headers (e.g., for sessions):

```ts
import { endpoint, JSONResponse } from "bunfx";

export const login = endpoint({
  schema: z.object({ code: z.string() }),
  async fn({ opts, req }) {
    const user = await authenticate(opts.code);
    return new JSONResponse({
      result: { email: user.email },
      headers: await sessions.create({ userId: user.id }),
    });
  },
});
```

## Organizing Endpoints

Group endpoints into namespaces using **namespace re-exports**. This pattern is required for LSP "Find References" to work correctly on endpoints:

```ts
// rpc/users.ts
export const getUser = endpoint({ ... });
export const updateUser = endpoint({ ... });

// rpc/posts.ts
export const getPosts = endpoint({ ... });
export const createPost = endpoint({ ... });

// rpc/endpoints.ts - Use namespace re-exports
export * as users from "./users";
export * as posts from "./posts";

// rpc/types.ts - Export value and import type
// Re-export endpoints as a value for use by RPC handler
export * as endpoints from "./endpoints";
// Import for typeof - this dual pattern preserves LSP "Find References" symbol linking
import type * as endpoints from "./endpoints";

export type RPC = typeof endpoints;

// rpc/index.ts
export type { RPC } from "./types";
export { endpoints } from "./types";
```

> **Why namespace re-exports?** Using `export * as users from "./users"` instead of `const endpoints = { users }` preserves TypeScript symbol references, enabling "Find References" from endpoint definitions to client call sites.

## Server Handler

Create an RPC handler for your server:

```ts
import { makeRPCHandler } from "bunfx/server";
import { endpoints } from "./rpc";

const rpcHandler = makeRPCHandler(endpoints, {
  prefix: "rpc/",  // Optional, default: "rpc/"
  log: logger,     // Optional, for tracing
});

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/rpc/")) {
      return rpcHandler(req);
    }
    // ... other routes
  },
});
```

### URL Format

Endpoints are called via POST to `/{prefix}{namespace}.{method}`:

```
POST /rpc/users.getUser
Content-Type: application/json

{ "id": "123" }
```

## Client

Create a typed client proxy:

```ts
// rpc.ts (client entry point)
import { makeRPCClient } from "bunfx";
import type { RPC } from "./server/rpc";

export const rpc: RPC = makeRPCClient();

// Type-safe calls
const user = await rpc.users.getUser({ id: "123" });
// user is typed as { id: string, name: string }
```

> **Note:** Use a type annotation (`rpc: RPC`) rather than a generic (`makeRPCClient<RPC>()`) to preserve LSP symbol references for "Find References".

### Client Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `"rpc/"` | URL prefix for RPC endpoints |
| `baseUrl` | `string` | `""` | Base URL (for cross-origin calls) |

## Error Handling

### ClientError

Use `ClientError` for user-facing errors:

```ts
import { ClientError } from "bunfx";

export const deleteUser = endpoint({
  schema: z.object({ id: z.string() }),
  async fn({ opts }) {
    const user = await db.users.find(opts.id);
    if (!user) {
      throw ClientError.notFound("User not found");
    }
    if (!user.canDelete) {
      throw ClientError.forbidden("Cannot delete this user");
    }
    await db.users.delete(opts.id);
    return { success: true };
  },
});
```

### Static Constructors

| Method | Status | Use Case |
|--------|--------|----------|
| `ClientError.badRequest(message)` | 400 | Invalid request |
| `ClientError.unauthorized(message)` | 401 | Not authenticated |
| `ClientError.forbidden(message)` | 403 | Not authorized |
| `ClientError.notFound(message)` | 404 | Resource not found |
| `ClientError.validation(errors)` | 400 | Field validation errors |

### Validation Errors

```ts
throw ClientError.validation([
  { field: "email", message: "Invalid email format" },
  { field: "password", message: "Too short" },
]);
```

Response:
```json
{
  "error": true,
  "message": "Validation failed",
  "code": "validation",
  "status": 400,
  "data": {
    "errors": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Too short" }
    ]
  }
}
```

### Client-Side Error Handling

```ts
import { ClientError } from "bunfx";

try {
  await rpc.users.deleteUser({ id: "123" });
} catch (err) {
  if (err instanceof ClientError) {
    if (err.isValidationError()) {
      // Handle field errors
      for (const { field, message } of err.data.errors) {
        console.log(`${field}: ${message}`);
      }
    } else {
      // Handle other client errors
      console.log(err.message, err.code, err.status);
    }
  }
}
```

## Zod Validation

Schema validation errors are automatically converted to `ClientError.validation`:

```ts
export const createUser = endpoint({
  schema: z.object({
    email: z.string().email(),
    age: z.number().min(18),
  }),
  async fn({ opts }) {
    return await db.users.create(opts);
  },
});

// Invalid request: { email: "bad", age: 10 }
// Response: 400 with validation errors for both fields
```

## Error Response Format

```ts
type ClientErrorResponse = {
  error: true;
  message: string;
  status: number;
  code: string;
  data?: unknown;
};
```
