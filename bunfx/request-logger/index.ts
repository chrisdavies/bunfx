import { createLogger, type Logger, withLogContext } from "../logger";

export type RequestHandler = (req: Request) => Response | Promise<Response>;

export type RequestLoggerOptions = {
  /** Logger instance to use (defaults to createLogger()) */
  log?: Logger;
  /** Function to generate request IDs (defaults to built-in generator) */
  genRequestId?: () => string;
  /** Paths to skip logging (exact match or regex) */
  ignorePaths?: (string | RegExp)[];
};

const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
const buf = new Uint8Array(6);
const nodeId = crypto.randomUUID().slice(-6);
const toChar = (i: number) => chars[buf[i]! % chars.length]!;

/**
 * Generates a unique request ID like "r-abc123defxyz"
 * Uses crypto.getRandomValues for speed and uniqueness.
 */
export function genRequestId(): string {
  crypto.getRandomValues(buf);
  return `r-${toChar(0)}${toChar(1)}${toChar(2)}${nodeId}${toChar(3)}${toChar(4)}${toChar(5)}`;
}

function shouldIgnore(
  pathname: string,
  ignorePaths?: (string | RegExp)[],
): boolean {
  if (!ignorePaths) return false;
  for (const pattern of ignorePaths) {
    if (typeof pattern === "string") {
      if (pathname === pattern) return true;
    } else if (pattern.test(pathname)) {
      return true;
    }
  }
  return false;
}

/**
 * Wraps a request handler with logging.
 * Logs request start, assigns a request ID to log context, and logs completion with status/duration.
 */
export function withRequestLogging(
  handler: RequestHandler,
  options: RequestLoggerOptions = {},
): RequestHandler {
  const log = options.log ?? createLogger();
  const genId = options.genRequestId ?? genRequestId;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (shouldIgnore(pathname, options.ignorePaths)) {
      return handler(req);
    }

    const requestId = genId();
    const startTime = performance.now();

    return withLogContext({ requestId }, async () => {
      log.info(`${req.method} ${url.host}${url.pathname}${url.search}`);

      try {
        const response = await handler(req);
        const elapsed = (performance.now() - startTime).toFixed(1);
        log.info(`status ${response.status} in ${elapsed}ms`);
        return response;
      } catch (err) {
        const elapsed = (performance.now() - startTime).toFixed(1);
        log.error(`error in ${elapsed}ms`, {
          err: err instanceof Error ? err : new Error(String(err)),
        });
        throw err;
      }
    });
  };
}
