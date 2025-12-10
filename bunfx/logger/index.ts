import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogContext = Record<string, unknown>;

export type LogEntry = {
  level: LogLevel;
  timestamp: number;
  message: string;
  [key: string]: unknown;
};

export type Formatter = (entry: LogEntry) => string;

export type RedactOptions = {
  /** Enable redaction (default: true) */
  enabled?: boolean;
  /** Custom pattern to match sensitive keys (default: common sensitive key names) */
  pattern?: RegExp;
  /** Replacement text for redacted values (default: "...") */
  censor?: string;
};

export type LoggerOptions = {
  minLevel?: LogLevel;
  redact?: RedactOptions;
  format?: Formatter;
  output?: (line: string) => void;
};

export type Logger = {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  child: (context: LogContext) => Logger;
};

type LogFn = (message: string, data?: Record<string, unknown>) => void;

const logLevelOrdinal: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const als = new AsyncLocalStorage<LogContext>();

export function withLogContext<T>(context: LogContext, fn: () => T): T {
  return als.run(context, fn);
}

export function getLogContext(): LogContext {
  return als.getStore() ?? {};
}

const DEFAULT_REDACT_PATTERN =
  /^(password|secret|token|apikey|api_key|authorization|cookie|session|credential|private|auth)$/i;

const DEFAULT_CENSOR = "...";

function isValueType(v: unknown): boolean {
  if (v === null || (typeof v !== "object" && typeof v !== "function")) {
    return true;
  }
  return (
    v instanceof Date ||
    v instanceof RegExp ||
    v instanceof Number ||
    v instanceof String ||
    v instanceof Boolean
  );
}

type RedactConfig = {
  pattern: RegExp;
  censor: string;
};

function transform<T>(
  obj: T,
  redact: RedactConfig | undefined,
  seen = new WeakSet(),
): T {
  if (isValueType(obj)) {
    return obj;
  }
  if (obj instanceof Error) {
    return { message: obj.message, stack: obj.stack } as T;
  }
  if (seen.has(obj as object)) {
    return "[Circular]" as T;
  }
  seen.add(obj as object);

  let result = obj;
  const assign = (k: string | number, v: unknown) => {
    if (result === obj) {
      result = (Array.isArray(obj) ? [...obj] : { ...obj }) as T;
    }
    (result as Record<string | number, unknown>)[k] = v;
  };

  for (const k in obj) {
    if (redact?.pattern.test(k)) {
      assign(k, redact.censor);
      continue;
    }
    const v1 = (obj as Record<string | number, unknown>)[k];
    if (isValueType(v1)) {
      continue;
    }
    const v2 = transform(v1, redact, seen);
    if (v1 !== v2) {
      assign(k, v2);
    }
  }

  return result;
}

export const jsonFormat: Formatter = (entry) => JSON.stringify(entry);

const COLORS: Record<LogLevel, string> = {
  trace: "\x1b[90m",
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  fatal: "\x1b[35m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export const prettyFormat: Formatter = (entry) => {
  const { level, timestamp, message, ...rest } = entry;

  const time = new Date(timestamp).toISOString().slice(11, 23);
  const color = COLORS[level] ?? "";
  const levelStr = level.toUpperCase().padEnd(5);

  let line = `${DIM}${time}${RESET} ${color}${levelStr}${RESET} ${message}`;

  for (const k in rest) {
    const v = rest[k];
    if (typeof v === "object" && v !== null) {
      line += `\n  ${DIM}${k}:${RESET} ${JSON.stringify(v)}`;
    } else {
      line += `\n  ${DIM}${k}:${RESET} ${v}`;
    }
  }

  return line;
};

type LoggerState = {
  minLevel: number;
  redact: RedactConfig | undefined;
  format: Formatter;
  output: (line: string) => void;
  context: LogContext;
};

function emit(
  state: LoggerState,
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
) {
  if (logLevelOrdinal[level] < state.minLevel) return;

  let entry: LogEntry = {
    level,
    timestamp: Date.now(),
    message,
    ...getLogContext(),
    ...state.context,
    ...data,
  };

  entry = transform(entry, state.redact);

  state.output(state.format(entry));
}

function makeLogger(state: LoggerState): Logger {
  return {
    trace: (msg, data) => emit(state, "trace", msg, data),
    debug: (msg, data) => emit(state, "debug", msg, data),
    info: (msg, data) => emit(state, "info", msg, data),
    warn: (msg, data) => emit(state, "warn", msg, data),
    error: (msg, data) => emit(state, "error", msg, data),
    fatal: (msg, data) => emit(state, "fatal", msg, data),
    child: (ctx) =>
      makeLogger({ ...state, context: { ...state.context, ...ctx } }),
  };
}

function parseLevel(level: string | undefined): LogLevel | undefined {
  if (level && level in logLevelOrdinal) return level as LogLevel;
}

function parseRedact(opt: RedactOptions | undefined): RedactConfig | undefined {
  if (opt?.enabled === false) return;
  return {
    pattern: opt?.pattern ?? DEFAULT_REDACT_PATTERN,
    censor: opt?.censor ?? DEFAULT_CENSOR,
  };
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const isProd = process.env.NODE_ENV === "production";
  const level = parseLevel(opts.minLevel ?? process.env.LOG_LEVEL) ?? "info";
  return makeLogger({
    minLevel: logLevelOrdinal[level],
    redact: parseRedact(opts.redact),
    format: opts.format ?? (isProd ? jsonFormat : prettyFormat),
    output: opts.output ?? console.log,
    context: {},
  });
}
