import { makeSQLite } from "bunfx/db";
import { config } from "./config";

export const sql = await makeSQLite(config.DATABASE_URL);
