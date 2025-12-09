import { ClientError, endpoint, JSONResponse } from "bunfx";
import { type MailerOpts, makeMailer } from "bunfx/mailer";
import { z } from "zod";
import { config } from "@/config";
import { sql } from "@/db";
import type { LoginCodeRow, UserRow } from "@/db-schema/public";
import { getSessionUser, sessions } from "@/server/sessions";

const mailerOpts: MailerOpts =
  config.MAILER_PROVIDER === "mailgun"
    ? {
        provider: "mailgun",
        apiKey: config.MAILGUN_API_KEY,
        domain: config.MAILGUN_DOMAIN,
      }
    : {
        provider: "local",
        maxEmails: config.MAILER_LOCAL_MAX_EMAILS,
        storagePath: config.MAILER_LOCAL_STORAGE_PATH,
      };
const mailer = makeMailer(mailerOpts);

function hmacHash(data: string): string {
  const hmac = new Bun.CryptoHasher("sha256", config.APP_SECRET);
  hmac.update(data);
  return hmac.digest("hex");
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

export const sendLoginCode = endpoint({
  schema: z.strictObject({
    email: z.email(),
  }),
  async fn({ opts }) {
    // Find user - if not found, silently succeed (don't leak whether email exists)
    const [user] = await sql<UserRow>`
      SELECT * FROM users WHERE email = ${opts.email}
    `;

    if (!user) {
      return;
    }

    const code = generateCode();
    const hashedCode = hmacHash(code);

    await sql`
      INSERT INTO login_codes ${sql({ user_id: user.id, code: hashedCode, created_at: new Date().toISOString() })}
      ON CONFLICT (user_id) DO UPDATE
        SET code = excluded.code, created_at = excluded.created_at
    `;

    const loginUrl = `${config.APP_URL}/verify?user=${user.id}&code=${code}`;

    await mailer.send({
      from: "noreply@example.com",
      to: [opts.email],
      subject: "Your login link",
      html: `
        <p>Click the link below to sign in:</p>
        <p><a href="${loginUrl}">${loginUrl}</a></p>
        <p>This link expires in ${config.LOGIN_CODE_TTL_MINUTES} minutes.</p>
      `,
    });

    return;
  },
});

export const verifyLoginCode = endpoint({
  schema: z.strictObject({
    userId: z.uuid(),
    code: z.string(),
  }),
  async fn({ opts }) {
    const hashedCode = hmacHash(opts.code);
    const [row] = await sql<LoginCodeRow>`
      SELECT * FROM login_codes
      WHERE user_id = ${opts.userId} AND code = ${hashedCode}
    `;
    const expirationDate = new Date(
      Date.now() - config.LOGIN_CODE_TTL_MINUTES * 60 * 1000,
    );
    row && (await sql`DELETE FROM login_codes WHERE user_id = ${row.userId}`);
    if (!row || row.createdAt <= expirationDate) {
      throw ClientError.badRequest(
        "Invalid or expired login code",
        "invalid_code",
      );
    }
    const [user] = await sql<UserRow>`
      SELECT * FROM users WHERE id = ${row.userId}
    `;
    if (!user) {
      throw ClientError.notFound("User not found", "user_not_found");
    }

    return new JSONResponse({
      result: { userId: user.id, email: user.email },
      headers: await sessions.create({ userId: user.id }),
    });
  },
});

export const logout = endpoint({
  schema: z.strictObject({}),
  async fn({ req }) {
    // Verify user is logged in before logging out
    const user = await getSessionUser(req);
    if (!user) {
      throw ClientError.unauthorized("Not authenticated", "not_authenticated");
    }

    return new JSONResponse({
      result: { success: true },
      headers: sessions.destroy(),
    });
  },
});

export const me = endpoint({
  schema: z.strictObject({}),
  async fn({ req }) {
    const user = await getSessionUser(req);
    return user;
  },
});
