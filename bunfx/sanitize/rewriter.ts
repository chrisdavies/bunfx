/**
 * HTMLRewriter-based HTML sanitizer for Bun/server environments.
 */

import {
  isAttributeAllowed,
  isEventHandler,
  REMOVE_WITH_CONTENT,
} from "./constants";
import type { SanitizeOptions, Sanitizer } from "./types";
import { sanitizeUrl } from "./url";

/**
 * Sanitizes HTML using Bun's HTMLRewriter.
 * Filters elements and attributes through allowlists.
 */
export const sanitizeWithRewriter: Sanitizer = (html, options) => {
  const allowedElements = new Set(options.elements.map((e) => e.toLowerCase()));
  const urlAttrs = new Set(options.urlAttributes.map((a) => a.toLowerCase()));

  const rewriter = new HTMLRewriter().on("*", {
    element(el) {
      const tag = el.tagName.toLowerCase();

      // Completely remove dangerous elements (including their content)
      if (REMOVE_WITH_CONTENT.has(tag)) {
        el.remove();
        return;
      }

      // Remove other disallowed elements but keep their text content
      if (!allowedElements.has(tag)) {
        el.removeAndKeepContent();
        return;
      }

      // Process attributes on allowed elements
      const attrsToRemove: string[] = [];
      const attrsToUpdate: [string, string][] = [];

      for (const [name, value] of el.attributes) {
        const nameLower = name.toLowerCase();

        // Always remove event handlers
        if (isEventHandler(nameLower)) {
          attrsToRemove.push(name);
          continue;
        }

        // Remove disallowed attributes
        if (!isAttributeAllowed(tag, nameLower, options.attributes)) {
          attrsToRemove.push(name);
          continue;
        }

        // Sanitize URL attributes
        if (urlAttrs.has(nameLower)) {
          const sanitized = sanitizeUrl(value, options.allowedSchemes);
          if (sanitized !== value) {
            attrsToUpdate.push([name, sanitized]);
          }
        }
      }

      // Apply attribute changes
      for (const name of attrsToRemove) {
        el.removeAttribute(name);
      }
      for (const [name, value] of attrsToUpdate) {
        el.setAttribute(name, value);
      }

      // Apply custom transform if provided
      if (options.transformElement) {
        // Create a minimal element interface for the transform
        const wrapper: Parameters<
          NonNullable<SanitizeOptions["transformElement"]>
        >[0] = {
          tagName: el.tagName,
          getAttribute: (name: string) => el.getAttribute(name),
          setAttribute: (name: string, value: string) =>
            el.setAttribute(name, value),
          hasAttribute: (name: string) => el.hasAttribute(name),
          removeAttribute: (name: string) => el.removeAttribute(name),
        };

        const result = options.transformElement(wrapper);
        if (result === null) {
          el.remove();
        }
      }
    },
  });

  // HTMLRewriter.transform() returns string for string input
  return rewriter.transform(html);
};
