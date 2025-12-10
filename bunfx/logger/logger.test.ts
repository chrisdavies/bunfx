import { describe, expect, test } from "bun:test";
import {
  createLogger,
  jsonFormat,
  type LogEntry,
  withLogContext,
} from "./index";

function captureOutput() {
  const entries: LogEntry[] = [];
  const output = (line: string) => entries.push(JSON.parse(line));
  return { entries, output };
}

describe("logger", () => {
  test("outputs JSON structure", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ minLevel: "debug", format: jsonFormat, output });

    log.info("hello world", { user: "alice" });

    expect(entries.length).toBe(1);
    expect(entries[0]!.level).toBe("info");
    expect(entries[0]!.message).toBe("hello world");
    expect(entries[0]!.user).toBe("alice");
    expect(entries[0]!.timestamp).toBeDefined();
  });

  test("respects minLevel", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ minLevel: "warn", format: jsonFormat, output });

    log.debug("should not appear");
    log.info("should not appear");
    log.warn("should appear");
    log.error("should appear");

    expect(entries.length).toBe(2);
  });

  test("redacts sensitive fields", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ format: jsonFormat, output });

    log.info("login", {
      username: "alice",
      password: "secret123",
      token: "abc123",
      api_key: "key123",
    });

    expect(entries[0]!.username).toBe("alice");
    expect(entries[0]!.password).toBe("...");
    expect(entries[0]!.token).toBe("...");
    expect(entries[0]!.api_key).toBe("...");
  });

  test("redact: { enabled: false } skips redaction but still serializes errors", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({
      format: jsonFormat,
      output,
      redact: { enabled: false },
    });

    log.info("login", { password: "secret123" });
    expect(entries[0]!.password).toBe("secret123");

    const err = new Error("boom");
    log.error("failed", { err });
    const serialized = entries[1]!.err as { message: string; stack: string };
    expect(serialized.message).toBe("boom");
  });

  test("redact: custom pattern", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({
      format: jsonFormat,
      output,
      redact: { pattern: /^(foo|bar)$/i },
    });

    log.info("test", {
      foo: "secret",
      password: "visible",
      bar: "also secret",
    });

    expect(entries[0]!.foo).toBe("...");
    expect(entries[0]!.bar).toBe("...");
    expect(entries[0]!.password).toBe("visible");
  });

  test("child logger inherits and extends context", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ format: jsonFormat, output });

    const child = log.child({ requestId: "123" });
    child.info("request started");

    expect(entries[0]!.requestId).toBe("123");
    expect(entries[0]!.message).toBe("request started");
  });

  test("withLogContext adds context to logs", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ format: jsonFormat, output });

    withLogContext({ traceId: "abc" }, () => {
      log.info("inside context");
    });

    expect(entries[0]!.traceId).toBe("abc");
  });

  test("all log levels work", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ minLevel: "trace", format: jsonFormat, output });

    log.trace("trace");
    log.debug("debug");
    log.info("info");
    log.warn("warn");
    log.error("error");
    log.fatal("fatal");

    expect(entries.length).toBe(6);
    const levels = entries.map((e) => e.level);
    expect(levels).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ]);
  });

  test("does not mutate input data", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ format: jsonFormat, output });

    const data = { password: "secret", name: "alice" };
    log.info("test", data);

    expect(data.password).toBe("secret");
    expect(entries[0]!.password).toBe("...");
  });

  test("serializes errors with message and stack", () => {
    const { entries, output } = captureOutput();
    const log = createLogger({ format: jsonFormat, output });

    const err = new Error("something broke");
    log.error("failed", { err });

    const serialized = entries[0]!.err as { message: string; stack: string };
    expect(serialized.message).toBe("something broke");
    expect(serialized.stack).toContain("Error: something broke");
  });

  test("handles invalid LOG_LEVEL gracefully", () => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "invalid";

    const { entries, output } = captureOutput();
    const log = createLogger({ format: jsonFormat, output });

    log.info("should appear");
    log.debug("should not appear");

    expect(entries.length).toBe(1);
    expect(entries[0]!.message).toBe("should appear");

    process.env.LOG_LEVEL = original;
  });
});
