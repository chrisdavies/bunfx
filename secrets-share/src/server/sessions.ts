import { ClientError } from "bunfx";
import { makeSessionStore, type Session } from "bunfx/server";
import { config } from "../config";
import { sql } from "../db";
import type { UserRow } from "../db-schema/db";

/**
 * Session data stored in the encrypted cookie
 */
export type SessionData = {
  userId: string;
};

/**
 * User data returned by session helpers
 */
export type SessionUser = {
  id: string;
  email: string;
};

/**
 * Configured session store for this application
 */
export const sessions = makeSessionStore<SessionData>({
  secret: config.APP_SECRET,
  ttlSeconds: config.SESSION_TTL_SECONDS,
});

/**
 * Get session from request (includes id, data, createdAt)
 */
export async function getSession(
  req: Request,
): Promise<Session<SessionData> | undefined> {
  return sessions.get(req);
}

/**
 * Get the currently logged-in user from session, or null if not authenticated
 */
export async function getSessionUser(
  req: Request,
): Promise<SessionUser | null> {
  const session = await sessions.get(req);
  if (!session) return null;

  const [user] = await sql<UserRow>`
		SELECT id, email FROM users WHERE id = ${session.data.userId}
	`;

  return user ?? null;
}

/**
 * Get the currently logged-in user from session, or throw 401 if not authenticated
 */
export async function assertSessionUser(req: Request): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) {
    throw ClientError.unauthorized("Not authenticated", "not_authenticated");
  }
  return user;
}
