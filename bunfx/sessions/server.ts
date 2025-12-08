import { makeLRUCache } from "../cache/lru";

/** Session returned by get() */
export type Session<T> = {
  id: string;
  data: T;
  createdAt: Date;
};

export type SessionHeaders = { "Set-Cookie": string };

export type SessionStoreOptions = {
  /** Secret key for encrypting cookies (must be at least 32 characters) */
  secret: string;
  /** Session TTL in seconds (default: no expiration) */
  ttlSeconds?: number;
  /** Cookie name (default: "bunfxsession") */
  name?: string;
  /** HTTPS only (default: true) */
  secure?: boolean;
  /** SameSite attribute (default: "lax") */
  sameSite?: "strict" | "lax" | "none";
  /** Cookie path (default: "/") */
  path?: string;
  /** LRU cache size for decrypted sessions (default: 1000, 0 to disable) */
  lruCacheSize?: number;
};

export type SessionStore<T> = {
  get(req: Request): Promise<Session<T> | undefined>;
  create(data: T): Promise<SessionHeaders>;
  destroy(): SessionHeaders;
};

const COOKIE_VERSION = "v1";

const defaultConfig = {
  name: "bunfxsession",
  path: "/",
  sameSite: "lax" as const,
  secure: true,
  lruCacheSize: 1000,
};

function makeClearCookie(opts: {
  name: string;
  path: string;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
}): SessionHeaders {
  return {
    "Set-Cookie": formatSetCookie(opts.name, "", {
      maxAge: 0,
      path: opts.path,
      secure: opts.secure,
      httpOnly: true,
      sameSite: opts.sameSite,
    }),
  };
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie");
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) {
      cookies[key] = rest.join("=");
    }
  }
  return cookies;
}

function formatSetCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none";
  },
): string {
  const parts = [`${name}=${value}`];

  if (opts.maxAge !== undefined) {
    parts.push(`Max-Age=${opts.maxAge}`);
  }
  if (opts.path) {
    parts.push(`Path=${opts.path}`);
  }
  if (opts.secure) {
    parts.push("Secure");
  }
  if (opts.httpOnly) {
    parts.push("HttpOnly");
  }
  if (opts.sameSite) {
    const sameSiteValue =
      opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1);
    parts.push(`SameSite=${sameSiteValue}`);
  }

  return parts.join("; ");
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type SessionPayload<T> = {
  id: string;
  data: T;
  createdAt: number;
};

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptPayload<T>(
  payload: SessionPayload<T>,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return base64UrlEncode(combined);
}

async function decryptPayload<T>(
  token: string,
  secret: string,
): Promise<SessionPayload<T>> {
  const key = await deriveKey(secret);
  const combined = base64UrlDecode(token);

  if (combined.length < 13) {
    throw new Error("Invalid session token");
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as SessionPayload<T>;
}

export function makeSessionStore<T>(
  opts: SessionStoreOptions,
): SessionStore<T> {
  const { secret, ttlSeconds, name, path, sameSite, secure, lruCacheSize } = {
    ...defaultConfig,
    ...opts,
  };

  if (secret.length < 32) {
    throw new Error("Session secret must be at least 32 characters");
  }

  const cache = makeLRUCache<Session<T>>({
    maxSize: lruCacheSize,
    async fetch(encrypted: string) {
      const payload = await decryptPayload<T>(encrypted, secret);
      return {
        id: payload.id,
        data: payload.data,
        createdAt: new Date(payload.createdAt),
      };
    },
  });

  return {
    async get(req: Request): Promise<Session<T> | undefined> {
      const cookies = parseCookies(req);
      const cookieValue = cookies[name];
      if (!cookieValue) return;

      const [version, encrypted] = cookieValue.split(":", 2);
      if (version !== COOKIE_VERSION || !encrypted) {
        return;
      }

      return cache.get(encrypted);
    },

    async create(data: T): Promise<SessionHeaders> {
      const payload: SessionPayload<T> = {
        id: crypto.randomUUID(),
        data,
        createdAt: Date.now(),
      };

      const encrypted = await encryptPayload(payload, secret);
      const cookieValue = `${COOKIE_VERSION}:${encrypted}`;

      return {
        "Set-Cookie": formatSetCookie(name, cookieValue, {
          maxAge: ttlSeconds,
          path,
          secure,
          httpOnly: true,
          sameSite,
        }),
      };
    },

    destroy(): SessionHeaders {
      return makeClearCookie({ name, path, secure, sameSite });
    },
  };
}
