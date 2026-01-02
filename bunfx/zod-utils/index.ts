/**
 * Zod utilities for common validation patterns.
 */
import { z } from "zod";
import { sanitizeHtml, type SanitizeOptions } from "../sanitize";

/**
 * Creates a Zod schema for sanitized HTML strings.
 * Applies HTML sanitization via transform, so the output is always sanitized.
 *
 * @example
 * ```ts
 * import { zHtml } from "bunfx/zod";
 *
 * const schema = z.object({
 *   title: zHtml(),
 *   description: zHtml({ maxLength: 5000 }),
 *   content: zHtml({ sanitizeOptions: inlinePreset }),
 * });
 * ```
 */
export function zHtml(options?: {
  maxLength?: number;
  sanitizeOptions?: SanitizeOptions;
}) {
  const maxLength = options?.maxLength ?? 10000;
  const sanitizeOptions = options?.sanitizeOptions;

  return z
    .string()
    .max(maxLength)
    .transform((html) => sanitizeHtml(html, sanitizeOptions));
}
