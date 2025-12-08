import type { z } from "zod";

export type EndpointContext<TSchema extends z.ZodType> = {
  opts: z.infer<TSchema>;
  req: Request;
};

/**
 * Typed JSON response for RPC endpoints.
 * Preserves result type for client-side type inference.
 *
 * @example
 * ```ts
 * // Client will infer { email: string }
 * return new JSONResponse({
 *   result: { email: user.email },
 *   headers: await sessions.create({ userId: user.id }),
 * });
 * ```
 */
export class JSONResponse<T> extends Response {
  // Phantom property for type inference - never exists at runtime
  declare __rpcResult?: T;

  constructor(opts: { result: T; headers?: HeadersInit }) {
    const headers = new Headers(opts.headers);
    headers.set("Content-Type", "application/json");
    super(JSON.stringify({ result: opts.result }), { headers });
  }
}

/**
 * Unwrap the result type:
 * - JSONResponse<T> -> T (typed response)
 * - Response -> unknown (untyped response)
 * - T -> T (plain return value)
 */
type UnwrapResult<T> =
  T extends JSONResponse<infer R> ? R : T extends Response ? unknown : T;

export type EndpointDef<
  TSchema extends z.ZodType,
  TFn extends (ctx: EndpointContext<TSchema>) => Promise<unknown>,
> = {
  schema: TSchema;
  fn: TFn;
};

export type EndpointFn = ((opts: unknown, req: Request) => Promise<unknown>) & {
  rpcDefinition: EndpointDef<
    z.ZodType,
    (ctx: { opts: unknown; req: Request }) => Promise<unknown>
  >;
};

/**
 * Define an RPC endpoint with schema validation.
 *
 * @example
 * ```ts
 * // Simple endpoint - return value is sent to client
 * export const getUser = endpoint({
 *   schema: z.object({ id: z.string() }),
 *   async fn({ opts }) {
 *     return { name: "John", id: opts.id };
 *   },
 * });
 *
 * // Endpoint with headers - use JSONResponse for type inference
 * export const login = endpoint({
 *   schema: z.object({ code: z.string() }),
 *   async fn({ opts, req }) {
 *     return new JSONResponse({
 *       result: { email: user.email },
 *       headers: await sessions.create({ userId: user.id }),
 *     });
 *   },
 * });
 * ```
 */
export function endpoint<
  TSchema extends z.ZodType,
  TFn extends (ctx: EndpointContext<TSchema>) => Promise<unknown>,
>(
  def: EndpointDef<TSchema, TFn>,
): ((
  opts: z.infer<TSchema>,
) => Promise<UnwrapResult<Awaited<ReturnType<TFn>>>>) &
  EndpointFn {
  const fn = (opts: z.infer<TSchema>, req: Request) => def.fn({ opts, req });
  (fn as EndpointFn).rpcDefinition = def as EndpointDef<
    z.ZodType,
    (ctx: { opts: unknown; req: Request }) => Promise<unknown>
  >;
  // The returned type omits `req` and unwraps `{ result, headers }` for client consumption
  return fn as unknown as ((
    opts: z.infer<TSchema>,
  ) => Promise<UnwrapResult<Awaited<ReturnType<TFn>>>>) &
    EndpointFn;
}
