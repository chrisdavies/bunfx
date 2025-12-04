import type { EndpointFn } from "./endpoint";

type EndpointModule = Record<string, EndpointFn>;
type EndpointNamespace = Record<string, EndpointModule>;

export type RPCHandlerOptions = {
  prefix?: string;
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
      // Parse the request body as JSON
      const body = await req.json();
      const opts = def.schema.parse(body);
      const result = await def.fn({ opts });

      return Response.json(result);
    } catch (err) {
      if (err instanceof Error && err.name === "ZodError") {
        return Response.json(
          { error: "Validation error", details: err },
          { status: 400 },
        );
      }
      console.error("RPC error:", err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
