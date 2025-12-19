# HTM

Safe HTML templating with automatic escaping using tagged template literals.

## Import

```ts
import { htm } from "bunfx";
```

## Basic Usage

```ts
const userName = "<script>alert('xss')</script>";
const result = htm`<p>Hello, ${userName}</p>`;
// <p>Hello, &lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;</p>
```

All interpolated values are automatically escaped to prevent XSS attacks.

## Escaped Characters

| Character | Escaped |
|-----------|---------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#x27;` |

## Value Handling

| Type | Behavior |
|------|----------|
| `string` | Escaped |
| `number` | Converted to string |
| `boolean` | Converted to string |
| `null` / `undefined` | Empty string |
| `HtmResult` | Included without double-escaping |
| `RawHtml` | Included without escaping |
| `Array` | Each element processed and joined |

```ts
htm`<p>${42}</p>`           // <p>42</p>
htm`<p>${true}</p>`         // <p>true</p>
htm`<p>${null}</p>`         // <p></p>
```

## Nested Templates

Templates can be nested without double-escaping:

```ts
const inner = htm`<span>${"<b>bold</b>"}</span>`;
const outer = htm`<div>${inner}</div>`;
// <div><span>&lt;b&gt;bold&lt;/b&gt;</span></div>
```

## Component Functions

Create reusable components as functions:

```ts
const link = (href: string, text: string) =>
  htm`<a href="${htm.url(href)}">${text}</a>`;

const nav = htm`
  <nav>
    ${link("/home", "Home")} | ${link("/about", "About")}
  </nav>
`;
```

## Arrays and Lists

Arrays are automatically joined:

```ts
const items = ["Apple", "Banana", "Cherry"];
const list = htm`<ul>${items.map(item => htm`<li>${item}</li>`)}</ul>`;
// <ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>
```

## Raw HTML

Use `htm.raw()` to include trusted HTML without escaping:

```ts
const trustedHtml = "<strong>Important</strong>";
htm`<div>${htm.raw(trustedHtml)}</div>`;
// <div><strong>Important</strong></div>
```

**Warning**: Only use `htm.raw()` with trusted content. Never use with user input.

## Safe URLs

Use `htm.url()` to safely include URLs in href attributes:

```ts
htm`<a href="${htm.url(userProvidedUrl)}">Link</a>`;
```

### Allowed Protocols

| Protocol | Example |
|----------|---------|
| `http:` | `http://example.com` |
| `https:` | `https://example.com` |
| `mailto:` | `mailto:user@example.com` |
| `tel:` | `tel:+1234567890` |
| Relative | `/path/to/page` |

### Blocked Protocols

These throw an error:
- `javascript:` - XSS vector
- `data:` - Can embed malicious content
- `vbscript:` - Legacy XSS vector
- `//` (protocol-relative) - Can be exploited

```ts
htm.url("javascript:alert('xss')");  // throws: Disallowed URL protocol
htm.url("data:text/html,...");       // throws: Disallowed URL protocol
htm.url("//example.com");            // throws: Invalid URL
```

## Type Checking

Check if a value is an `HtmResult`:

```ts
const result = htm`<p>test</p>`;
htm.isResult(result);     // true
htm.isResult("<p>test</p>");  // false
```

## Using with Response

```ts
const html = htm`
  <!DOCTYPE html>
  <html>
    <head><title>${pageTitle}</title></head>
    <body>${content}</body>
  </html>
`;

return new Response(html.toString(), {
  headers: { "Content-Type": "text/html" },
});
```

## Complex Example

```ts
const cell = (content: string) => htm`<td>${content}</td>`;
const row = (cells: string[]) => htm`<tr>${cells.map(cell)}</tr>`;
const table = (rows: string[][]) => htm`<table>${rows.map(row)}</table>`;

const data = [
  ["Name", "Age"],
  ["Alice", "30"],
  ["<script>Bob</script>", "25"],  // Safely escaped
];

const result = table(data);
```
