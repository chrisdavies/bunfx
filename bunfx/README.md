# bunfx

A lightweight web framework for Bun.

**[Getting Started](../docs/getting-started.md)** | **[API Reference](../docs/server.md)**

## Entry Points

bunfx provides two entry points:

```ts
// Browser-safe (can be bundled for client)
import { makeRouter, makeRPCClient, htm, ClientError } from "bunfx";

// Server-only (uses Bun builtins)
import { makeSQLite, createLogger, makeSessionStore } from "bunfx/server";
```

## Modules

### Database

Utilities for working with Bun's native SQL.

```ts
import { makeSQLite, camelize, runSQLiteMaintenance } from "bunfx/server";

// Create SQLite connection with sensible defaults
const sql = await makeSQLite("sqlite://./data.db");

// Transform snake_case results to camelCase
const users = await camelize(sql`SELECT user_name, created_at FROM users`);
// users[0].userName, users[0].createdAt

// Run maintenance (PRAGMA optimize)
await runSQLiteMaintenance({ sql });
```

See [Database docs](../docs/db.md) for details.

### Logger

Structured logging with automatic redaction.

```ts
import { createLogger } from "bunfx/server";

const log = createLogger();
log.info("User logged in", { userId: "123" });
```

See [Logger docs](../docs/logger.md) for details.

### Router

Trie-based route matching with parameters and wildcards.

```ts
import { makeRouter } from "bunfx";

const route = makeRouter({
  "/": handleHome,
  "/users/:id": handleUser,
  "/files/*path": handleFiles,
});

const match = route("/users/123");
// { value: handleUser, params: { id: "123" } }
```

See [Router docs](../docs/router.md) for details.

### RPC

Type-safe RPC with Zod schema validation.

```ts
import { endpoint, ClientError } from "bunfx";
import { makeRPCHandler } from "bunfx/server";
import { z } from "zod";

const getUser = endpoint({
  schema: z.object({ id: z.string() }),
  async fn({ opts }) {
    const user = await db.find(opts.id);
    if (!user) throw ClientError.notFound("User not found");
    return user;
  },
});
```

See [RPC docs](../docs/rpc.md) for details.

### Sessions

Cookie-based encrypted sessions.

```ts
import { makeSessionStore } from "bunfx/server";

const sessions = makeSessionStore({ secret: process.env.SESSION_SECRET! });
const session = await sessions.get(request);
```

See [Sessions docs](../docs/sessions.md) for details.

### Rich Text Editor

A modular rich text editor built with Web Components and optional Preact integration.

```tsx
import { useState } from "preact/hooks";
import { RichTextEditor } from "bunfx/rich-text/preact";

function MyEditor() {
  const [content, setContent] = useState("");

  return (
    <RichTextEditor
      value={content}
      onChange={setContent}
      uploader={myUploader}      // Optional: enables image upload
      filepicker={myFilepicker}  // Optional: enables file picker UI
    />
  );
}
```

See [Rich Text docs](../docs/rich-text.md) for details.

## Full Documentation

- [Getting Started](../docs/getting-started.md)
- [Entry Points Reference](../docs/server.md)
- [Router](../docs/router.md)
- [RPC](../docs/rpc.md)
- [Database](../docs/db.md)
- [Sessions](../docs/sessions.md)
- [Logger](../docs/logger.md)
- [Migrations](../docs/migrations.md)
- [Mailer](../docs/mailer.md)
- [Cache](../docs/cache.md)
- [HTM (HTML Templating)](../docs/htm.md)
- [Type Generation](../docs/gentypes.md)
- [Rich Text Editor](../docs/rich-text.md)
