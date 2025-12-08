import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { endpoint } from "./endpoint";
import { ClientError } from "./error";
import { makeRPCHandler } from "./server";

const testEndpoints = {
  test: {
    validateUser: endpoint({
      schema: z.object({
        email: z.string().email(),
        password: z.string().min(8),
        nested: z.object({
          field: z.string(),
        }),
      }),
      async fn({ opts }) {
        return { success: true, email: opts.email };
      },
    }),
  },
};

const handler = makeRPCHandler(testEndpoints);

describe("RPC validation errors", () => {
  test("returns structured field errors for Zod validation failures", async () => {
    const req = new Request("http://localhost/rpc/test.validateUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "short",
        nested: {}, // missing 'field'
      }),
    });

    const response = await handler(req);
    expect(response.status).toBe(400);

    const body = await response.json();

    // Should be a proper ClientError response
    expect(body.error).toBe(true);
    expect(body.code).toBe("validation");
    expect(body.message).toBe("Validation failed");
    expect(body.status).toBe(400);

    // Should have structured field errors
    expect(body.data.errors).toBeArray();
    expect(body.data.errors.length).toBe(3);

    const errorsByField = Object.fromEntries(
      body.data.errors.map((e: { field: string; message: string }) => [
        e.field,
        e.message,
      ]),
    );

    expect(errorsByField.email).toContain("email");
    expect(errorsByField.password).toBeDefined();
    expect(errorsByField["nested.field"]).toBeDefined();
  });

  test("ClientError.fromJSON reconstructs validation errors correctly", async () => {
    const req = new Request("http://localhost/rpc/test.validateUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad", password: "x", nested: {} }),
    });

    const response = await handler(req);
    const body = await response.json();

    const error = ClientError.fromJSON(body);
    expect(error).toBeInstanceOf(ClientError);
    expect(error.code).toBe("validation");
    expect(error.isValidationError()).toBe(true);

    if (error.isValidationError()) {
      expect(error.data.errors.length).toBeGreaterThan(0);
      expect(error.data.errors[0]).toHaveProperty("field");
      expect(error.data.errors[0]).toHaveProperty("message");
    }
  });

  test("ClientError.validation() creates proper validation error", () => {
    const error = ClientError.validation([
      { field: "email", message: "Invalid email" },
      { field: "password", message: "Too short" },
    ]);

    expect(error.code).toBe("validation");
    expect(error.status).toBe(400);
    expect(error.isValidationError()).toBe(true);

    if (error.isValidationError()) {
      expect(error.data.errors).toHaveLength(2);
    }

    // Serializes correctly
    const json = error.toJSON();
    expect((json.data as { errors: unknown[] }).errors).toHaveLength(2);

    // Reconstructs correctly
    const reconstructed = ClientError.fromJSON(json);
    expect(reconstructed.isValidationError()).toBe(true);
  });
});
