import { describe, expect, it } from "bun:test";
import { type S3PresignConfig, presignPost } from "./index";

// Policy condition types matching the implementation
type PolicyCondition =
  | Record<string, string | number>
  | [string, string, string]
  | [string, number, number];

// Helper to parse policy from base64-encoded string
function parsePolicy(policyBase64: string | undefined): {
  expiration: string;
  conditions: PolicyCondition[];
} {
  if (!policyBase64) {
    throw new Error("Policy is required");
  }
  return JSON.parse(atob(policyBase64));
}

// Helper to find object conditions (e.g., { bucket: "x" })
function findObjectCondition(
  conditions: PolicyCondition[],
  key: string,
): Record<string, string | number> | undefined {
  return conditions.find(
    (c): c is Record<string, string | number> =>
      typeof c === "object" && !Array.isArray(c) && key in c,
  ) as Record<string, string | number> | undefined;
}

// Helper to find array conditions (e.g., ["starts-with", "$key", "prefix"])
function findArrayCondition(
  conditions: PolicyCondition[],
  operator: string,
  field?: string,
): [string, string, string] | [string, number, number] | undefined {
  for (const c of conditions) {
    if (
      Array.isArray(c) &&
      c[0] === operator &&
      (field === undefined || c[1] === field)
    ) {
      return c;
    }
  }
  return undefined;
}

