import type { ZodError } from "zod";
import type { Logger } from "../logger";
import type { EndpointFn } from "./endpoint";
import { ClientError } from "./error";

type EndpointModule = Record<string, EndpointFn>;
type EndpointNamespace = Record<string, EndpointModule>;

export type RPCHandlerOptions = {
  prefix?: string;
  /** Logger for tracing RPC opts (optional) */
  log?: Logger;
};

export function makeRPCHandler(
  endpoints: EndpointNamespace,
  options: RPCHandlerOptions = {},
) {
  const prefix = options.prefix ?? "rpc/";

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // Strip the prefix to get the endpoint path
    // e.g., "/rpc/tokens.getToken" -> "tokens.getToken"
    const prefixPath = path.startsWith("/") ? `/${prefix}` : prefix;
    if (!path.startsWith(prefixPath)) {
      return new Response("Not found", { status: 404 });
    }

    const endpointPath = path.slice(prefixPath.length);
    const [namespace, method] = endpointPath.split(".");

    if (!namespace || !method) {
      return new Response("Invalid endpoint path", { status: 400 });
    }

    const ns = endpoints[namespace];
    if (!ns) {
      return new Response(`Namespace "${namespace}" not found`, {
        status: 404,
      });
    }

    const endpointFn = ns[method];
    if (!endpointFn) {
      return new Response(`Method "${method}" not found in "${namespace}"`, {
        status: 404,
      });
    }

    const def = endpointFn.rpcDefinition;

    try {
      // Enforce JSON content type (defense in depth for CSRF)
      const contentType = req.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return new Response("Content-Type must be application/json", {
          status: 415,
        });
      }

      // Parse the request body as JSON
      const body = await req.json();
      const opts = def.schema.parse(body);

      options.log?.trace(`rpc ${endpointPath}`, opts);

      const fnResult = await def.fn({ opts, req });

      // If endpoint returns a Response directly, use it
      if (fnResult instanceof Response) {
        return fnResult;
      }

      return Response.json({ result: fnResult });
    } catch (err) {
      if (err instanceof ClientError) {
        return Response.json(err.toJSON(), { status: err.status });
      }
      if (err instanceof Error && err.name === "ZodError") {
        const zodError = err as ZodError;
        const fieldErrors = zodError.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        const validationError = ClientError.validation(fieldErrors);
        return Response.json(validationError.toJSON(), { status: 400 });
      }
      console.error("RPC error:", err);
      return Response.json(
        { error: true, message: "Internal server error", code: "internal" },
        { status: 500 },
      );
    }
  };
}
