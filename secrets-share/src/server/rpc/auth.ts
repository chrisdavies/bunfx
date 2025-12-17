import { ClientError, endpoint, JSONResponse } from "bunfx";
import { camelize } from "bunfx/db";
import { htm } from "bunfx/htm";
import { type MailerOpts, makeMailer } from "bunfx/mailer";
import { z } from "zod";
import { config } from "@/config";
import { sql } from "@/db";
import type { LoginCodeRow, UserRow } from "@/db-schema/db";
import { getSessionUser, sessions } from "@/server/sessions";

const mailerOpts: MailerOpts =
  config.MAILER_PROVIDER === "mailgun"
    ? {
        provider: "mailgun",
        apiKey: config.MAILGUN_API_KEY,
        domain: config.MAILGUN_DOMAIN,
      }
    : config.MAILER_PROVIDER === "local"
      ? {
          provider: "local",
          maxEmails: config.MAILER_LOCAL_MAX_EMAILS,
          storagePath: config.MAILER_LOCAL_STORAGE_PATH,
        }
      : { provider: "noop" };
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
    const [user] = await camelize(sql<UserRow[]>`
      SELECT * FROM users WHERE email = ${opts.email}
    `);

    if (!user) {
      return;
    }

    const code = generateCode();
    const hashedCode = hmacHash(code);

    await sql`
      INSERT INTO login_codes ${sql({ user_id: user.id, code: hashedCode, created_at: new Date().toISOString() })}
      ON CONFLICT (user_id) DO UPDATE SET code = excluded.code, created_at = excluded.created_at
    `;

    const loginUrl = `${config.APP_URL}/verify?user=${user.id}&code=${code}`;

    const mailFrom =
      config.MAILER_PROVIDER === "mailgun"
        ? config.MAIL_FROM ?? `noreply@${config.MAILGUN_DOMAIN}`
        : "noreply@example.com";

    await mailer.send({
      from: mailFrom,
      to: [opts.email],
      subject: "Your login link",
      html: htm`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px;">
          <tr>
            <td style="text-align: center; padding-bottom: 24px;">
              <span style="font-size: 32px;">🔐</span>
            </td>
          </tr>
          <tr>
            <td style="color: #e5e5e5; font-size: 20px; font-weight: 600; text-align: center; padding-bottom: 8px;">
              Sign in to Secrets
            </td>
          </tr>
          <tr>
            <td style="color: #a3a3a3; font-size: 14px; text-align: center; padding-bottom: 24px; line-height: 1.5;">
              Click the button below to sign in. This link expires in ${config.LOGIN_CODE_TTL_MINUTES} minutes.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <a href="${htm.url(loginUrl)}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
                Sign in
              </a>
            </td>
          </tr>
          <tr>
            <td style="color: #a3a3a3; font-size: 12px; text-align: center; line-height: 1.5;">
              If the button doesn't work, copy and paste this URL into your browser:
            </td>
          </tr>
          <tr>
            <td style="color: #3b82f6; font-size: 12px; text-align: center; word-break: break-all; padding-top: 8px;">
              ${loginUrl}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.toString(),
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
    const [row] = await camelize(sql<LoginCodeRow[]>`
      SELECT * FROM login_codes
      WHERE user_id = ${opts.userId} AND code = ${hashedCode}
    `);
    const expirationDate = new Date(
      Date.now() - config.LOGIN_CODE_TTL_MINUTES * 60 * 1000,
    );
    row && (await sql`DELETE FROM login_codes WHERE user_id = ${row.userId}`);
    if (!row || new Date(row.createdAt) <= expirationDate) {
      throw ClientError.badRequest(
        "Invalid or expired login code",
        "invalid_code",
      );
    }
    const [user] = await camelize(sql<UserRow[]>`
      SELECT * FROM users WHERE id = ${row.userId}
    `);
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
