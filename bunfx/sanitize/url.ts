/**
 * URL validation for HTML sanitization.
 * Validates that URLs use allowed schemes and don't contain XSS vectors.
 */

/**
 * Checks if a URL is safe based on allowed schemes.
 * Relative URLs (starting with /, #, or ?) are always allowed.
 *
 * @param url - The URL to validate
 * @param allowedSchemes - List of allowed schemes (e.g., ["http", "https", "mailto"])
 * @returns true if the URL is safe, false otherwise
 */
export function isUrlSafe(url: string, allowedSchemes: string[]): boolean {
  const trimmed = url.trim();

  // Empty URLs are safe (will be cleared anyway)
  if (!trimmed) {
    return true;
  }

  // Relative URLs are always allowed
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?")
  ) {
    return true;
  }

  // Protocol-relative URLs (//example.com) - allow if http/https are allowed
  if (trimmed.startsWith("//")) {
    return allowedSchemes.includes("http") || allowedSchemes.includes("https");
  }

  // Extract scheme from URL
  const scheme = extractScheme(trimmed);

  // No scheme found - this is a relative URL (e.g., "path/to/file", "image.png")
  // These are safe because they can't execute code
  if (!scheme) {
    return true;
  }

  return allowedSchemes.includes(scheme.toLowerCase());
}

/**
 * Decodes HTML entities in a string.
 * Handles numeric (&#115;), hex (&#x73;), and named (&amp;) entities.
 */
function decodeHtmlEntities(str: string): string {
  return (
    str
      // Decode numeric entities (&#115; -> s)
      .replace(/&#(\d+);?/g, (_, code) =>
        String.fromCharCode(parseInt(code, 10)),
      )
      // Decode hex entities (&#x73; -> s)
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16)),
      )
      // Decode common named entities
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#039;/gi, "'")
      .replace(/&apos;/gi, "'")
  );
}

/**
 * Extracts the scheme from a URL.
 * Handles various encoding tricks that attackers use to bypass filters.
 *
 * @param url - The URL to extract scheme from
 * @returns The scheme (lowercase) or null if no valid scheme found
 */
function extractScheme(url: string): string | null {
  let decoded = url;
  let prev = "";

  // Iteratively decode until stable (max 3 iterations to prevent DoS)
  // This handles double-encoding like java%26%23115%3bcript:
  for (let i = 0; i < 3 && decoded !== prev; i++) {
    prev = decoded;

    // Decode URL encoding first (to expose hidden HTML entities)
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Invalid encoding, continue with what we have
    }

    // Decode HTML entities (handles "java&#115;cript:")
    decoded = decodeHtmlEntities(decoded);
  }

  // Remove whitespace and control characters that browsers ignore
  // This handles tricks like "java\nscript:" or "java\tscript:"
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional for XSS prevention
  decoded = decoded.replace(/[\x00-\x20]/g, "");

  // Look for scheme pattern (letters followed by colon)
  const match = decoded.match(/^([a-zA-Z][a-zA-Z0-9+.-]*)\s*:/);
  if (!match) {
    return null;
  }

  return match[1]!.toLowerCase();
}

/**
 * Sanitizes a URL by clearing it if it uses a disallowed scheme.
 *
 * @param url - The URL to sanitize
 * @param allowedSchemes - List of allowed schemes
 * @returns The original URL if safe, empty string otherwise
 */
export function sanitizeUrl(url: string, allowedSchemes: string[]): string {
  return isUrlSafe(url, allowedSchemes) ? url : "";
}
