/**
 * Transform object keys to camelCase.
 *
 * Handles snake_case, PascalCase, and kebab-case.
 * For Bun SQL results, checks column names first and skips transform if already camelCase.
 * Only creates new objects when changes are detected (structural sharing).
 */

import { transform } from "../util/transform";

// Check if string needs camelCase transformation
// Matches: underscore, dash, or uppercase first letter
const needsTransformRegex = /[_-]|^[A-Z]/;
function needsCamelTransform(s: string): boolean {
  return needsTransformRegex.test(s);
}

// Convert to camelCase from snake_case, PascalCase, or kebab-case
function toCamelCase(s: string): string {
  // ^[A-Z] matches uppercase first letter (PascalCase) → lowercase it
  // [_-](.) matches separator + next char → uppercase it
  return s.replace(/^[A-Z]|[_-](.)/g, (m, c) =>
    c ? c.toUpperCase() : m.toLowerCase(),
  );
}

// Detect Bun SQL result by checking for `command` property
function isBunSQLResult(
  value: unknown,
): value is unknown[] & { command: string } {
  return Array.isArray(value) && "command" in value;
}

// Type utilities for camelCase conversion
// Handles: snake_case, kebab-case, PascalCase
type SnakeToCamel<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<SnakeToCamel<Q>>}`
  : S;

type KebabToCamel<S extends string> = S extends `${infer P}-${infer Q}`
  ? `${P}${Capitalize<KebabToCamel<Q>>}`
  : S;

type CamelCase<S extends string> = Uncapitalize<KebabToCamel<SnakeToCamel<S>>>;

type Camelize<T> = T extends (infer U)[]
  ? Camelize<U>[]
  : T extends object
    ? { [K in keyof T as CamelCase<K & string>]: Camelize<T[K]> }
    : T;

/**
 * Transform query results from snake_case to camelCase.
 *
 * @example
 * // With Bun SQL
 * const users = await camelize(sql`SELECT user_name FROM users`);
 * // users[0].userName
 *
 * @example
 * // With explicit type (snake_case DB types)
 * type UserRow = { user_name: string };
 * const users = await camelize<UserRow>(sql`SELECT user_name FROM users`);
 * // users is { userName: string }[]
 */
export async function camelize<T>(
  query: PromiseLike<T[]>,
): Promise<Camelize<T>[]> {
  const rows = await query;

  if (rows.length === 0) return rows as Camelize<T>[];

  // For Bun SQL results, all rows have the same shape - check first row only
  if (isBunSQLResult(rows)) {
    const keys = Object.keys(rows[0] as object);
    if (!keys.some(needsCamelTransform)) {
      return rows as unknown as Camelize<T>[];
    }
  }

  // Transform each row with memoized key checks
  const needsTransformCache: Record<string, boolean> = {};
  const transformedKeyCache: Record<string, string> = {};

  return rows.map((row) =>
    transform(row, {
      test: (k) => {
        let cached = needsTransformCache[k];
        if (cached === undefined) {
          cached = needsCamelTransform(k);
          needsTransformCache[k] = cached;
        }
        return cached;
      },
      key: (k) => {
        let cached = transformedKeyCache[k];
        if (cached === undefined) {
          cached = toCamelCase(k);
          transformedKeyCache[k] = cached;
        }
        return cached;
      },
    }),
  ) as Camelize<T>[];
}
