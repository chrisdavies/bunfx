import { makeRPCClient } from "bunfx/rpc/client";
import type { RPC } from "./server/rpc";

export const rpc = makeRPCClient<RPC>();
