# Request Logger

HTTP request logging middleware that wraps request handlers with automatic logging, request IDs, and timing.

## Import

```ts
import { withRequestLogging, genRequestId } from "bunfx/request-logger";
```

## Basic Usage

```ts
import { withRequestLogging } from "bunfx/request-logger";

const handler = async (req: Request): Promise<Response> => {
  return new Response("Hello");
};

const loggedHandler = withRequestLogging(handler);

Bun.serve({
  fetch: loggedHandler,
});
```

Output (with recommended logger configuration):
```
12:34:56.789 r-abc123 info  GET localhost:3000/api/users
12:34:56.795 r-abc123 info  status 200 in 6.2ms
```

To get `requestId` on the prefix line as shown above, configure the logger with `prefixKeys`:

```ts
import { createLogger, makePrettyFormat } from "bunfx/logger";

const format = makePrettyFormat({ prefixKeys: ["requestId"] });
const log = createLogger({ format });

const loggedHandler = withRequestLogging(handler, { log });
```

## Options

```ts
type RequestLoggerOptions = {
  log?: Logger;
  genRequestId?: () => string;
  ignorePaths?: (string | RegExp)[];
};
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `log` | `Logger` | `createLogger()` | Logger instance to use |
| `genRequestId` | `() => string` | Built-in generator | Function to generate request IDs |
| `ignorePaths` | `(string \| RegExp)[]` | `undefined` | Paths to skip logging |

## Custom Logger

```ts
import { createLogger } from "bunfx/logger";
import { withRequestLogging } from "bunfx/request-logger";

const log = createLogger({ minLevel: "debug" });

const loggedHandler = withRequestLogging(handler, { log });
```

## Ignore Paths

Skip logging for specific paths (health checks, static assets, etc.):

```ts
const loggedHandler = withRequestLogging(handler, {
  ignorePaths: [
    "/health",           // Exact match
    "/favicon.ico",      // Exact match
    /^\/static\//,       // Regex: paths starting with /static/
    /\.(js|css|png)$/,   // Regex: static asset extensions
  ],
});
```

## Custom Request ID

```ts
import { withRequestLogging } from "bunfx/request-logger";

const loggedHandler = withRequestLogging(handler, {
  genRequestId: () => `req-${crypto.randomUUID()}`,
});
```

## Default Request ID Format

The built-in `genRequestId()` generates IDs like `r-abc123defxyz`:
- Prefix: `r-`
- 6 random bytes encoded as base64 (8 characters)

```ts
import { genRequestId } from "bunfx/request-logger";

genRequestId(); // "r-K7mN2pQx"
```

## Log Context Integration

Request IDs are automatically added to the async log context. Any logs within the request handler include the `requestId`:

```ts
import { createLogger } from "bunfx/logger";
import { withRequestLogging } from "bunfx/request-logger";

const log = createLogger();

const handler = async (req: Request) => {
  log.info("Processing request");  // Includes requestId automatically
  return new Response("OK");
};

const loggedHandler = withRequestLogging(handler, { log });
```

Output:
```
12:34:56.789 r-abc123 info  GET localhost:3000/api
12:34:56.790 r-abc123 info  Processing request
12:34:56.795 r-abc123 info  status 200 in 6.2ms
```

## Error Handling

Errors are logged with the request context before being re-thrown:

```ts
const handler = async (req: Request) => {
  throw new Error("Something went wrong");
};

const loggedHandler = withRequestLogging(handler);
```

Output:
```
12:34:56.789 r-abc123 info  GET localhost:3000/api
12:34:56.795 r-abc123 error error in 6.2ms
  err: { message: "Something went wrong", stack: "..." }
```

The error is re-thrown after logging, allowing upstream error handlers to process it.

## What Gets Logged

| Event | Level | Message |
|-------|-------|---------|
| Request start | `info` | `GET localhost:3000/path?query` |
| Request success | `info` | `status 200 in 6.2ms` |
| Request error | `error` | `error in 6.2ms` with error details |
