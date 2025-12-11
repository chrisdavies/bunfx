import { serve } from "bun";
import { createLogger, makePrettyFormat } from "bunfx/logger";
import { makeDevmailHandler } from "bunfx/mailer";
import { makeRPCHandler, withRequestLogging } from "bunfx/server";
import { config } from "./config";
import index from "./index.html";
import { endpoints } from "./server/rpc";
import { startBackgroundTasks } from "./tasks";

const log = createLogger({
  format:
    config.NODE_ENV === "production"
      ? undefined // defaults to jsonFormat in production
      : makePrettyFormat({ prefixKeys: ["requestId"] }),
});

const rpcHandler = withRequestLogging(makeRPCHandler(endpoints, { log }), {
  log,
});

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
  },

  development: config.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

log.info("Server started", { url: server.url.toString() });

startBackgroundTasks();
