# Zod Utilities

Custom Zod validators for common validation patterns.

## Import

```ts
import { zHtml } from "bunfx/zod";
```

## zHtml

Creates a Zod schema for sanitized HTML strings. Applies HTML sanitization via `transform()`, so the output value is always sanitized when you access it.

```ts
import { zHtml } from "bunfx/zod";
import { z } from "zod";

const schema = z.object({
  title: zHtml(),
  description: zHtml({ maxLength: 5000 }),
});

// Input
const input = {
  title: '<script>alert("xss")</script><p>Hello</p>',
  description: '<p onclick="bad()">Description</p>',
};

// After parsing, values are sanitized
const result = schema.parse(input);
// result.title === "<p>Hello</p>"
// result.description === "<p>Description</p>"
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxLength` | `number` | `10000` | Maximum string length before sanitization |
| `sanitizeOptions` | `SanitizeOptions` | `richTextPreset` | Sanitizer configuration (see [Sanitize](./sanitize.md)) |

### Examples

```ts
import { zHtml } from "bunfx/zod";
import { inlinePreset } from "bunfx/sanitize";
import { z } from "zod";

// Default: 10000 chars, richTextPreset
const content = zHtml();

// Custom max length
const title = zHtml({ maxLength: 500 });

// Inline-only sanitization (no block elements)
const comment = zHtml({ sanitizeOptions: inlinePreset });

// Nullable HTML field
const bio = zHtml().nullable();

// Optional HTML field
const notes = zHtml().optional();
```

### Use with RPC Endpoints

The primary use case is sanitizing HTML from rich text editors in RPC endpoints:

```ts
import { endpoint, zHtml } from "bunfx";
import { z } from "zod";

export const savePost = endpoint({
  schema: z.object({
    title: zHtml({ maxLength: 200 }),
    content: zHtml(),
  }),
  async fn({ opts }) {
    // opts.title and opts.content are already sanitized
    await db.posts.insert({
      title: opts.title,
      content: opts.content,
    });
  },
});
```

### Why Use zHtml Instead of Manual Sanitization?

**Before** (manual sanitization):
```ts
import { endpoint, sanitizeHtml } from "bunfx";
import { z } from "zod";

export const savePost = endpoint({
  schema: z.object({
    title: z.string().max(200),
    content: z.string().max(10000),
  }),
  async fn({ opts }) {
    // Easy to forget!
    const sanitizedTitle = sanitizeHtml(opts.title);
    const sanitizedContent = sanitizeHtml(opts.content);

    await db.posts.insert({
      title: sanitizedTitle,
      content: sanitizedContent,
    });
  },
});
```

**After** (with zHtml):
```ts
import { endpoint, zHtml } from "bunfx";
import { z } from "zod";

export const savePost = endpoint({
  schema: z.object({
    title: zHtml({ maxLength: 200 }),
    content: zHtml(),
  }),
  async fn({ opts }) {
    // Already sanitized - can't forget
    await db.posts.insert({
      title: opts.title,
      content: opts.content,
    });
  },
});
```

Benefits:
- **Impossible to forget** - Sanitization happens during schema validation
- **Type-safe** - The output type is `string`, always sanitized
- **Declarative** - Schema documents that the field contains HTML
- **Consistent** - Same sanitization rules applied everywhere

## API Reference

### `zHtml(options?)`

Returns a Zod schema that validates a string and transforms it by applying HTML sanitization.

```ts
function zHtml(options?: {
  maxLength?: number;
  sanitizeOptions?: SanitizeOptions;
}): z.ZodEffects<z.ZodString, string, string>
```

The returned schema:
1. Validates the input is a string
2. Validates the string length is within `maxLength`
3. Transforms the string by applying `sanitizeHtml()`

The transformation uses Zod's `.transform()`, so the sanitized value is available in your endpoint function.
