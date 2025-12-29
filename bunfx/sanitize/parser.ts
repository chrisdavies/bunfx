/**
 * DOMParser-based HTML sanitizer for browser environments.
 */

import {
  isAttributeAllowed,
  isEventHandler,
  REMOVE_WITH_CONTENT,
  VOID_ELEMENTS,
} from "./constants";
import type { SanitizeOptions, Sanitizer } from "./types";
import { sanitizeUrl } from "./url";

/**
 * Escapes HTML special characters in text content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Escapes attribute values for safe inclusion in HTML.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Serializes a DOM node to HTML string.
 */
function serializeNode(
  node: Node,
  allowedElements: Set<string>,
  options: Required<SanitizeOptions>,
  urlAttrs: Set<string>,
): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // Completely remove dangerous elements (including their content)
  if (REMOVE_WITH_CONTENT.has(tag)) {
    return "";
  }

  // Process children first (we need them regardless of whether element is allowed)
  let childHtml = "";
  for (const child of el.childNodes) {
    childHtml += serializeNode(child, allowedElements, options, urlAttrs);
  }

  // If element is not allowed, just return the children's HTML (unwrap)
  if (!allowedElements.has(tag)) {
    return childHtml;
  }

  // Apply custom transform if provided (before building attributes)
  if (options.transformElement) {
    const result = options.transformElement(el);
    if (result === null) {
      return "";
    }
  }

  // Build attribute string for allowed element
  let attrHtml = "";
  for (const attr of el.attributes) {
    const name = attr.name;
    const nameLower = name.toLowerCase();

    // Skip event handlers
    if (isEventHandler(nameLower)) {
      continue;
    }

    // Skip disallowed attributes
    if (!isAttributeAllowed(tag, nameLower, options.attributes)) {
      continue;
    }

    // Sanitize URL attributes
    let value = attr.value;
    if (urlAttrs.has(nameLower)) {
      value = sanitizeUrl(value, options.allowedSchemes);
    }

    attrHtml += ` ${name}="${escapeAttr(value)}"`;
  }

  // Handle void elements
  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrHtml}>`;
  }

  return `<${tag}${attrHtml}>${childHtml}</${tag}>`;
}

/**
 * Sanitizes HTML using the browser's DOMParser.
 * Parses HTML into a DOM tree, walks it, and filters elements/attributes.
 */
export const sanitizeWithParser: Sanitizer = (html, options) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const allowedElements = new Set(options.elements.map((e) => e.toLowerCase()));
  const urlAttrs = new Set(options.urlAttributes.map((a) => a.toLowerCase()));

  // Process all nodes in the body
  let result = "";
  for (const child of doc.body.childNodes) {
    result += serializeNode(child, allowedElements, options, urlAttrs);
  }

  return result;
};
