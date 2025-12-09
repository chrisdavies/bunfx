import { expect, test } from "bun:test";
import { RedirectError } from "./redirect";

test("RedirectError stores href", () => {
  const error = new RedirectError("/home");
  expect(error.href).toBe("/home");
});

test("RedirectError can be thrown and caught", () => {
  expect(() => {
    throw new RedirectError("/dashboard");
  }).toThrow(RedirectError);
});

test("RedirectError has descriptive message", () => {
  const error = new RedirectError("/login");
  expect(error.message).toBe("Redirect to /login");
  expect(error.name).toBe("RedirectError");
});

test("RedirectError preserves full URLs", () => {
  const error = new RedirectError("https://example.com/callback?code=123");
  expect(error.href).toBe("https://example.com/callback?code=123");
});
