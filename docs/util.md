# Util

Internal utility functions used by other bunfx modules.

## Import

```ts
import { transform } from "bunfx/util/transform";
```

## transform

Generic object transformation utility with structural sharing. Only creates new objects when changes are detected.

```ts
import { transform } from "bunfx/util/transform";

const result = transform(obj, {
  test: (key, value) => boolean,  // Should this key/value be transformed?
  key?: (key) => string,          // Transform the key
  value?: (value) => unknown,     // Transform the value
});
```

### Options

```ts
type TransformOptions = {
  test: (key: string, value: unknown) => boolean;
  key?: (key: string) => string;
  value?: (value: unknown) => unknown;
};
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `test` | `(key, value) => boolean` | Yes | Return `true` to transform this key/value |
| `key` | `(key) => string` | No | Transform the key name |
| `value` | `(value) => unknown` | No | Transform the value (stops recursion) |

### Key Transformation

Rename object keys matching a pattern:

```ts
const obj = { user_name: "alice", user_email: "alice@example.com" };

const result = transform(obj, {
  test: (k) => k.startsWith("user_"),
  key: (k) => k.replace("user_", ""),
});
// { name: "alice", email: "alice@example.com" }
```

### Value Transformation

Replace values matching a pattern:

```ts
const obj = { password: "secret", name: "alice" };

const result = transform(obj, {
  test: (k) => k === "password",
  value: () => "[REDACTED]",
});
// { password: "[REDACTED]", name: "alice" }
```

### Combined Key and Value

```ts
const result = transform(obj, {
  test: (k) => k.includes("secret"),
  key: (k) => k.replace("secret", "hidden"),
  value: () => "***",
});
```

## Behavior

### Structural Sharing

If no changes are needed, the original object is returned:

```ts
const obj = { name: "alice" };
const result = transform(obj, {
  test: (k) => k === "password",  // No match
  value: () => "***",
});

obj === result; // true - same reference
```

### Deep Recursion

Nested objects are transformed recursively:

```ts
const obj = {
  user: {
    profile: {
      secret_key: "abc123",
    },
  },
};

const result = transform(obj, {
  test: (k) => k.startsWith("secret_"),
  value: () => "***",
});
// { user: { profile: { secret_key: "***" } } }
```

### Circular References

Circular references are detected and replaced with `"[Circular]"`:

```ts
const obj = { name: "test" };
obj.self = obj;

const result = transform(obj, { test: () => false });
// { name: "test", self: "[Circular]" }
```

### Error Handling

Error objects are converted to plain objects with `message` and `stack`:

```ts
const obj = { err: new Error("Something failed") };

const result = transform(obj, { test: () => false });
// { err: { message: "Something failed", stack: "Error: ..." } }
```

### Value Types

These types are not transformed (treated as primitives):
- `null`, `undefined`
- `string`, `number`, `boolean`
- `Date`, `RegExp`
- Boxed primitives (`Number`, `String`, `Boolean`)

## Usage in bunfx

The `transform` function is used internally by:

- **`camelize`** - Transform snake_case keys to camelCase
- **`logger`** - Redact sensitive keys in log output

You typically won't need to use `transform` directly unless building custom transformations.
