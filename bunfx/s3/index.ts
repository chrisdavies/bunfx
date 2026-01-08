/**
 * S3 Presigned POST URL generator with policy conditions.
 *
 * Unlike Bun's built-in presign (which lacks POST policy support),
 * this implements proper S3 POST policies with content-type,
 * content-length-range, and key constraints.
 *
 * @see https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
 */

export type S3PresignConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type PresignPostOptions = {
  /** Exact key to upload to */
  key?: string;
  /** Key prefix (client chooses suffix via ${filename} or explicit key field) */
  keyPrefix?: string;
  /** Required content type */
  contentType?: string;
  /** Content length range [min, max] in bytes */
  contentLengthRange?: [number, number];
  /** Seconds until expiration (default 3600) */
  expiresIn?: number;
  /** ACL policy */
  acl?: "private" | "public-read";
};

export type PresignPostResult = {
  /** URL to POST to */
  url: string;
  /** Form fields to include in the POST body */
  fields: Record<string, string>;
};

/**
 * Generate a presigned POST URL with policy constraints.
 *
 * @example
 * ```ts
 * const { url, fields } = await presignPost(config, {
 *   key: "uploads/image.webp",
 *   contentType: "image/webp",
 *   contentLengthRange: [0, 500 * 1024], // max 500KB
 *   expiresIn: 300, // 5 minutes
 * });
 *
 * // Client-side upload
 * const formData = new FormData();
 * for (const [key, value] of Object.entries(fields)) {
 *   formData.append(key, value);
 * }
 * formData.append("file", file); // File must be last
 * await fetch(url, { method: "POST", body: formData });
 * ```
 */
export async function presignPost(
  s3Config: S3PresignConfig,
  opts: PresignPostOptions,
): Promise<PresignPostResult> {
  if (!opts.key && !opts.keyPrefix) {
    throw new Error("Either key or keyPrefix must be provided");
  }

  const now = new Date();
  const expiresIn = opts.expiresIn ?? 3600;
  const expiration = new Date(now.getTime() + expiresIn * 1000);

  // Format dates for AWS
  const dateStamp = formatDateStamp(now); // YYYYMMDD
  const amzDate = formatAmzDate(now); // YYYYMMDD'T'HHMMSS'Z'
  const credential = `${s3Config.accessKeyId}/${dateStamp}/${s3Config.region}/s3/aws4_request`;

  // Build policy conditions
  const conditions: PolicyCondition[] = [
    { bucket: s3Config.bucket },
    ["starts-with", "$Content-Type", opts.contentType ?? ""],
    { "x-amz-algorithm": "AWS4-HMAC-SHA256" },
    { "x-amz-credential": credential },
    { "x-amz-date": amzDate },
  ];

  // Key condition
  if (opts.key) {
    conditions.push({ key: opts.key });
  } else if (opts.keyPrefix) {
    conditions.push(["starts-with", "$key", opts.keyPrefix]);
  }

  // Content-Type condition (exact match if specified)
  if (opts.contentType) {
    // Replace the starts-with with exact match
    conditions[1] = { "Content-Type": opts.contentType };
  }

  // Content-Length range
  if (opts.contentLengthRange) {
    conditions.push([
      "content-length-range",
      opts.contentLengthRange[0],
      opts.contentLengthRange[1],
    ]);
  }

  // ACL
  if (opts.acl) {
    conditions.push({ acl: opts.acl });
  }

  // Build policy document
  const policy = {
    expiration: expiration.toISOString(),
    conditions,
  };

  // Base64 encode policy
  const policyBase64 = btoa(JSON.stringify(policy));

  // Calculate signature using AWS Signature v4
  const signingKey = await getSigningKey(
    s3Config.secretAccessKey,
    dateStamp,
    s3Config.region,
    "s3",
  );
  const signature = await hmacHex(signingKey, policyBase64);

  // Build form fields
  const fields: Record<string, string> = {
    "x-amz-algorithm": "AWS4-HMAC-SHA256",
    "x-amz-credential": credential,
    "x-amz-date": amzDate,
    policy: policyBase64,
    "x-amz-signature": signature,
  };

  if (opts.key) {
    fields.key = opts.key;
  } else if (opts.keyPrefix) {
    // Client must provide key field starting with this prefix
    // ${filename} is an S3 variable that gets replaced with the uploaded filename
    fields.key = `${opts.keyPrefix}\${filename}`;
  }

  if (opts.contentType) {
    fields["Content-Type"] = opts.contentType;
  }

  if (opts.acl) {
    fields.acl = opts.acl;
  }

  // Build URL
  // For path-style: https://endpoint/bucket
  // For virtual-hosted: https://bucket.endpoint
  const url = `https://${s3Config.endpoint}/${s3Config.bucket}`;

  return { url, fields };
}

// Policy condition types
type PolicyCondition =
  | Record<string, string>
  | ["starts-with", string, string]
  | ["content-length-range", number, number]
  | ["eq", string, string];

// Date formatting helpers
function formatDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatAmzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

// AWS Signature v4 helpers using Web Crypto API

const encoder = new TextEncoder();

async function hmac(
  key: ArrayBuffer | string,
  data: string,
): Promise<ArrayBuffer> {
  const keyData =
    typeof key === "string" ? encoder.encode(key) : new Uint8Array(key);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  return kSigning;
}
