import type { SanitizeOptions } from "./types";

/**
 * Preset for rich text editor output.
 * Allows formatting, lists, headings, blockquotes, and links.
 * Matches the output of bunfx/rich-text.
 */
export const richTextPreset: SanitizeOptions = {
  elements: [
    // Text formatting
    "p",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "code",
    // Links
    "a",
    // Images
    "img",
    // Lists
    "ul",
    "ol",
    "li",
    // Headings
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Block elements
    "blockquote",
    "pre",
    // Horizontal rule
    "hr",
  ],
  attributes: {
    "*": ["class"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  urlAttributes: ["href", "src"],
  allowedSchemes: ["http", "https", "mailto", "tel"],
};

/**
 * Minimal preset for inline formatting only.
 * No blocks, no links, no headings.
 */
export const inlinePreset: SanitizeOptions = {
  elements: ["b", "strong", "i", "em", "u", "s", "code", "br"],
  attributes: {
    "*": ["class"],
  },
  urlAttributes: ["href", "src"],
  allowedSchemes: ["http", "https", "mailto", "tel"],
};
