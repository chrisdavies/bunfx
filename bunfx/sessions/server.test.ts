import { describe, expect, test } from "bun:test";
import { makeSessionStore } from "./server";

const TEST_SECRET = "test-secret-key-must-be-at-least-32-characters";

/** Extract cookie value from Set-Cookie header */
function extractCookieValue(setCookie: string): string {
  const match = setCookie.match(/^[^=]+=([^;]+)/);
  if (!match?.[1]) throw new Error("Invalid Set-Cookie header");
  return match[1];
}

describe("makeSessionStore", () => {
  test("throws if secret is too short", () => {
    expect(() => makeSessionStore({ secret: "short" })).toThrow(
      "Session secret must be at least 32 characters",
    );
  });

  test("accepts secret of 32+ characters", () => {
    const sessions = makeSessionStore({ secret: TEST_SECRET });
    expect(sessions).toBeDefined();
    expect(sessions.get).toBeInstanceOf(Function);
    expect(sessions.create).toBeInstanceOf(Function);
    expect(sessions.destroy).toBeInstanceOf(Function);
  });

  test("create() returns Set-Cookie header with v1 prefix", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      ttlSeconds: 3600,
    });

    const headers = await sessions.create({ userId: "user-123" });
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    expect(cookieValue).toMatch(/^v1:/);
    expect(headers["Set-Cookie"]).toContain("HttpOnly");
    expect(headers["Set-Cookie"]).toContain("SameSite=Lax");
    expect(headers["Set-Cookie"]).toContain("Max-Age=3600");
    expect(headers["Set-Cookie"]).toContain("Path=/");
  });

  test("create() with secure=true includes Secure flag", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      secure: true,
    });

    const headers = await sessions.create({ userId: "user-123" });
    expect(headers["Set-Cookie"]).toContain("Secure");
  });

  test("create() with secure=false excludes Secure flag", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      secure: false,
    });

    const headers = await sessions.create({ userId: "user-123" });
    expect(headers["Set-Cookie"]).not.toContain("Secure");
  });

  test("get() returns undefined for request without cookie", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
    });
    const req = new Request("http://localhost/");

    const session = await sessions.get(req);
    expect(session).toBeUndefined();
  });

  test("get() throws for invalid cookie", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
    });
    const req = new Request("http://localhost/", {
      headers: { cookie: "bunfxsession=v1:invalid-token" },
    });

    await expect(sessions.get(req)).rejects.toThrow();
  });

  test("get() returns undefined for cookie with wrong version", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
    });
    const req = new Request("http://localhost/", {
      headers: { cookie: "bunfxsession=v2:some-token" },
    });

    const session = await sessions.get(req);
    expect(session).toBeUndefined();
  });

  test("get() returns session with id, data, and createdAt", async () => {
    const sessions = makeSessionStore<{ userId: string; role: string }>({
      secret: TEST_SECRET,
      ttlSeconds: 3600,
    });

    // Create a session
    const headers = await sessions.create({
      userId: "user-123",
      role: "admin",
    });
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    // Create request with cookie
    const req = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookieValue}` },
    });

    const session = await sessions.get(req);
    expect(session).toBeDefined();
    expect(session!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(session!.data).toEqual({ userId: "user-123", role: "admin" });
    expect(session!.createdAt).toBeInstanceOf(Date);
    expect(session!.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test("destroy() returns cookie with Max-Age=0", () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
    });

    const headers = sessions.destroy();

    expect(headers["Set-Cookie"]).toContain("bunfxsession=");
    expect(headers["Set-Cookie"]).toContain("Max-Age=0");
    expect(headers["Set-Cookie"]).toContain("HttpOnly");
  });

  test("sessions with different secrets cannot read each other", async () => {
    const sessions1 = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
    });
    const sessions2 = makeSessionStore<{ userId: string }>({
      secret: "different-secret-at-least-32-chars",
    });

    // Create session with first store
    const headers = await sessions1.create({ userId: "user-123" });
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    // Try to read with second store - should throw
    const req = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookieValue}` },
    });

    await expect(sessions2.get(req)).rejects.toThrow();
  });

  test("custom cookie name is used", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      name: "my_session",
    });

    const headers = await sessions.create({ userId: "user-123" });
    expect(headers["Set-Cookie"]).toContain("my_session=");

    // Extract cookie value
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    // Should read from custom cookie name
    const req = new Request("http://localhost/", {
      headers: { cookie: `my_session=${cookieValue}` },
    });

    const session = await sessions.get(req);
    expect(session?.data.userId).toBe("user-123");
  });

  test("custom SameSite attribute is used", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      sameSite: "strict",
    });

    const headers = await sessions.create({ userId: "user-123" });
    expect(headers["Set-Cookie"]).toContain("SameSite=Strict");
  });

  test("roundtrip with complex data", async () => {
    const sessions = makeSessionStore<{
      userId: string;
      permissions: string[];
      metadata: { loginAt: number; ip: string };
    }>({
      secret: TEST_SECRET,
      ttlSeconds: 3600,
    });

    const originalData = {
      userId: "user-123",
      permissions: ["read", "write"],
      metadata: {
        loginAt: Date.now(),
        ip: "127.0.0.1",
      },
    };

    const headers = await sessions.create(originalData);
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    const req = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookieValue}` },
    });

    const session = await sessions.get(req);
    expect(session?.data).toEqual(originalData);
  });

  test("session id is unique per create() call", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
    });

    const headers1 = await sessions.create({ userId: "user-123" });
    const headers2 = await sessions.create({ userId: "user-123" });

    const cookie1 = extractCookieValue(headers1["Set-Cookie"]);
    const cookie2 = extractCookieValue(headers2["Set-Cookie"]);

    const req1 = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookie1}` },
    });
    const req2 = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookie2}` },
    });

    const session1 = await sessions.get(req1);
    const session2 = await sessions.get(req2);

    expect(session1!.id).not.toBe(session2!.id);
  });

  test("createdAt can be used for revocation checks", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      ttlSeconds: 3600,
    });

    const headers = await sessions.create({ userId: "user-123" });
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    const req = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookieValue}` },
    });

    const session = await sessions.get(req);

    // Simulate a revocation timestamp set after session creation
    const revokedAt = new Date(session!.createdAt.getTime() + 1000);
    expect(session!.createdAt < revokedAt).toBe(true);

    // Simulate a revocation timestamp set before session creation
    const notRevokedAt = new Date(session!.createdAt.getTime() - 1000);
    expect(session!.createdAt < notRevokedAt).toBe(false);
  });

  test("lruCacheSize=0 disables caching", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      lruCacheSize: 0,
    });

    const headers = await sessions.create({ userId: "user-123" });
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    const req = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookieValue}` },
    });

    // Should still work without cache
    const session = await sessions.get(req);
    expect(session?.data.userId).toBe("user-123");
  });

  test("cached sessions return same data on repeated gets", async () => {
    const sessions = makeSessionStore<{ userId: string }>({
      secret: TEST_SECRET,
      lruCacheSize: 10,
    });

    const headers = await sessions.create({ userId: "user-123" });
    const cookieValue = extractCookieValue(headers["Set-Cookie"]);

    const req = new Request("http://localhost/", {
      headers: { cookie: `bunfxsession=${cookieValue}` },
    });

    const session1 = await sessions.get(req);
    const session2 = await sessions.get(req);

    expect(session1).toEqual(session2);
  });
});
