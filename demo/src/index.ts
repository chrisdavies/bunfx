import { serve } from "bun";
import { makeDevmailHandler } from "bunfx/mailer";
import { makeRPCHandler } from "bunfx/server";
import { config } from "./config";
import index from "./index.html";
import { endpoints } from "./server/rpc";
import { startBackgroundTasks } from "./tasks";

const rpcHandler = makeRPCHandler(endpoints);

const devmailRoutes =
  config.MAILER_PROVIDER === "local"
    ? makeDevmailHandler({
        prefix: "/devmail",
        storagePath: config.MAILER_LOCAL_STORAGE_PATH,
      })
    : {};

const server = serve({
  routes: {
    // Dev mail UI (local provider only)
    ...devmailRoutes,

    // RPC endpoints
    "/rpc/*": rpcHandler,

    // Serve index.html for all unmatched routes.
    "/*": index,

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

  development: config.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);

startBackgroundTasks();
