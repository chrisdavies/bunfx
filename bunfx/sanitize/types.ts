/**
 * Configuration options for HTML sanitization.
 */
export interface SanitizeOptions {
  /**
   * Allowlisted element tag names (lowercase).
   * Elements not in this list are removed, but their text content is preserved.
   */
  elements: string[];

  /**
   * Allowlisted attributes per element.
   * Use "*" key for attributes allowed on all elements.
   * @example { "*": ["class"], "a": ["href", "target", "rel"] }
   */
  attributes: Record<string, string[]>;

  /**
   * Attributes containing URLs that need scheme validation.
   * @default ["href", "src"]
   */
  urlAttributes?: string[];

  /**
   * Allowed URL schemes. URLs with other schemes are cleared.
   * Relative URLs (starting with / or #) are always allowed.
   * @default ["http", "https", "mailto", "tel"]
   */
  allowedSchemes?: string[];

  /**
   * Transform function called for each allowed element.
   * Return the element to keep it, or null to remove it.
   * Can modify attributes on the element.
   */
  transformElement?: (element: SanitizeElement) => SanitizeElement | null;
}

/**
 * Minimal element interface for transform functions.
 * Works with both DOMParser Elements and HTMLRewriter Elements.
 */
export interface SanitizeElement {
  tagName: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  hasAttribute(name: string): boolean;
  removeAttribute(name: string): void;
}

/**
 * Internal sanitizer function signature.
 */
export type Sanitizer = (
  html: string,
  options: Required<SanitizeOptions>,
) => string;
