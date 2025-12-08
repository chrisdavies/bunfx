# bunfx/sessions

Encrypted cookie sessions using AES-256-GCM.

## Usage

```ts
import { makeSessionStore } from "bunfx/sessions/server";

const sessions = makeSessionStore<{ userId: string }>({
  secret: process.env.APP_SECRET,  // min 32 characters
  ttlSeconds: 60 * 60 * 24 * 7,    // default: no expiration
  name: "bunfxsession",            // default: "bunfxsession"
  secure: true,                    // default: true
  sameSite: "lax",                 // default: "lax"
});

// Get session from request
const session = await sessions.get(req);
// => { id, data: { userId }, createdAt } | undefined

// Create session (returns Set-Cookie header)
const headers = await sessions.create({ userId: "user-123" });

// Destroy session (clears the cookie)
const headers = sessions.destroy();
```

## Revocation

Sessions can't be revoked server-side directly. To support "log out all sessions", store a revocation timestamp in your database:

```
user_id | sessions_revoked_at
u-abcd  | 2025-12-25T12:01:23
```

Then check it in your request handler:

```ts
const session = await sessions.get(req);
if (!session) return unauthorized();

const user = await getUserFromDB(session.data.userId);
if (session.createdAt < user.sessionsRevokedAt) {
  return new Response("Session revoked", {
    status: 401,
    headers: sessions.destroy(),
  });
}
```

## Database-backed Sessions

To list active sessions or store more data, build on top of the cookie:

```ts
const sessions = makeSessionStore<{ sessionId: string }>({
  secret: process.env.APP_SECRET,
});

async function getFullSession(req: Request) {
  const cookie = await sessions.get(req);
  if (!cookie) return null;

  const [row] = await sql`
    SELECT * FROM sessions
    WHERE id = ${cookie.data.sessionId}
    AND revoked_at IS NULL
  `;
  return row;
}
```

## Notes

- ~4KB cookie size limit
- Cookies are HttpOnly and use AES-256-GCM encryption
- Session `id` is a UUID, useful for audit logs
