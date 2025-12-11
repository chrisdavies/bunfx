import { expect, test } from "bun:test";
import { RedirectError } from "./redirect";

test("RedirectError stores href", () => {
  const error = new RedirectError("/home");
  expect(error.href).toBe("/home");
});
