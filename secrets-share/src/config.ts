import { z } from "zod";

const mailerSchema = z.discriminatedUnion("MAILER_PROVIDER", [
  z.object({
    MAILER_PROVIDER: z.literal("local"),
    MAILER_LOCAL_MAX_EMAILS: z.coerce.number().default(50),
    MAILER_LOCAL_STORAGE_PATH: z.string().default("./.mailer-storage.json"),
  }),
  z.object({
    MAILER_PROVIDER: z.literal("mailgun"),
    MAILGUN_API_KEY: z.string(),
    MAILGUN_DOMAIN: z.string(),
  }),
]);

const envSchema = z
  .object({
    DATABASE_URL: z.string().default("sqlite://./data.db"),
    APP_SECRET: z.string(),
    APP_URL: z.string().default("http://localhost:3000"),
    LOGIN_CODE_TTL_MINUTES: z.coerce.number().default(15),
    SESSION_TTL_SECONDS: z.coerce.number().optional(),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    MAX_SECRET_SIZE_KB: z.coerce.number().default(10),
    MAX_SECRET_EXPIRATION_DAYS: z.coerce.number().default(30),
    // Time in UTC when maintenance runs (HH:MM). Default 07:00 = 2AM EST / 3AM EDT
    MAINTENANCE_TIME_UTC: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .default("07:00"),
  })
  .and(mailerSchema);

export const config = envSchema.parse(process.env);
export type AppConfig = typeof config;
