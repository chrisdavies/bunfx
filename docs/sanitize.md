# Sanitize

Zero-dependency HTML sanitizer for rendering untrusted content safely. Filters elements and attributes through an allowlist, validates URLs in `href`/`src` attributes.

Works in both browser (DOMParser) and Bun/server (HTMLRewriter) environments with identical output.

## Import

```ts
import { sanitizeHtml, createSanitizer, richTextPreset } from "bunfx/sanitize";
```

## Basic Usage

```ts
// Sanitize HTML with default settings (safe for rich text)
const clean = sanitizeHtml(dirtyHtml);

// Use in Preact with dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
```

## Presets

Presets are plain objects that can be used directly or spread/extended:

```ts
import { sanitizeHtml, richTextPreset, inlinePreset } from "bunfx/sanitize";

// Use a preset directly
sanitizeHtml(html, richTextPreset);

// Extend a preset
sanitizeHtml(html, {
  ...richTextPreset,
  elements: [...richTextPreset.elements, "img"],
  attributes: {
    ...richTextPreset.attributes,
    img: ["src", "alt", "width", "height"],
  },
});

// Override specific parts
sanitizeHtml(html, {
  ...inlinePreset,
  elements: ["b", "i", "u", "s", "br"],
});
```

### Available Presets

| Preset | Elements | Links | Blocks |
|--------|----------|-------|--------|
| `richTextPreset` | Formatting, lists, headings, blockquotes | Yes | Yes |
| `inlinePreset` | `b`, `i`, `u`, `em`, `strong`, `code`, `br` | No | No |

## Custom Configuration

```ts
import { sanitizeHtml } from "bunfx/sanitize";

const clean = sanitizeHtml(html, {
  // Allowlisted element tag names (lowercase)
  elements: ["p", "br", "b", "i", "a", "ul", "ol", "li"],

  // Allowlisted attributes per element (* = all elements)
  attributes: {
    "*": ["class"],
    "a": ["href", "target", "rel"],
  },

  // URL attributes that need scheme validation
  urlAttributes: ["href", "src"],

  // Allowed URL schemes (others are removed)
  allowedSchemes: ["http", "https", "mailto"],

  // Transform functions (optional)
  transformElement: (el) => {
    // Add rel="noopener" to all links
    if (el.tagName === "A") {
      el.setAttribute("rel", "noopener noreferrer");
    }
    return el; // Return null to remove element
  },
});
```

## Reusable Sanitizer

For repeated sanitization with the same config, create a reusable sanitizer:

```ts
import { createSanitizer, richTextPreset } from "bunfx/sanitize";

// Create once
const sanitize = createSanitizer({
  ...richTextPreset,
  // Add custom transforms
  transformElement: (el) => {
    if (el.tagName === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
    return el;
  },
});

// Use many times
const clean1 = sanitize(html1);
const clean2 = sanitize(html2);
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `elements` | `string[]` | `richTextPreset.elements` | Allowlisted element tag names |
| `attributes` | `Record<string, string[]>` | `richTextPreset.attributes` | Allowlisted attributes per element |
| `urlAttributes` | `string[]` | `["href", "src"]` | Attributes containing URLs to validate |
| `allowedSchemes` | `string[]` | `["http", "https", "mailto", "tel"]` | Allowed URL schemes |
| `transformElement` | `(el: Element) => Element \| null` | - | Transform or remove elements |

## API

### `sanitizeHtml(html: string, options?: SanitizeOptions): string`

Sanitizes an HTML string, returning a safe HTML string.

```ts
const clean = sanitizeHtml('<script>alert("xss")</script><p>Hello</p>');
// Returns: "<p>Hello</p>"
```

### `createSanitizer(options?: SanitizeOptions): (html: string) => string`

Creates a reusable sanitizer function with the given options.

```ts
const sanitize = createSanitizer(inlinePreset);
const clean = sanitize("<b>bold</b> <script>bad</script>");
// Returns: "<b>bold</b> "
```

### `richTextPreset`

Preset for rich text editor output. Allows formatting, lists, headings, blockquotes, and links.

```ts
import { richTextPreset } from "bunfx/sanitize";

console.log(richTextPreset.elements);
// ["p", "br", "b", "i", "u", "em", "strong", "a", "ul", "ol", "li", ...]
```

### `inlinePreset`

Minimal preset for inline formatting only. No blocks, no links.

```ts
import { inlinePreset } from "bunfx/sanitize";

console.log(inlinePreset.elements);
// ["b", "i", "u", "em", "strong", "code", "br"]
```

## Security Notes

### What Gets Removed

- **Script elements**: `<script>`, `<noscript>`
- **Dangerous elements**: `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`
- **SVG/MathML**: Can contain scripts, stripped entirely
- **Event handlers**: All `on*` attributes (`onclick`, `onerror`, etc.)
- **Dangerous URLs**: `javascript:`, `data:`, `vbscript:` schemes in `href`, `src`, etc.
- **Unknown elements**: Any element not in the allowlist

### URL Validation

Attributes listed in `urlAttributes` (default: `["href", "src"]`) are validated against `allowedSchemes`:

```ts
// These are sanitized (dangerous schemes removed)
<a href="javascript:alert('xss')">      → <a href="">
<a href="data:text/html,<script>">      → <a href="">
<img src="javascript:void(0)">          → <img src="">

// These are preserved
<a href="https://example.com">          → preserved
<a href="/relative/path">               → preserved
<a href="mailto:user@example.com">      → preserved
```

### What Gets Preserved

- **Text content**: Always preserved (HTML-escaped if element is stripped)
- **Allowlisted elements**: With their allowlisted attributes
- **Safe URLs**: `http:`, `https:`, `mailto:`, `tel:`, relative URLs

### Defense in Depth

This sanitizer is designed for client-side rendering of user content. For maximum security:

1. **Server-side sanitization**: Sanitize on save, not just on render
2. **Content Security Policy**: Use CSP headers as an additional layer
3. **Input validation**: Validate/sanitize at the API boundary

```ts
// Recommended: sanitize on both save and render
// Server (when saving)
const sanitized = serverSanitize(userInput);
await db.save({ content: sanitized });

// Client (when rendering)
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
```

## Integration with Rich Text Editor

The `richTextPreset` is designed to match the output of `bunfx/rich-text`:

```ts
import { RichTextEditor } from "bunfx/rich-text";
import { sanitizeHtml } from "bunfx/sanitize";

// Editor produces HTML
<RichTextEditor value={html} onChange={setHtml} />

// Safely render elsewhere (sanitizeHtml uses richTextPreset by default)
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
```

## Environment Support

Works in both browser and server environments with automatic implementation detection:

| Environment | Implementation | API Used |
|-------------|----------------|----------|
| Browser | DOMParser-based | `DOMParser`, tree traversal |
| Bun/Server | HTMLRewriter-based | `HTMLRewriter`, streaming |

```ts
// Same API, works everywhere
import { sanitizeHtml } from "bunfx/sanitize";

// Browser - uses DOMParser internally
// Bun - uses HTMLRewriter internally
const clean = sanitizeHtml(dirtyHtml);
```

Both implementations produce identical output for the same input and options.

> **Future**: The browser's [Sanitizer API](https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTML) (`Element.setHTML()`) will eventually provide native support. This module can add a third implementation path once browser support is widespread.
