# Logger

Structured logging with automatic sensitive key redaction, multiple output formats, and async context support.

## Import

```ts
import { createLogger, withLogContext, jsonFormat, prettyFormat } from "bunfx/logger";
```

## Basic Usage

```ts
const log = createLogger();

log.info("User logged in", { userId: "123", email: "user@example.com" });
log.error("Request failed", { statusCode: 500, err: new Error("timeout") });
```

## Log Levels

| Level | Ordinal | Use Case |
|-------|---------|----------|
| `trace` | 10 | Detailed debugging |
| `debug` | 20 | Development debugging |
| `info` | 30 | General information (default) |
| `warn` | 40 | Warning conditions |
| `error` | 50 | Error conditions |
| `fatal` | 60 | Critical failures |

```ts
const log = createLogger({ minLevel: "debug" });

log.trace("very detailed");  // Not output (below minLevel)
log.debug("debugging info"); // Output
log.info("general info");    // Output
log.warn("warning");         // Output
log.error("error");          // Output
log.fatal("critical");       // Output
```

### Environment Variable

Set `LOG_LEVEL` to control minimum level:

```bash
LOG_LEVEL=debug bun start
```

## Options

```ts
const log = createLogger({
  minLevel: "info",           // Minimum level to output
  redact: {                   // Sensitive key redaction
    enabled: true,            // Default: true
    pattern: /password|token/i,  // Custom pattern
    censor: "[REDACTED]",     // Replacement text
  },
  format: jsonFormat,         // Output formatter
  output: console.log,        // Output function
});
```

## Output Formats

### JSON Format (Production Default)

```ts
import { jsonFormat } from "bunfx/logger";

const log = createLogger({ format: jsonFormat });
log.info("hello", { user: "alice" });
// {"level":"info","timestamp":1234567890,"message":"hello","user":"alice"}
```

### Pretty Format (Development Default)

```ts
import { prettyFormat, makePrettyFormat } from "bunfx/logger";

const log = createLogger({ format: prettyFormat });
log.info("hello", { user: "alice" });
// 12:34:56.789 info  hello
//   user: alice
```

Custom pretty format with prefix keys:

```ts
const format = makePrettyFormat({ prefixKeys: ["requestId"] });
const log = createLogger({ format });

log.info("request", { requestId: "abc123", path: "/api" });
// 12:34:56.789 abc123 info  request
//   path: /api
```

### Auto-Detection

By default, `createLogger()` uses:
- `jsonFormat` when `NODE_ENV=production`
- `prettyFormat` otherwise

## Sensitive Key Redaction

Keys matching the default pattern are automatically redacted:

```ts
const log = createLogger();

log.info("login", {
  username: "alice",
  password: "secret123",
  token: "abc",
  api_key: "xyz",
});
// password, token, api_key are redacted to "..."
```

### Default Redaction Pattern

```
/^(password|secret|token|apikey|api_key|authorization|cookie|session|credential|private|auth|encrypted.*)$/i
```

### Custom Redaction

```ts
const log = createLogger({
  redact: {
    pattern: /^(ssn|credit_card)$/i,
    censor: "[HIDDEN]",
  },
});
```

### Disable Redaction

```ts
const log = createLogger({
  redact: { enabled: false },
});
```

## Child Loggers

Create child loggers with additional context:

```ts
const log = createLogger();
const requestLog = log.child({ requestId: "abc123" });

requestLog.info("processing");
// All logs include requestId: "abc123"

const userLog = requestLog.child({ userId: "user-456" });
userLog.info("user action");
// Includes both requestId and userId
```

## Async Context

Add context to all logs within an async scope:

```ts
import { withLogContext } from "bunfx/logger";

async function handleRequest(req: Request) {
  return withLogContext({ traceId: crypto.randomUUID() }, async () => {
    log.info("request started");  // Includes traceId
    await processRequest(req);
    log.info("request completed"); // Includes traceId
  });
}
```

Context is preserved across async boundaries using `AsyncLocalStorage`.

## Error Serialization

Errors are automatically serialized with `message` and `stack`:

```ts
const err = new Error("connection failed");
log.error("database error", { err });
// { ..., "err": { "message": "connection failed", "stack": "Error: ..." } }
```

## Log Entry Structure

```ts
type LogEntry = {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: number;  // Unix timestamp in ms
  message: string;
  [key: string]: unknown;  // Additional data
};
```

## Custom Output

```ts
const log = createLogger({
  format: jsonFormat,
  output: (line) => {
    // Send to external service
    fetch("https://logs.example.com", {
      method: "POST",
      body: line,
    });
  },
});
```
