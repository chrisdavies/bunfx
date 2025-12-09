import { expect, test } from "bun:test";
import { HtmResult, htm } from "./htm";

test("basic string interpolation with escaping", () => {
  const name = "<script>alert('xss')</script>";
  const result = htm`<p>Hello, ${name}</p>`;

  expect(result.toString()).toBe(
    "<p>Hello, &lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;</p>",
  );
});

test("escapes all dangerous characters", () => {
  const dangerous = `<>&"'`;
  const result = htm`<p>${dangerous}</p>`;

  expect(result.toString()).toBe("<p>&lt;&gt;&amp;&quot;&#x27;</p>");
});

test("handles null and undefined", () => {
  const result = htm`<p>${null} and ${undefined}</p>`;

  expect(result.toString()).toBe("<p> and </p>");
});

test("handles numbers", () => {
  const result = htm`<p>Count: ${42}</p>`;

  expect(result.toString()).toBe("<p>Count: 42</p>");
});

test("handles booleans", () => {
  const result = htm`<p>${true} and ${false}</p>`;

  expect(result.toString()).toBe("<p>true and false</p>");
});

test("htm.raw() bypasses escaping", () => {
  const url = "https://example.com/?a=1&b=2";
  const result = htm`<a href="${htm.raw(url)}">Link</a>`;

  expect(result.toString()).toBe(
    '<a href="https://example.com/?a=1&b=2">Link</a>',
  );
});

test("nested htm templates are not double-escaped", () => {
  const inner = htm`<span>${"<b>bold</b>"}</span>`;
  const outer = htm`<div>${inner}</div>`;

  expect(outer.toString()).toBe(
    "<div><span>&lt;b&gt;bold&lt;/b&gt;</span></div>",
  );
});

test("complex nesting with functions", () => {
  const link = (href: string, text: string) =>
    htm`<a href="${htm.raw(href)}">${text}</a>`;

  const result = htm`<nav>${link("/home", "Home")} | ${link("/about", "About")}</nav>`;

  expect(result.toString()).toBe(
    '<nav><a href="/home">Home</a> | <a href="/about">About</a></nav>',
  );
});

test("arrays are joined without separator", () => {
  const items = ["<a>", "<b>", "<c>"];
  const result = htm`<ul>${items.map((item) => htm`<li>${item}</li>`)}</ul>`;

  expect(result.toString()).toBe(
    "<ul><li>&lt;a&gt;</li><li>&lt;b&gt;</li><li>&lt;c&gt;</li></ul>",
  );
});

test("deeply nested templates", () => {
  const cell = (content: string) => htm`<td>${content}</td>`;
  const row = (cells: string[]) => htm`<tr>${cells.map(cell)}</tr>`;
  const table = (rows: string[][]) => htm`<table>${rows.map(row)}</table>`;

  const result = table([
    ["a", "b"],
    ["<c>", "<d>"],
  ]);

  expect(result.toString()).toBe(
    "<table><tr><td>a</td><td>b</td></tr><tr><td>&lt;c&gt;</td><td>&lt;d&gt;</td></tr></table>",
  );
});

test("htm.isResult() identifies HtmResult instances", () => {
  const result = htm`<p>test</p>`;

  expect(htm.isResult(result)).toBe(true);
  expect(htm.isResult("<p>test</p>")).toBe(false);
  expect(htm.isResult(null)).toBe(false);
});

test("result is instance of HtmResult", () => {
  const result = htm`<p>test</p>`;

  expect(result).toBeInstanceOf(HtmResult);
});

test("raw strings in arrays", () => {
  const urls = ["/home", "/about"];
  const result = htm`${urls.map((url) => htm.raw(`<a href="${url}">${url}</a>`))}`;

  expect(result.toString()).toBe(
    '<a href="/home">/home</a><a href="/about">/about</a>',
  );
});

test("mixed raw and escaped in same template", () => {
  const userInput = "<script>bad</script>";
  const trustedHtml = "<strong>bold</strong>";

  const result = htm`<div>${userInput} and ${htm.raw(trustedHtml)}</div>`;

  expect(result.toString()).toBe(
    "<div>&lt;script&gt;bad&lt;/script&gt; and <strong>bold</strong></div>",
  );
});

test("empty template", () => {
  const result = htm``;

  expect(result.toString()).toBe("");
});

test("template with no interpolations", () => {
  const result = htm`<p>Static content</p>`;

  expect(result.toString()).toBe("<p>Static content</p>");
});

test("preserves whitespace", () => {
  const result = htm`
    <div>
      <p>Indented</p>
    </div>
  `;

  expect(result.toString()).toBe(`
    <div>
      <p>Indented</p>
    </div>
  `);
});

test("htm.url() allows http URLs", () => {
  const result = htm`<a href="${htm.url("http://example.com")}">Link</a>`;

  expect(result.toString()).toBe('<a href="http://example.com">Link</a>');
});

test("htm.url() allows https URLs", () => {
  const result = htm`<a href="${htm.url("https://example.com/path?a=1&b=2")}">Link</a>`;

  expect(result.toString()).toBe(
    '<a href="https://example.com/path?a=1&b=2">Link</a>',
  );
});

test("htm.url() allows mailto URLs", () => {
  const result = htm`<a href="${htm.url("mailto:test@example.com")}">Email</a>`;

  expect(result.toString()).toBe('<a href="mailto:test@example.com">Email</a>');
});

test("htm.url() allows tel URLs", () => {
  const result = htm`<a href="${htm.url("tel:+1234567890")}">Call</a>`;

  expect(result.toString()).toBe('<a href="tel:+1234567890">Call</a>');
});

test("htm.url() allows relative URLs", () => {
  const result = htm`<a href="${htm.url("/path/to/page")}">Page</a>`;

  expect(result.toString()).toBe('<a href="/path/to/page">Page</a>');
});

test("htm.url() allows relative URLs with query strings", () => {
  const result = htm`<a href="${htm.url("/search?q=test&page=1")}">Search</a>`;

  expect(result.toString()).toBe('<a href="/search?q=test&page=1">Search</a>');
});

test("htm.url() rejects javascript: URLs", () => {
  expect(() => htm.url("javascript:alert('xss')")).toThrow(
    "Disallowed URL protocol: javascript:",
  );
});

test("htm.url() rejects data: URLs", () => {
  expect(() => htm.url("data:text/html,<script>alert('xss')</script>")).toThrow(
    "Disallowed URL protocol: data:",
  );
});

test("htm.url() rejects vbscript: URLs", () => {
  expect(() => htm.url("vbscript:msgbox('xss')")).toThrow(
    "Disallowed URL protocol: vbscript:",
  );
});

test("htm.url() rejects protocol-relative URLs", () => {
  expect(() => htm.url("//example.com/path")).toThrow("Invalid URL");
});

test("htm.url() rejects invalid URLs", () => {
  expect(() => htm.url("not a valid url")).toThrow("Invalid URL");
});
