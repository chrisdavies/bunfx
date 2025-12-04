import { endpoint } from "bunfx";
import { z } from "zod";

export const getToken = endpoint({
  schema: z.strictObject({
    size: z.number().int().min(1).max(100),
  }),
  async fn({ opts }) {
    return new Array(opts.size).fill("0").join("");
  },
});

export const generateToken = endpoint({
  schema: z.strictObject({
    prefix: z.string().optional(),
    length: z.number().int().min(8).max(64).default(16),
  }),
  async fn({ opts }) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < opts.length; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return opts.prefix ? `${opts.prefix}_${token}` : token;
  },
});
