import { makeSQLite } from "bunfx/server";
import { config } from "./config";

export const sql = await makeSQLite(config.DATABASE_URL);
