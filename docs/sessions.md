# Sessions

Cookie-based encrypted sessions using AES-GCM encryption. Session data is stored entirely in the cookie, with no server-side storage required.

## Import

```ts
import { makeSessionStore } from "bunfx/sessions/server";
```

## Basic Usage

```ts
type SessionData = {
  userId: string;
  role: string;
};

const sessions = makeSessionStore<SessionData>({
  secret: process.env.SESSION_SECRET!, // At least 32 characters
  ttlSeconds: 60 * 60 * 24 * 7, // 1 week
});

// Create a session
const headers = await sessions.create({ userId: "123", role: "admin" });
// Returns: { "Set-Cookie": "bunfxsession=v1:..." }

// Get session from request
const session = await sessions.get(request);
if (session) {
  console.log(session.id);        // UUID
  console.log(session.data);      // { userId: "123", role: "admin" }
  console.log(session.createdAt); // Date
}

// Destroy session (logout)
const clearHeaders = sessions.destroy();
// Returns: { "Set-Cookie": "bunfxsession=; Max-Age=0; ..." }
```

## Options

```ts
type SessionStoreOptions = {
  secret: string;           // Required, min 32 characters
  ttlSeconds?: number;      // Cookie expiration (default: session cookie)
  name?: string;            // Cookie name (default: "bunfxsession")
  secure?: boolean;         // HTTPS only (default: true)
  sameSite?: "strict" | "lax" | "none";  // (default: "lax")
  path?: string;            // Cookie path (default: "/")
  lruCacheSize?: number;    // Decryption cache size (default: 1000)
};
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `secret` | `string` | Required | Encryption key (min 32 characters) |
| `ttlSeconds` | `number` | `undefined` | Cookie max-age in seconds |
| `name` | `string` | `"bunfxsession"` | Cookie name |
| `secure` | `boolean` | `true` | Send only over HTTPS |
| `sameSite` | `string` | `"lax"` | SameSite cookie attribute |
| `path` | `string` | `"/"` | Cookie path |
| `lruCacheSize` | `number` | `1000` | LRU cache for decrypted sessions |

## Session Object

```ts
type Session<T> = {
  id: string;       // UUID, unique per session
  data: T;          // Your session data
  createdAt: Date;  // When session was created
};
```

## Integration with RPC

Use with `JSONResponse` to set session cookies in RPC endpoints:

```ts
import { endpoint, JSONResponse } from "bunfx/rpc";

export const login = endpoint({
  schema: z.object({ email: z.string(), code: z.string() }),
  async fn({ opts }) {
    const user = await verifyLogin(opts.email, opts.code);

    return new JSONResponse({
      result: { email: user.email },
      headers: await sessions.create({ userId: user.id }),
    });
  },
});

export const logout = endpoint({
  schema: z.object({}),
  async fn() {
    return new JSONResponse({
      result: { success: true },
      headers: sessions.destroy(),
    });
  },
});

export const me = endpoint({
  schema: z.object({}),
  async fn({ req }) {
    const session = await sessions.get(req);
    if (!session) {
      throw ClientError.unauthorized("Not logged in");
    }
    return { userId: session.data.userId };
  },
});
```

## Security Features

### AES-GCM Encryption

Session data is encrypted using AES-GCM with:
- 256-bit key derived from secret via SHA-256
- 96-bit random IV per session
- Authenticated encryption (prevents tampering)

### Cookie Attributes

Default cookie settings for security:
- `HttpOnly` - Not accessible via JavaScript
- `Secure` - HTTPS only (configurable)
- `SameSite=Lax` - CSRF protection (configurable)

### Secret Requirements

The secret must be at least 32 characters. Use a cryptographically random string:

```bash
# Generate a secure secret
openssl rand -base64 32
```

## Session Revocation

Use `createdAt` to implement session revocation:

```ts
const session = await sessions.get(req);
if (session) {
  const user = await db.users.find(session.data.userId);

  // Revoke sessions created before password change
  if (user.passwordChangedAt > session.createdAt) {
    // Session is revoked
    return sessions.destroy();
  }
}
```

## LRU Cache

Decrypted sessions are cached to avoid repeated decryption:

```ts
// Default: cache 1000 sessions
const sessions = makeSessionStore({ secret, lruCacheSize: 1000 });

// Disable caching
const sessions = makeSessionStore({ secret, lruCacheSize: 0 });
```

The cache uses the encrypted token as the key, so each unique session is cached separately.

## Cookie Format

Cookies use a versioned format for future compatibility:

```
v1:<base64url-encoded-encrypted-payload>
```

The payload contains:
- `id` - Session UUID
- `data` - Your session data
- `createdAt` - Timestamp (milliseconds)

## Development Setup

For local development without HTTPS:

```ts
const sessions = makeSessionStore({
  secret: process.env.SESSION_SECRET!,
  secure: process.env.NODE_ENV === "production",
});
```