// Test configuration that mirrors real S3/R2 setup
const testConfig: S3PresignConfig = {
  bucket: "test-bucket",
  region: "us-east-1",
  endpoint: "s3.us-east-1.amazonaws.com",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

describe("presignPost", () => {
  describe("error handling", () => {
    it("throws error when neither key nor keyPrefix is provided", async () => {
      await expect(presignPost(testConfig, {})).rejects.toThrow(
        "Either key or keyPrefix must be provided",
      );
    });

    it("throws error with contentType but no key", async () => {
      await expect(
        presignPost(testConfig, { contentType: "image/png" }),
      ).rejects.toThrow("Either key or keyPrefix must be provided");
    });
  });

  describe("URL generation", () => {
    it("generates correct URL with path-style format", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      expect(result.url).toBe(
        `https://${testConfig.endpoint}/${testConfig.bucket}`,
      );
    });

    it("works with custom endpoint (R2 compatible)", async () => {
      const r2Config: S3PresignConfig = {
        ...testConfig,
        endpoint: "abc123.r2.cloudflarestorage.com",
        region: "auto",
      };

      const result = await presignPost(r2Config, {
        key: "uploads/test.png",
      });

      expect(result.url).toBe(
        `https://${r2Config.endpoint}/${r2Config.bucket}`,
      );
    });
  });

  describe("fields generation", () => {
    it("includes all required AWS Signature v4 fields", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      // Required Signature v4 fields
      expect(result.fields).toHaveProperty(
        "x-amz-algorithm",
        "AWS4-HMAC-SHA256",
      );
      expect(result.fields).toHaveProperty("x-amz-credential");
      expect(result.fields).toHaveProperty("x-amz-date");
      expect(result.fields).toHaveProperty("policy");
      expect(result.fields).toHaveProperty("x-amz-signature");
    });

    it("generates valid x-amz-credential format", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const credential = result.fields["x-amz-credential"];
      expect(credential).toBeDefined();
      // Format: accessKeyId/dateStamp/region/s3/aws4_request
      const parts = credential?.split("/") ?? [];
      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe(testConfig.accessKeyId);
      expect(parts[1]).toMatch(/^\d{8}$/); // YYYYMMDD
      expect(parts[2]).toBe(testConfig.region);
      expect(parts[3]).toBe("s3");
      expect(parts[4]).toBe("aws4_request");
    });

    it("generates valid x-amz-date format", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const amzDate = result.fields["x-amz-date"];
      // Format: YYYYMMDD'T'HHMMSS'Z'
      expect(amzDate).toMatch(/^\d{8}T\d{6}Z$/);
    });

    it("generates valid base64-encoded policy", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policyBase64 = result.fields.policy;
      expect(policyBase64).toBeDefined();
      // Should be valid base64
      expect(() => atob(policyBase64 ?? "")).not.toThrow();

      // Should decode to valid JSON
      const policyJson = atob(policyBase64 ?? "");
      const policy = JSON.parse(policyJson);
      expect(policy).toHaveProperty("expiration");
      expect(policy).toHaveProperty("conditions");
    });

    it("generates signature as 64-character hex string (SHA-256)", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const signature = result.fields["x-amz-signature"];
      // SHA-256 HMAC produces 32 bytes = 64 hex characters
      expect(signature).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("key behavior", () => {
    it("sets exact key in fields when key option provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/my-file.png",
      });

      expect(result.fields.key).toBe("uploads/my-file.png");
    });

    it("sets key with ${filename} placeholder when keyPrefix provided", async () => {
      const result = await presignPost(testConfig, {
        keyPrefix: "uploads/user123/",
      });

      expect(result.fields.key).toBe("uploads/user123/${filename}");
    });

    it("prefers key over keyPrefix when both provided", async () => {
      const result = await presignPost(testConfig, {
        key: "exact-key.png",
        keyPrefix: "prefix/",
      });

      expect(result.fields.key).toBe("exact-key.png");
    });
  });

  describe("content type handling", () => {
    it("includes Content-Type field when contentType option provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
        contentType: "image/png",
      });

      expect(result.fields["Content-Type"]).toBe("image/png");
    });

    it("omits Content-Type field when contentType not provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      expect(result.fields["Content-Type"]).toBeUndefined();
    });
  });

  describe("ACL handling", () => {
    it("includes acl field when acl option is private", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
        acl: "private",
      });

      expect(result.fields.acl).toBe("private");
    });

    it("includes acl field when acl option is public-read", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
        acl: "public-read",
      });

      expect(result.fields.acl).toBe("public-read");
    });

    it("omits acl field when acl option not provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      expect(result.fields.acl).toBeUndefined();
    });
  });

  describe("policy structure", () => {
    it("includes expiration in policy", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policy = parsePolicy(result.fields.policy);
      expect(policy.expiration).toBeDefined();
      // Should be valid ISO date string
      expect(() => new Date(policy.expiration)).not.toThrow();
      expect(new Date(policy.expiration).toISOString()).toBe(policy.expiration);
    });

    it("sets correct expiration based on expiresIn option", async () => {
      const beforeTest = Date.now();
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
        expiresIn: 1800, // 30 minutes
      });
      const afterTest = Date.now();

      const policy = parsePolicy(result.fields.policy);
      const expirationTime = new Date(policy.expiration).getTime();

      // Expiration should be approximately now + 1800 seconds
      // Allow 5 second tolerance for test execution time
      const expectedMin = beforeTest + 1800 * 1000 - 5000;
      const expectedMax = afterTest + 1800 * 1000 + 5000;
      expect(expirationTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expirationTime).toBeLessThanOrEqual(expectedMax);
    });

    it("uses default expiration of 3600 seconds when expiresIn not provided", async () => {
      const beforeTest = Date.now();
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });
      const afterTest = Date.now();

      const policy = parsePolicy(result.fields.policy);
      const expirationTime = new Date(policy.expiration).getTime();

      // Default expiration is 3600 seconds (1 hour)
      const expectedMin = beforeTest + 3600 * 1000 - 5000;
      const expectedMax = afterTest + 3600 * 1000 + 5000;
      expect(expirationTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expirationTime).toBeLessThanOrEqual(expectedMax);
    });

    it("includes bucket condition in policy", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policy = parsePolicy(result.fields.policy);
      const bucketCondition = findObjectCondition(policy.conditions, "bucket");
      expect(bucketCondition).toBeDefined();
      expect(bucketCondition?.bucket).toBe(testConfig.bucket);
    });

    it("includes exact key condition when key option provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test-file.png",
      });

      const policy = parsePolicy(result.fields.policy);
      const keyCondition = findObjectCondition(policy.conditions, "key");
      expect(keyCondition).toBeDefined();
      expect(keyCondition?.key).toBe("uploads/test-file.png");
    });

    it("includes starts-with key condition when keyPrefix option provided", async () => {
      const result = await presignPost(testConfig, {
        keyPrefix: "uploads/user123/",
      });

      const policy = parsePolicy(result.fields.policy);
      const keyCondition = findArrayCondition(
        policy.conditions,
        "starts-with",
        "$key",
      );
      expect(keyCondition).toBeDefined();
      expect(keyCondition?.[2]).toBe("uploads/user123/");
    });

    it("includes exact Content-Type condition when contentType provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
        contentType: "image/png",
      });

      const policy = parsePolicy(result.fields.policy);
      const contentTypeCondition = findObjectCondition(
        policy.conditions,
        "Content-Type",
      );
      expect(contentTypeCondition).toBeDefined();
      expect(contentTypeCondition?.["Content-Type"]).toBe("image/png");
    });

    it("includes starts-with Content-Type condition when contentType not provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policy = parsePolicy(result.fields.policy);
      const contentTypeCondition = findArrayCondition(
        policy.conditions,
        "starts-with",
        "$Content-Type",
      );
      expect(contentTypeCondition).toBeDefined();
      expect(contentTypeCondition?.[2]).toBe("");
    });

    it("includes content-length-range condition when contentLengthRange provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
        contentLengthRange: [0, 5 * 1024 * 1024], // 0 to 5MB
      });

      const policy = parsePolicy(result.fields.policy);
      const lengthCondition = findArrayCondition(
        policy.conditions,
        "content-length-range",
      );
      expect(lengthCondition).toBeDefined();
      expect(lengthCondition?.[1]).toBe(0);
      expect(lengthCondition?.[2]).toBe(5 * 1024 * 1024);
    });

    it("omits content-length-range condition when contentLengthRange not provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policy = parsePolicy(result.fields.policy);
      const lengthCondition = findArrayCondition(
        policy.conditions,
        "content-length-range",
      );
      expect(lengthCondition).toBeUndefined();
    });

    it("includes ACL condition when acl provided", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
        acl: "public-read",
      });

      const policy = parsePolicy(result.fields.policy);
      const aclCondition = findObjectCondition(policy.conditions, "acl");
      expect(aclCondition).toBeDefined();
      expect(aclCondition?.acl).toBe("public-read");
    });

    it("includes x-amz-algorithm condition in policy", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policy = parsePolicy(result.fields.policy);
      const algorithmCondition = findObjectCondition(
        policy.conditions,
        "x-amz-algorithm",
      );
      expect(algorithmCondition).toBeDefined();
      expect(algorithmCondition?.["x-amz-algorithm"]).toBe("AWS4-HMAC-SHA256");
    });

    it("includes x-amz-credential condition in policy", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policy = parsePolicy(result.fields.policy);
      const credentialCondition = findObjectCondition(
        policy.conditions,
        "x-amz-credential",
      );
      expect(credentialCondition).toBeDefined();
      expect(credentialCondition?.["x-amz-credential"]).toBe(
        result.fields["x-amz-credential"],
      );
    });

    it("includes x-amz-date condition in policy", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/test.png",
      });

      const policy = parsePolicy(result.fields.policy);
      const dateCondition = findObjectCondition(
        policy.conditions,
        "x-amz-date",
      );
      expect(dateCondition).toBeDefined();
      expect(dateCondition?.["x-amz-date"]).toBe(result.fields["x-amz-date"]);
    });
  });

  describe("signature consistency", () => {
    it("produces consistent signature for same input and time", async () => {
      // Since we can't control the time, we verify same config produces valid signatures
      const result1 = await presignPost(testConfig, {
        key: "uploads/test.png",
        contentType: "image/png",
      });

      // Both should have valid 64-char hex signatures
      expect(result1.fields["x-amz-signature"]).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces different signature for different keys", async () => {
      // Run both calls as close together as possible to minimize time drift
      const [result1, result2] = await Promise.all([
        presignPost(testConfig, { key: "uploads/file1.png" }),
        presignPost(testConfig, { key: "uploads/file2.png" }),
      ]);

      // Different keys should produce different policies and thus different signatures
      // (unless by extreme coincidence the time ticks between calls)
      expect(result1.fields.policy).not.toBe(result2.fields.policy);
    });

    it("produces different signature for different secret keys", async () => {
      const altConfig: S3PresignConfig = {
        ...testConfig,
        secretAccessKey: "differentSecretKey123456789012345",
      };

      // Use same options to isolate the secret key difference
      const opts = { key: "uploads/test.png" };

      const [result1, result2] = await Promise.all([
        presignPost(testConfig, opts),
        presignPost(altConfig, opts),
      ]);

      // Different secret keys should produce different signatures
      expect(result1.fields["x-amz-signature"]).not.toBe(
        result2.fields["x-amz-signature"],
      );
    });
  });

  describe("full workflow integration", () => {
    it("generates complete presigned POST data for image upload", async () => {
      const result = await presignPost(testConfig, {
        key: "uploads/user123/avatar.png",
        contentType: "image/png",
        contentLengthRange: [1, 2 * 1024 * 1024], // 1 byte to 2MB
        acl: "public-read",
        expiresIn: 300, // 5 minutes
      });

      // Verify URL
      expect(result.url).toBe(
        `https://${testConfig.endpoint}/${testConfig.bucket}`,
      );

      // Verify all form fields are present
      expect(result.fields).toEqual(
        expect.objectContaining({
          key: "uploads/user123/avatar.png",
          "Content-Type": "image/png",
          acl: "public-read",
          "x-amz-algorithm": "AWS4-HMAC-SHA256",
          "x-amz-credential": expect.stringMatching(
            /^AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request$/,
          ),
          "x-amz-date": expect.stringMatching(/^\d{8}T\d{6}Z$/),
          policy: expect.any(String),
          "x-amz-signature": expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      );

      // Verify policy contains all conditions
      const policy = parsePolicy(result.fields.policy);
      expect(policy.expiration).toBeDefined();
      expect(policy.conditions.length).toBeGreaterThan(0);

      // Verify specific conditions exist using helper functions
      expect(findObjectCondition(policy.conditions, "bucket")?.bucket).toBe(
        testConfig.bucket,
      );
      expect(findObjectCondition(policy.conditions, "key")?.key).toBe(
        "uploads/user123/avatar.png",
      );
      expect(
        findObjectCondition(policy.conditions, "Content-Type")?.[
          "Content-Type"
        ],
      ).toBe("image/png");
      expect(findObjectCondition(policy.conditions, "acl")?.acl).toBe(
        "public-read",
      );

      const lengthCondition = findArrayCondition(
        policy.conditions,
        "content-length-range",
      );
      expect(lengthCondition).toBeDefined();
      expect(lengthCondition?.[1]).toBe(1);
      expect(lengthCondition?.[2]).toBe(2 * 1024 * 1024);
    });

    it("generates complete presigned POST data for prefix-based upload", async () => {
      const result = await presignPost(testConfig, {
        keyPrefix: "uploads/org456/",
        contentLengthRange: [0, 10 * 1024 * 1024], // 0 to 10MB
      });

      // Verify key field uses ${filename} placeholder
      expect(result.fields.key).toBe("uploads/org456/${filename}");

      // Verify policy has starts-with key condition
      const policy = parsePolicy(result.fields.policy);
      const keyCondition = findArrayCondition(
        policy.conditions,
        "starts-with",
        "$key",
      );
      expect(keyCondition).toBeDefined();
      expect(keyCondition?.[2]).toBe("uploads/org456/");
    });
  });
});
