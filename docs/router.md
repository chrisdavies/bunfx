# Router

Trie-based route matching with support for dynamic parameters and wildcards. Order-agnostic matching where the most specific route wins.

## Import

```ts
import { makeRouter, navigateTo, RedirectError } from "bunfx";
```

## Basic Usage

```ts
import { makeRouter } from "bunfx";

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
import { makeRouter } from "bunfx";

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
import { RedirectError } from "bunfx";

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

## Programmatic Navigation

Use `navigateTo` for programmatic client-side navigation:

```ts
import { navigateTo } from "bunfx";

// Navigate to a new page
navigateTo("/dashboard");

// Navigate with query parameters
navigateTo("/users/123?tab=settings");

// Example: redirect after form submission
async function handleSubmit(data: FormData) {
  await saveData(data);
  navigateTo("/success");
}
```

This works the same as clicking a link—it pushes to the browser history and triggers the router to load the new route.

## Page Keys and Remounting

By default, the router remounts page components whenever the URL changes. This ensures component-local state (useState, useRef, useEffect with `[]` deps) resets when navigating to a different URL, even if it matches the same route pattern.

For example, navigating from `/users/1` to `/users/2` will:
1. Call the `load` function with the new params
2. Remount the Page component (resetting all local state)

### Customizing Remount Behavior

Export a `key` function from your page module to control when remounting occurs:

```ts
// pages/users/show.ts

// Default behavior: remount on any URL change
// (No key function needed)

export async function load({ params }: LoaderArgs) {
  return { user: await getUser(params.id) };
}

export function Page({ state }: PageArgs<typeof load>) {
  // Component remounts when URL changes
}
```

To prevent reloading (keeping component state across navigations):

```ts
// pages/users/show.ts

// Stable key - never reload
export const key = () => "stable";

// Or: only reload when a specific param changes
export const key = ({ params }: LoaderArgs) => params.orgId;

export async function load({ params }: LoaderArgs) {
  // This is only called when the key changes
  return { user: await getUser(params.id) };
}

export function Page({ state }: PageArgs<typeof load>) {
  // When key matches, load() is skipped and component is not remounted
  // The state signal is reused - your page must handle param changes reactively
}
```

### When to Use Custom Keys

Use the default behavior (remount on URL change) for most pages. It's the safest choice and prevents stale state bugs.

Use a custom key function when:
- You have expensive component state that should persist across navigations
- You're implementing optimistic UI updates
- The page handles its own data reactivity via signals

**Warning:** When using a stable key, `load()` is skipped and the `state` signal is reused. Your page must handle URL/param changes reactively (e.g., via signals or useEffect watching params).
