import { ClientError, endpoint } from "bunfx";
import { camelize } from "bunfx/db";
import { z } from "zod";
import { config } from "@/config";
import { sql } from "@/db";
import type { SecretRow } from "@/db-schema/db";
import { assertSessionUser } from "@/server/sessions";

const MAX_CONTENT_SIZE = config.MAX_SECRET_SIZE_KB * 1024;
const MAX_EXPIRATION_MINUTES = config.MAX_SECRET_EXPIRATION_DAYS * 24 * 60;

function hmacHash(data: string): string {
  const hmac = new Bun.CryptoHasher("sha256", config.APP_SECRET);
  hmac.update(data);
  return hmac.digest("hex");
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

export const create = endpoint({
  schema: z.strictObject({
    encryptedContent: z.string().max(MAX_CONTENT_SIZE),
    expiresInMinutes: z.number().int().min(1).max(MAX_EXPIRATION_MINUTES),
    maxDownloads: z.number().int().min(1).max(100).default(1),
  }),
  async fn({ opts, req }) {
    const user = await assertSessionUser(req);

    const id = crypto.randomUUID();
    const code = generateCode();
    const hashedCode = hmacHash(code);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + opts.expiresInMinutes * 60 * 1000,
    );

    await sql`
      INSERT INTO secrets ${sql({
        id,
        code: hashedCode,
        encrypted_content: opts.encryptedContent,
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
        max_downloads: opts.maxDownloads,
        created_at: now.toISOString(),
      })}
    `;

    return { id, code };
  },
});

export const get = endpoint({
  schema: z.strictObject({
    id: z.string(),
    code: z.string(),
  }),
  async fn({ opts }) {
    const hashedCode = hmacHash(opts.code);
    const now = new Date().toISOString();

    // Atomically increment download count and return the secret
    // Only succeeds if: code matches, not expired, and under download limit
    const [secret] = await camelize(sql<SecretRow>`
      UPDATE secrets
      SET download_count = download_count + 1
      WHERE id = ${opts.id}
        AND code = ${hashedCode}
        AND expires_at > ${now}
        AND download_count < max_downloads
      RETURNING *
    `);

    if (!secret) {
      throw ClientError.notFound("Secret not found", "not_found");
    }

    return { encryptedContent: secret.encryptedContent };
  },
});
