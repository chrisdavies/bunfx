import { createLogger, makePrettyFormat } from "bunfx/logger";
import { config } from "./config";

export const log = createLogger({
  minLevel: config.LOG_LEVEL,
  format:
    config.NODE_ENV === "production"
      ? undefined // defaults to jsonFormat in production
      : makePrettyFormat({ prefixKeys: ["requestId"] }),
});
