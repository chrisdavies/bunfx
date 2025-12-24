/**
 * Custom components can specify their own serialization
 * logic, if they wish, allowing them to use temporary UI
 * elements without affecting the saved state.
 *
 * The `editor-ui` custom element is always ignored.
 */

function escapeHTML(s: string) {
  return s.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return char;
    }
  });
}

export function serialize(item: Node) {
  let html = '';
  function walk(node: Node) {
    if (typeof (node as any).serialize === 'function') {
      html += (node as any).serialize();
      return;
    }
    if (node instanceof Text) {
      html += escapeHTML(node.nodeValue || '');
      return;
    }
    if (!(node instanceof Element)) {
      return;
    }
    if (node.tagName === 'EDITOR-UI') {
      return;
    }
    if (!node.firstChild) {
      html += node.outerHTML;
      return;
    }
    html += `<${node.tagName.toLowerCase()}${serializeAttrs(node)}>`;
    node.childNodes.forEach(walk);
    html += `</${node.tagName.toLowerCase()}>`;
  }
  walk(item);
  return html;
}

export function serializeChildren(el: Element | null) {
  let html = '';
  el?.childNodes.forEach((n) => {
    html += serialize(n);
  });
  return html;
}

export function serializeAttrs(el: Element) {
  let html = '';
  for (const attr of el.attributes) {
    html += ` ${attr.name}="${escapeAttrValue(attr.value)}"`;
  }
  return html;
}

export function escapeAttrValue(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
  };
  return value.replace(/[&"<>]/g, (match) => entities[match] || match);
}
