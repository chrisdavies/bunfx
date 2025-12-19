# Router

Trie-based route matching with support for dynamic parameters and wildcards. Order-agnostic matching where the most specific route wins.

## Import

```ts
import { makeRouter, RedirectError } from "bunfx/router";
```

## Basic Usage

```ts
import { makeRouter } from "bunfx/router";

const route = makeRouter({
  "/": handleHome,
  "/users": handleUsers,
  "/users/:id": handleUser,
  "/files/*path": handleFiles,
});

// Match a pathname
const result = route("/users/123");
// { pattern: "/users/:id", value: handleUser, params: { id: "123" } }
```

## Route Patterns

| Pattern | Example Path | Params |
|---------|--------------|--------|
| `/users` | `/users` | `{}` |
| `/users/:id` | `/users/123` | `{ id: "123" }` |
| `/users/:id/posts/:postId` | `/users/5/posts/42` | `{ id: "5", postId: "42" }` |
| `/files/*path` | `/files/docs/readme.md` | `{ path: "docs/readme.md" }` |
| `*slug` | `/any/path/here` | `{ slug: "any/path/here" }` |

### Dynamic Parameters (`:name`)

Matches a single path segment:

```ts
const route = makeRouter({
  "/users/:id": "user-detail",
  "/posts/:postId/comments/:commentId": "comment-detail",
});

route("/users/456");
// { params: { id: "456" }, ... }

route("/posts/10/comments/5");
// { params: { postId: "10", commentId: "5" }, ... }
```

### Wildcards (`*name`)

Matches the rest of the path (one or more segments):

```ts
const route = makeRouter({
  "/files/*path": "file-handler",
  "*slug": "catch-all",
});

route("/files/images/logo.png");
// { params: { path: "images/logo.png" }, ... }

route("/unknown/path");
// { params: { slug: "unknown/path" }, ... }
```

## Route Result

```ts
type RouteResult<T> = {
  pattern: string;           // The matched pattern
  value: T;                  // The handler/value for this route
  params: Record<string, string>;  // Extracted parameters
};
```

Returns `undefined` if no route matches.

## URL Decoding

Parameters are automatically URL-decoded:

```ts
const route = makeRouter({ "/users/:name": "handler" });

route("/users/sam%20gamgee");
// { params: { name: "sam gamgee" }, ... }
```

## Matching Priority

Routes are order-agnostic. The most specific match wins:

1. Exact path segments match first
2. Dynamic parameters (`:name`) match second
3. Wildcards (`*name`) match last

```ts
const route = makeRouter({
  "/users/admin": "admin-handler",    // Most specific
  "/users/:id": "user-handler",       // Less specific
  "*slug": "catch-all",               // Least specific
});

route("/users/admin");  // → admin-handler
route("/users/123");    // → user-handler
route("/other");        // → catch-all
```

## Server Integration

```ts
import { makeRouter } from "bunfx/router";

type Handler = (req: Request, params: Record<string, string>) => Response;

const routes = makeRouter<Handler>({
  "/": (req) => new Response("Home"),
  "/users/:id": (req, params) => new Response(`User ${params.id}`),
  "*slug": (req) => new Response("Not Found", { status: 404 }),
});

Bun.serve({
  fetch(req) {
    const url = new URL(req.url);
    const match = routes(url.pathname);

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    return match.value(req, match.params);
  },
});
```

## RedirectError

A special error class for triggering redirects in route loaders:

```ts
import { RedirectError } from "bunfx/router";

async function load() {
  const user = await getUser();
  if (!user) {
    throw new RedirectError("/login");
  }
  return { user };
}

// In error handler:
try {
  const data = await load();
} catch (err) {
  if (err instanceof RedirectError) {
    return Response.redirect(err.href, 302);
  }
  throw err;
}
```

### RedirectError Properties

| Property | Type | Description |
|----------|------|-------------|
| `href` | `string` | The redirect destination |
| `name` | `string` | Always `"RedirectError"` |
