/**
 * Creates a typed RPC client proxy.
 * This file is safe to import on the client - it has no server dependencies.
 */

import { ClientError } from "./error";

export type RPCClientOptions = {
  prefix?: string;
  baseUrl?: string;
};

function makeProxy(path: string, options: RPCClientOptions): any {
  const prefix = options.prefix ?? "rpc/";
  const baseUrl = options.baseUrl ?? "";

  const fn = async (opts: unknown) => {
    const url = `${baseUrl}/${prefix}${path.slice(1).replaceAll("/", ".")}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(opts),
    });

    const body = await response.json();

    if ("error" in body) {
      if (ClientError.isClientErrorResponse(body)) {
        throw ClientError.fromJSON(body);
      }
      throw new Error(body.message ?? `RPC call failed: ${response.status}`);
    }

    return body.result;
  };

  return new Proxy(fn, {
    get(_target, prop) {
      if (typeof prop === "string") {
        return makeProxy(`${path}/${prop}`, options);
      }
    },
  });
}

export function makeRPCClient<T>(options: RPCClientOptions = {}): T {
  return makeProxy("", options);
}
