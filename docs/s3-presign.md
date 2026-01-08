# S3 Presigned POST

Generate presigned POST URLs for direct S3 uploads with policy constraints. Unlike simple presigned PUT URLs, POST policies allow enforcing content-type, file size limits, and key prefixes server-side.

## Import

```ts
import { presignPost, type S3PresignConfig, type PresignPostOptions } from "bunfx/server";
```

## Basic Usage

```ts
const config: S3PresignConfig = {
  bucket: "my-bucket",
  region: "us-east-1",
  endpoint: "s3.us-east-1.amazonaws.com",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
};

// Generate presigned POST for a specific key
const { url, fields } = await presignPost(config, {
  key: "uploads/image.webp",
  contentType: "image/webp",
  contentLengthRange: [0, 500 * 1024], // max 500KB
  expiresIn: 300, // 5 minutes
});

// Client-side upload using FormData
const formData = new FormData();
for (const [key, value] of Object.entries(fields)) {
  formData.append(key, value);
}
formData.append("file", file); // File must be last!

await fetch(url, { method: "POST", body: formData });
```

## S3PresignConfig

Configuration for S3-compatible storage.

```ts
type S3PresignConfig = {
  bucket: string;        // S3 bucket name
  region: string;        // AWS region (e.g., "us-east-1") or "auto" for R2
  endpoint: string;      // S3 endpoint (e.g., "s3.us-east-1.amazonaws.com")
  accessKeyId: string;   // AWS access key ID
  secretAccessKey: string; // AWS secret access key
};
```

### Cloudflare R2 Example

```ts
const r2Config: S3PresignConfig = {
  bucket: "my-bucket",
  region: "auto",
  endpoint: "abc123.r2.cloudflarestorage.com",
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
};
```

## PresignPostOptions

Options for generating the presigned POST.

```ts
type PresignPostOptions = {
  key?: string;                       // Exact key to upload to
  keyPrefix?: string;                 // Key prefix (uses ${filename} variable)
  contentType?: string;               // Required content type
  contentLengthRange?: [number, number]; // [min, max] in bytes
  expiresIn?: number;                 // Seconds until expiration (default 3600)
  acl?: "private" | "public-read";    // ACL policy
};
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | - | Exact key for upload (mutually exclusive with `keyPrefix`) |
| `keyPrefix` | `string` | - | Key prefix; client provides suffix via `${filename}` |
| `contentType` | `string` | - | Required content type (e.g., `"image/webp"`) |
| `contentLengthRange` | `[number, number]` | - | File size limits `[min, max]` in bytes |
| `expiresIn` | `number` | `3600` | URL expiration in seconds |
| `acl` | `string` | - | Access control (`"private"` or `"public-read"`) |

Either `key` or `keyPrefix` must be provided.

## Policy Constraints

S3 POST policies enforce constraints server-side. If an upload violates any constraint, S3 rejects it.

### Content-Type Enforcement

```ts
const { url, fields } = await presignPost(config, {
  key: "images/photo.webp",
  contentType: "image/webp", // Only image/webp allowed
});
```

### File Size Limits

```ts
const { url, fields } = await presignPost(config, {
  key: "uploads/document.pdf",
  contentLengthRange: [1, 10 * 1024 * 1024], // 1 byte to 10MB
});
```

### Key Prefix (User Uploads)

Allow users to upload to their own folder:

```ts
const { url, fields } = await presignPost(config, {
  keyPrefix: `uploads/user-${userId}/`,
  // Client can upload to uploads/user-123/anything.jpg
});
```

## PresignPostResult

```ts
type PresignPostResult = {
  url: string;                    // URL to POST to
  fields: Record<string, string>; // Form fields to include
};
```

The `fields` object contains all required AWS Signature v4 fields:
- `key` - Upload key
- `policy` - Base64-encoded policy document
- `x-amz-algorithm` - Always `"AWS4-HMAC-SHA256"`
- `x-amz-credential` - Credential scope
- `x-amz-date` - Request timestamp
- `x-amz-signature` - HMAC-SHA256 signature
- `Content-Type` - (if specified)
- `acl` - (if specified)

## Full RPC Example

Server-side endpoint to generate upload URLs:

```ts
import { endpoint, ClientError } from "bunfx";
import { presignPost, type S3PresignConfig } from "bunfx/server";

const s3Config: S3PresignConfig = {
  bucket: process.env.S3_BUCKET!,
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT!,
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
};

export const getAvatarUploadUrl = endpoint({
  schema: z.object({}),
  async fn({ req }) {
    const session = await sessions.get(req);
    if (!session) throw ClientError.unauthorized();

    const key = `avatars/${session.data.userId}.webp`;

    const { url, fields } = await presignPost(s3Config, {
      key,
      contentType: "image/webp",
      contentLengthRange: [0, 500 * 1024], // max 500KB
      expiresIn: 300, // 5 minutes
    });

    return { url, fields, key, maxSize: 500 * 1024 };
  },
});
```

Client-side upload:

```ts
const { url, fields } = await rpc.getAvatarUploadUrl({});

const formData = new FormData();
for (const [key, value] of Object.entries(fields)) {
  formData.append(key, value);
}
formData.append("file", croppedImageBlob);

const response = await fetch(url, { method: "POST", body: formData });
if (!response.ok) {
  throw new Error("Upload failed");
}
```

## Security Considerations

### Validate After Upload

The presigned URL only authorizes the upload. Always verify the file exists before updating your database:

```ts
import { S3Client } from "bun";

export const confirmAvatarUpload = endpoint({
  schema: z.object({}),
  async fn({ req }) {
    const session = await sessions.get(req);
    if (!session) throw ClientError.unauthorized();

    const key = `avatars/${session.data.userId}.webp`;
    const s3 = new S3Client(s3Config);
    const exists = await s3.file(key).exists();

    if (!exists) {
      throw ClientError.badRequest("Upload not found");
    }

    // Update database with the new avatar path
    await db.users.update(session.data.userId, { avatarPath: key });
    return { success: true, path: key };
  },
});
```

### Short Expiration

Use short expiration times (5-15 minutes) for upload URLs:

```ts
const { url, fields } = await presignPost(config, {
  key,
  expiresIn: 300, // 5 minutes is usually enough
});
```

### Content-Type + Size Limits

Always specify both content-type and size limits for user uploads:

```ts
const { url, fields } = await presignPost(config, {
  key,
  contentType: "image/webp",         // Only allow WebP
  contentLengthRange: [1, 2 * 1024 * 1024], // 1 byte to 2MB
});
```

## Technical Details

### AWS Signature v4

This module implements AWS Signature v4 for POST policies using the Web Crypto API:

1. Build policy document with conditions
2. Base64-encode the policy
3. Calculate HMAC-SHA256 signing key: `AWS4` + secret → date → region → `s3` → `aws4_request`
4. Sign the policy with the signing key

### URL Format

Uses path-style URLs for S3 compatibility:

```
https://{endpoint}/{bucket}
```

### POST vs PUT

| Feature | Presigned PUT | Presigned POST |
|---------|---------------|----------------|
| Content-Type enforcement | No | Yes |
| File size limits | No | Yes |
| Key prefix validation | No | Yes |
| ACL policy | Limited | Full |
| Browser FormData | Complex | Native |

Use POST when you need any policy constraints.
