/**
 * HTML Sanitizer
 *
 * Zero-dependency HTML sanitizer for rendering untrusted content safely.
 * Works in both browser (DOMParser) and Bun/server (HTMLRewriter) environments.
 *
 * @example
 * ```ts
 * import { sanitizeHtml, richTextPreset } from "bunfx/sanitize";
 *
 * // Use default settings (richTextPreset)
 * const clean = sanitizeHtml(dirtyHtml);
 *
 * // Use a preset directly
 * const clean = sanitizeHtml(html, richTextPreset);
 *
 * // Extend a preset
 * const clean = sanitizeHtml(html, {
 *   ...richTextPreset,
 *   elements: [...richTextPreset.elements, "img"],
 * });
 * ```
 */

import { richTextPreset } from "./presets";
import type { SanitizeOptions, Sanitizer } from "./types";

// Re-export types and presets
export { inlinePreset, richTextPreset } from "./presets";
export type { SanitizeElement, SanitizeOptions } from "./types";

/**
 * Default options used when no options are provided.
 */
const defaultOptions: Required<SanitizeOptions> = {
  elements: richTextPreset.elements,
  attributes: richTextPreset.attributes,
  urlAttributes: richTextPreset.urlAttributes!,
  allowedSchemes: richTextPreset.allowedSchemes!,
  transformElement: undefined as unknown as NonNullable<
    SanitizeOptions["transformElement"]
  >,
};

/**
 * Merges user options with defaults.
 */
function mergeOptions(options?: SanitizeOptions): Required<SanitizeOptions> {
  if (!options) {
    return defaultOptions;
  }

  return {
    elements: options.elements ?? defaultOptions.elements,
    attributes: options.attributes ?? defaultOptions.attributes,
    urlAttributes: options.urlAttributes ?? defaultOptions.urlAttributes,
    allowedSchemes: options.allowedSchemes ?? defaultOptions.allowedSchemes,
    transformElement: options.transformElement as NonNullable<
      SanitizeOptions["transformElement"]
    >,
  };
}

/**
 * Lazily loads the appropriate sanitizer based on environment.
 * Uses HTMLRewriter in Bun, DOMParser in browser.
 */
let cachedSanitizer: Sanitizer | undefined;

function getSanitizer(): Sanitizer {
  if (cachedSanitizer) {
    return cachedSanitizer;
  }

  // Check for Bun's HTMLRewriter first (server environment)
  if (typeof HTMLRewriter !== "undefined") {
    // Dynamic import to avoid loading browser code in Bun
    const { sanitizeWithRewriter } = require("./rewriter") as {
      sanitizeWithRewriter: Sanitizer;
    };
    cachedSanitizer = sanitizeWithRewriter;
    return cachedSanitizer;
  }

  // Check for browser's DOMParser
  if (typeof DOMParser !== "undefined") {
    const { sanitizeWithParser } = require("./parser") as {
      sanitizeWithParser: Sanitizer;
    };
    cachedSanitizer = sanitizeWithParser;
    return cachedSanitizer;
  }

  throw new Error(
    "No HTML sanitizer available in this environment. " +
      "Requires HTMLRewriter (Bun) or DOMParser (browser).",
  );
}

/**
 * Sanitizes an HTML string by filtering elements and attributes through allowlists.
 *
 * @param html - The HTML string to sanitize
 * @param options - Sanitization options (defaults to richTextPreset)
 * @returns Sanitized HTML string
 *
 * @example
 * ```ts
 * // Remove script tags and dangerous attributes
 * sanitizeHtml('<script>alert("xss")</script><p onclick="bad">Hello</p>')
 * // Returns: "<p>Hello</p>"
 *
 * // Sanitize dangerous URLs
 * sanitizeHtml('<a href="javascript:alert(1)">Click</a>')
 * // Returns: '<a href="">Click</a>'
 * ```
 */
export function sanitizeHtml(html: string, options?: SanitizeOptions): string {
  const sanitizer = getSanitizer();
  const mergedOptions = mergeOptions(options);
  return sanitizer(html, mergedOptions);
}

/**
 * Creates a reusable sanitizer function with pre-configured options.
 * More efficient when sanitizing multiple strings with the same options.
 *
 * @param options - Sanitization options
 * @returns A function that sanitizes HTML strings
 *
 * @example
 * ```ts
 * const sanitize = createSanitizer({
 *   ...richTextPreset,
 *   transformElement: (el) => {
 *     if (el.tagName === "A") {
 *       el.setAttribute("rel", "noopener noreferrer");
 *     }
 *     return el;
 *   },
 * });
 *
 * const clean1 = sanitize(html1);
 * const clean2 = sanitize(html2);
 * ```
 */
export function createSanitizer(
  options?: SanitizeOptions,
): (html: string) => string {
  const sanitizer = getSanitizer();
  const mergedOptions = mergeOptions(options);
  return (html: string) => sanitizer(html, mergedOptions);
}
