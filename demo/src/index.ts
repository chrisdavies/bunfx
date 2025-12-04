import { serve } from "bun";
import { makeRPCHandler } from "bunfx";
import index from "./index.html";
import { endpoints } from "./server/rpc";

const rpcHandler = makeRPCHandler(endpoints);

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    // RPC endpoints
    "/rpc/*": rpcHandler,

    "/api/hello": {
      async GET(_req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(_req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
