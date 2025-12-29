import { beforeAll, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { sanitizeWithParser } from "./parser";
import { inlinePreset, richTextPreset } from "./presets";
import { sanitizeWithRewriter } from "./rewriter";
import type { SanitizeOptions } from "./types";
import { isUrlSafe, sanitizeUrl } from "./url";

/**
 * Shared test expectations for both sanitizer implementations.
 * Each entry is [description, input, expected output, options?]
 */
type TestCase = [string, string, string, SanitizeOptions?];

const defaultOptions: Required<SanitizeOptions> = {
  ...richTextPreset,
  urlAttributes: ["href", "src"],
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformElement: undefined as unknown as NonNullable<
    SanitizeOptions["transformElement"]
  >,
};

function getOptions(override?: SanitizeOptions): Required<SanitizeOptions> {
  if (!override) return defaultOptions;
  return {
    elements: override.elements ?? defaultOptions.elements,
    attributes: override.attributes ?? defaultOptions.attributes,
    urlAttributes: override.urlAttributes ?? defaultOptions.urlAttributes,
    allowedSchemes: override.allowedSchemes ?? defaultOptions.allowedSchemes,
    transformElement: override.transformElement as NonNullable<
      SanitizeOptions["transformElement"]
    >,
  };
}

/**
 * Test cases that both implementations should produce identical results for.
 */
const sharedTestCases: TestCase[] = [
  // Basic element filtering
  ["removes script tags", "<script>alert('xss')</script>", ""],
  [
    "removes script with content",
    "<script>alert('xss')</script><p>Hello</p>",
    "<p>Hello</p>",
  ],
  ["preserves allowed elements", "<p>Hello</p>", "<p>Hello</p>"],
  [
    "preserves nested allowed elements",
    "<p><strong>bold</strong></p>",
    "<p><strong>bold</strong></p>",
  ],
  ["removes iframe", "<iframe src='evil.com'></iframe>", ""],
  ["removes object", "<object data='evil.swf'></object>", ""],
  ["removes embed", "<embed src='evil.swf'>", ""],
  ["removes form", "<form action='evil'><input></form>", ""],

  // SVG/MathML (can contain scripts)
  ["removes svg", "<svg><script>alert(1)</script></svg>", ""],
  ["removes math", "<math><script>alert(1)</script></math>", ""],

  // Unwrapping - keeps text content
  [
    "unwraps disallowed elements keeping text",
    "<div><span>Hello</span></div>",
    "Hello",
    { ...richTextPreset, elements: [] },
  ],
  ["preserves text when removing elements", "<script>bad</script>text", "text"],
  [
    "unwraps nested disallowed elements",
    "<foo><bar>text</bar></foo>",
    "text",
    { ...richTextPreset, elements: [] },
  ],

  // Attribute filtering
  ["removes onclick", '<p onclick="evil()">Hello</p>', "<p>Hello</p>"],
  ["removes onerror", '<img src="x" onerror="evil()">', '<img src="x">'],
  ["removes onload", '<body onload="evil()">Hi</body>', "Hi"],
  ["removes onmouseover", '<p onmouseover="evil()">Hi</p>', "<p>Hi</p>"],
  [
    "keeps allowed attributes",
    '<a href="https://example.com" class="link">Link</a>',
    '<a href="https://example.com" class="link">Link</a>',
  ],
  ["removes disallowed attributes", '<p data-evil="true">Hi</p>', "<p>Hi</p>"],

  // URL sanitization
  [
    "removes javascript: URLs",
    '<a href="javascript:alert(1)">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "removes data: URLs",
    '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "removes vbscript: URLs",
    '<a href="vbscript:evil()">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "preserves http URLs",
    '<a href="http://example.com">Link</a>',
    '<a href="http://example.com">Link</a>',
  ],
  [
    "preserves https URLs",
    '<a href="https://example.com">Link</a>',
    '<a href="https://example.com">Link</a>',
  ],
  [
    "preserves mailto URLs",
    '<a href="mailto:user@example.com">Email</a>',
    '<a href="mailto:user@example.com">Email</a>',
  ],
  [
    "preserves tel URLs",
    '<a href="tel:+1234567890">Call</a>',
    '<a href="tel:+1234567890">Call</a>',
  ],
  [
    "preserves relative URLs",
    '<a href="/path/to/page">Link</a>',
    '<a href="/path/to/page">Link</a>',
  ],
  [
    "preserves hash URLs",
    '<a href="#section">Link</a>',
    '<a href="#section">Link</a>',
  ],
  [
    "preserves query URLs",
    '<a href="?foo=bar">Link</a>',
    '<a href="?foo=bar">Link</a>',
  ],

  // URL encoding tricks
  [
    "removes encoded javascript:",
    '<a href="java&#115;cript:alert(1)">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "removes URL-encoded javascript:",
    '<a href="java%73cript:alert(1)">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "removes mixed-case javascript:",
    '<a href="JaVaScRiPt:alert(1)">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "removes hex-encoded javascript:",
    '<a href="java&#x73;cript:alert(1)">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "removes double-encoded javascript:",
    '<a href="java%26%23115%3bcript:alert(1)">Click</a>',
    '<a href="">Click</a>',
  ],
  [
    "removes numeric with leading zeros:",
    '<a href="java&#0115;cript:alert(1)">Click</a>',
    '<a href="">Click</a>',
  ],

  // Base tag (can hijack URLs)
  [
    "removes base tag",
    '<base href="https://evil.com/"><a href="/page">Link</a>',
    '<a href="/page">Link</a>',
  ],

  // Void elements
  ["preserves br", "<p>Line 1<br>Line 2</p>", "<p>Line 1<br>Line 2</p>"],
  ["preserves hr", "<hr>", "<hr>"],

  // Rich text elements
  [
    "preserves headings",
    "<h1>Title</h1><h2>Subtitle</h2>",
    "<h1>Title</h1><h2>Subtitle</h2>",
  ],
  [
    "preserves lists",
    "<ul><li>Item 1</li><li>Item 2</li></ul>",
    "<ul><li>Item 1</li><li>Item 2</li></ul>",
  ],
  [
    "preserves ordered lists",
    "<ol><li>First</li><li>Second</li></ol>",
    "<ol><li>First</li><li>Second</li></ol>",
  ],
  [
    "preserves blockquote",
    "<blockquote>Quote</blockquote>",
    "<blockquote>Quote</blockquote>",
  ],
  ["preserves pre", "<pre>code</pre>", "<pre>code</pre>"],
  ["preserves code", "<code>inline code</code>", "<code>inline code</code>"],

  // Inline preset
  [
    "inline preset removes blocks",
    "<p><strong>bold</strong></p>",
    "<strong>bold</strong>",
    inlinePreset,
  ],
  [
    "inline preset removes links",
    '<a href="https://example.com">link</a>',
    "link",
    inlinePreset,
  ],
  [
    "inline preset keeps formatting",
    "<b>bold</b> <i>italic</i>",
    "<b>bold</b> <i>italic</i>",
    inlinePreset,
  ],
];

/**
 * URL validation tests
 */
describe("URL validation", () => {
  const allowedSchemes = ["http", "https", "mailto", "tel"];

  it("allows http URLs", () => {
    expect(isUrlSafe("http://example.com", allowedSchemes)).toBe(true);
  });

  it("allows https URLs", () => {
    expect(isUrlSafe("https://example.com", allowedSchemes)).toBe(true);
  });

  it("allows mailto URLs", () => {
    expect(isUrlSafe("mailto:user@example.com", allowedSchemes)).toBe(true);
  });

  it("allows tel URLs", () => {
    expect(isUrlSafe("tel:+1234567890", allowedSchemes)).toBe(true);
  });

  it("allows relative URLs starting with /", () => {
    expect(isUrlSafe("/path/to/page", allowedSchemes)).toBe(true);
  });

  it("allows hash URLs", () => {
    expect(isUrlSafe("#section", allowedSchemes)).toBe(true);
  });

  it("allows query URLs", () => {
    expect(isUrlSafe("?foo=bar", allowedSchemes)).toBe(true);
  });

  it("allows protocol-relative URLs when http/https allowed", () => {
    expect(isUrlSafe("//example.com", allowedSchemes)).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    expect(isUrlSafe("javascript:alert(1)", allowedSchemes)).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(isUrlSafe("data:text/html,<script>", allowedSchemes)).toBe(false);
  });

  it("rejects vbscript: URLs", () => {
    expect(isUrlSafe("vbscript:evil()", allowedSchemes)).toBe(false);
  });

  it("rejects encoded javascript:", () => {
    expect(isUrlSafe("java%73cript:alert(1)", allowedSchemes)).toBe(false);
  });

  it("rejects javascript with whitespace tricks", () => {
    expect(isUrlSafe("java\nscript:alert(1)", allowedSchemes)).toBe(false);
  });

  it("rejects mixed-case javascript:", () => {
    expect(isUrlSafe("JaVaScRiPt:alert(1)", allowedSchemes)).toBe(false);
  });

  it("rejects hex-encoded javascript:", () => {
    expect(isUrlSafe("java&#x73;cript:alert(1)", allowedSchemes)).toBe(false);
  });

  it("rejects double-encoded javascript:", () => {
    expect(isUrlSafe("java%26%23115%3bcript:alert(1)", allowedSchemes)).toBe(
      false,
    );
  });

  it("rejects numeric entities with leading zeros:", () => {
    expect(isUrlSafe("java&#0115;cript:alert(1)", allowedSchemes)).toBe(false);
  });

  it("sanitizeUrl clears dangerous URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)", allowedSchemes)).toBe("");
  });

  it("sanitizeUrl preserves safe URLs", () => {
    expect(sanitizeUrl("https://example.com", allowedSchemes)).toBe(
      "https://example.com",
    );
  });
});

/**
 * Test HTMLRewriter implementation
 */
describe("HTMLRewriter sanitizer", () => {
  for (const [description, input, expected, options] of sharedTestCases) {
    it(description, () => {
      const result = sanitizeWithRewriter(input, getOptions(options));
      expect(result).toBe(expected);
    });
  }
});

/**
 * Test DOMParser implementation (using happy-dom)
 */
describe("DOMParser sanitizer", () => {
  beforeAll(() => {
    // Set up happy-dom's DOMParser globally for testing
    const window = new Window();
    // @ts-expect-error happy-dom types don't perfectly match browser types
    globalThis.DOMParser = window.DOMParser;
    // @ts-expect-error happy-dom types don't perfectly match browser types
    globalThis.Node = window.Node;
  });

  for (const [description, input, expected, options] of sharedTestCases) {
    it(description, () => {
      const result = sanitizeWithParser(input, getOptions(options));
      expect(result).toBe(expected);
    });
  }
});
