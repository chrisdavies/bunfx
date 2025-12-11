/**
 * Generic object transformation utility.
 *
 * Only creates new objects when changes are detected (structural sharing).
 * Handles circular references and deep nesting.
 */

export type TransformOptions = {
  /** Test if a key/value pair should be transformed */
  test: (key: string, value: unknown) => boolean;
  /** Transform the key (optional) */
  key?: (key: string) => string;
  /** Transform the value (optional - if provided, won't recurse into matched values) */
  value?: (value: unknown) => unknown;
};

function isValueType(v: unknown): boolean {
  if (v === null || (typeof v !== "object" && typeof v !== "function")) {
    return true;
  }
  return (
    v instanceof Date ||
    v instanceof RegExp ||
    v instanceof Number ||
    v instanceof String ||
    v instanceof Boolean
  );
}

export function transform<T>(
  obj: T,
  opts: TransformOptions,
  seen = new WeakSet(),
): T {
  if (isValueType(obj)) return obj;

  if (obj instanceof Error) {
    return { message: obj.message, stack: obj.stack } as T;
  }
  if (seen.has(obj as object)) {
    return "[Circular]" as T;
  }
  seen.add(obj as object);

  let result = obj;
  const isArray = Array.isArray(obj);

  const assign = (k: string | number, v: unknown, newKey?: string) => {
    if (result === obj) {
      result = (isArray ? [...obj] : { ...obj }) as T;
    }
    if (newKey !== undefined && newKey !== k) {
      delete (result as Record<string, unknown>)[k as string];
      (result as Record<string, unknown>)[newKey] = v;
    } else {
      (result as Record<string | number, unknown>)[k] = v;
    }
  };

  for (const k in obj) {
    const v1 = (obj as Record<string, unknown>)[k];
    const matched = opts.test(k, v1);

    if (matched) {
      const newKey = opts.key?.(k) ?? k;
      // If value transform provided, use it and don't recurse (value is replaced)
      // If key transform only, recurse into the value
      const newVal = opts.value ? opts.value(v1) : transform(v1, opts, seen);
      assign(k, newVal, newKey);
    } else if (!isValueType(v1)) {
      const v2 = transform(v1, opts, seen);
      if (v1 !== v2) {
        assign(k, v2);
      }
    }
  }

  return result;
}
