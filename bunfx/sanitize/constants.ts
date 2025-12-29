/**
 * Shared constants and helpers for HTML sanitization.
 */

/**
 * Set of void elements that don't have closing tags.
 * These are never considered "empty" for stripping purposes.
 */
export const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Elements whose content should be completely removed (not unwrapped).
 * These elements can contain executable code or dangerous content.
 */
export const REMOVE_WITH_CONTENT = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "math",
  "template",
]);

/**
 * Checks if an attribute name is an event handler (starts with "on").
 */
export function isEventHandler(name: string): boolean {
  return name.toLowerCase().startsWith("on");
}

/**
 * Checks if an attribute is allowed for the given tag.
 */
export function isAttributeAllowed(
  tag: string,
  attr: string,
  attributes: Record<string, string[]>,
): boolean {
  const globalAllowed = attributes["*"] || [];
  const tagAllowed = attributes[tag] || [];
  const attrLower = attr.toLowerCase();
  return globalAllowed.includes(attrLower) || tagAllowed.includes(attrLower);
}
