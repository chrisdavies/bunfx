/**
 * Safe HTML templating with automatic escaping.
 *
 * Usage:
 *   const link = (href: string, text: string) =>
 *     htm`<a href="${htm.raw(href)}">${text}</a>`;
 *
 *   htm`<div>
 *     <h1>Hello, ${userName}</h1>
 *     ${link('/home', 'Go home')}
 *   </div>`
 */

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

const ESCAPE_REGEX = /[&<>"']/g;

function escapeHtml(str: string): string {
  return str.replace(ESCAPE_REGEX, (char) => ESCAPE_MAP[char] ?? char);
}

/** Marker class for values that should not be escaped */
export class RawHtml {
  constructor(public readonly value: string) {}
}

/** Marker class for template results that can be nested */
export class HtmResult {
  constructor(public readonly value: string) {}
  toString() {
    return this.value;
  }
}

function processValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (value instanceof RawHtml) {
    return value.value;
  }
  if (value instanceof HtmResult) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map(processValue).join("");
  }
  return escapeHtml(String(value));
}

/**
 * Tagged template literal for safe HTML generation.
 * All interpolated values are escaped unless wrapped with htm.raw().
 * Nested htm`` templates are preserved without double-escaping.
 */
export function htm(
  strings: TemplateStringsArray,
  ...values: unknown[]
): HtmResult {
  let result = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    result += processValue(values[i]) + (strings[i + 1] ?? "");
  }
  return new HtmResult(result);
}

/**
 * Mark a value as raw HTML that should not be escaped.
 * Use with caution - only for trusted content.
 */
htm.raw = (value: string): RawHtml => new RawHtml(value);

/**
 * Safely include a URL in an href attribute.
 * Only allows http, https, mailto, tel, and relative URLs.
 * Rejects javascript:, data:, and other potentially dangerous schemes.
 */
htm.url = (href: string): RawHtml => {
  // Allow relative URLs (starting with / but not //)
  if (href.startsWith("/") && !href.startsWith("//")) {
    return new RawHtml(href);
  }

  // Parse and validate absolute URLs
  const url = URL.parse(href);
  if (!url) {
    throw new Error(`Invalid URL: ${href}`);
  }

  const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(`Disallowed URL protocol: ${url.protocol}`);
  }

  return new RawHtml(href);
};

/**
 * Check if a value is an HtmResult (for testing purposes)
 */
htm.isResult = (value: unknown): value is HtmResult =>
  value instanceof HtmResult;
