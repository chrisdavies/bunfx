# Logger

A lightweight, performant logger with automatic redaction and structured logging.

## Basic Usage

```ts
import { createLogger } from "bunfx/logger";

const log = createLogger();

log.info("Server started");
log.error("Request failed", { statusCode: 500, path: "/api/users" });
```

## Log Levels

Six levels in order of severity: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

Set minimum level via options or `LOG_LEVEL` environment variable:

```ts
const log = createLogger({ minLevel: "warn" });
```

## Structured Data

Pass data as the second argument:

```ts
log.info("User logged in", { userId: "123", ip: "192.168.1.1" });
```

## Child Loggers

Create child loggers with inherited context:

```ts
const log = createLogger();
const requestLog = log.child({ requestId: "abc-123" });

requestLog.info("Processing"); // includes requestId in output
```

## Automatic Redaction

Sensitive keys are automatically redacted (password, secret, token, api_key, etc.):

```ts
log.info("Login", { user: "alice", password: "secret123" });
// password appears as "..."
```

Customize redaction:

```ts
const log = createLogger({
  redact: {
    pattern: /^(password|ssn|credit_card)$/i,
    censor: "[HIDDEN]",
  },
});

// Or disable entirely:
const log = createLogger({ redact: { enabled: false } });
```

## Formatters

- **prettyFormat** (default in development): Colored, human-readable output
- **jsonFormat** (default in production): Single-line JSON

```ts
import { createLogger, jsonFormat, prettyFormat } from "bunfx/logger";

const log = createLogger({ format: jsonFormat });
```

## Async Context

Attach context to all logs within an async scope:

```ts
import { createLogger, withLogContext } from "bunfx/logger";

const log = createLogger();

await withLogContext({ requestId: "abc-123" }, async () => {
  log.info("Start"); // includes requestId
  await doWork();
  log.info("Done");  // includes requestId
});
```

## Options

```ts
type LoggerOptions = {
  minLevel?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  redact?: {
    enabled?: boolean;
    pattern?: RegExp;
    censor?: string;
  };
  format?: (entry: LogEntry) => string;
  output?: (line: string) => void;
};
```
