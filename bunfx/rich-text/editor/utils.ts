import { getExtensions } from "./extensions";

/**
 * Find the root rich-text editor element.
 */
export function findEditor(el: Element): HTMLElement | null {
  return el.closest("rich-text");
}

/**
 * Check if the range is in or contains an element matching the selector.
 */
export function rangeMatches(rng: Range, selector: string) {
  const ancestor = toElement(rng.commonAncestorContainer);
  if (!ancestor) {
    return false;
  }
  if (ancestor.closest(selector)) {
    return true;
  }
  for (const child of ancestor.querySelectorAll(selector)) {
    if (rng.intersectsNode(child)) {
      return true;
    }
  }
  return false;
}

export function getRange(editor: HTMLElement) {
  const sel = globalThis.getSelection();
  const rng = sel?.rangeCount ? sel?.getRangeAt(0) : undefined;
  return sel?.focusNode && editor.contains(sel.focusNode) ? rng : undefined;
}

export function toElement(node: Node) {
  return node instanceof Element ? node : node.parentElement;
}

export function split(rng: Range, selector: string) {
  const el = toElement(rng.commonAncestorContainer)?.closest(selector);
  if (!el) {
    return rng.extractContents();
  }
  const rngPrefix = document.createRange();
  rngPrefix.selectNode(el);
  rngPrefix.setEnd(rng.startContainer, rng.startOffset);
  const rngSuffix = document.createRange();
  rngSuffix.selectNode(el);
  rngSuffix.setStart(rng.endContainer, rng.endOffset);
  const suffix = rngSuffix.extractContents();
  const prefix = rngPrefix.extractContents();
  const content = document.createDocumentFragment();
  content.append(...el.childNodes);
  el.parentElement?.insertBefore(prefix, el);
  el.parentElement?.insertBefore(suffix, el.nextSibling);
  rng.collapse();
  rng.setStartAfter(el);
  el.remove();
  return content;
}

export function unwrap<T extends ParentNode>(content: T, selector: string) {
  const matches = Array.from(content.querySelectorAll(selector));
  matches.forEach((el) => el.replaceWith(...el.childNodes));
  return content;
}

export function wrapInline<T extends ParentNode>(content: T, el: Element) {
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const curr = walker.currentNode;
    if (curr) {
      textNodes.push(curr as Text);
    }
  }
  textNodes.forEach((txt) => {
    const wrapper = el.cloneNode() as Element;
    txt.replaceWith(wrapper);
    wrapper.append(txt);
  });
  return content;
}

export function mergeSiblings<T extends ParentNode>(
  content: T,
  selector: string,
) {
  Array.from(content.querySelectorAll(`${selector} + ${selector}`)).forEach(
    (x) => {
      const prev = x.previousElementSibling;
      if (!prev) {
        return;
      }
      prev.append(...x.childNodes);
      x.remove();
    },
  );
  return content;
}

export function merge(rng: Range, content: DocumentFragment) {
  const first = content.firstChild;
  const last = content.lastChild;
  if (!first || !last) {
    return;
  }
  rng.insertNode(content);
  const prev = first.previousSibling;
  const next = last.nextSibling;
  if (prev && first && prev.nodeName === first.nodeName) {
    const node = mergeNodes(prev, first);
    node && rng.setStartAfter(node);
  }
  if (next && last && next.nodeName === last.nodeName) {
    const node = mergeNodes(last, next);
    node && rng.setEndAfter(node);
  }
}

/**
 * Recursively merge matching nested structures into the left node.
 */
function mergeNodes(into: Node | null, from: Node | null) {
  while (
    into instanceof Element &&
    from instanceof Element &&
    into.nodeName === from.nodeName
  ) {
    const tmpLeft = into;
    const tmpRight = from;
    into = into.lastChild;
    from = from.firstChild;
    tmpLeft.append(...tmpRight.childNodes);
    tmpRight.remove();
  }
  return into;
}

export function removeEmptyNodes(editor: HTMLElement) {
  const exts = getExtensions(editor);
  const childless = exts.filter((x) => x.isChildless).map((x) => x.tagName);
  const selector = `:empty:not(${childless.join(",")})`;
  let empty = editor.querySelector(selector);
  while (empty) {
    empty.remove();
    empty = editor.querySelector(selector);
  }
}

export function toggleFormat(
  editor: HTMLElement,
  fmt: { tagName: string; selector: string },
) {
  const rng = getRange(editor);
  if (!rng) {
    return;
  }
  const matches = rangeMatches(rng, fmt.selector);
  let content = split(rng, fmt.selector);
  content = unwrap(content, fmt.selector);
  if (!matches) {
    content = wrapInline(content, document.createElement(fmt.tagName));
    content = mergeSiblings(content, fmt.selector);
  }
  merge(rng, content);
}

export function findRootAncestor(editor: HTMLElement, node: Node | null) {
  while (node && node.parentElement !== editor) {
    node = node.parentElement;
  }
  return node;
}

export function findEditableScope(
  el: Element | null | undefined,
  fallback: HTMLElement,
) {
  const editable = el?.closest("[contenteditable]");
  if (editable?.getAttribute("contenteditable") === "false") {
    return;
  }
  if (editable?.getAttribute("contenteditable") === "true") {
    return editable as HTMLElement;
  }
  return fallback;
}

export function* eachSibling(start: Node, end: Node | null) {
  let node: Node | null = start;
  while (node && node !== end) {
    const next: Node | null = node.nextSibling;
    yield node;
    node = next;
  }
}

export function toggleBlockType(editor: HTMLElement, blockType: string) {
  const rng = getRange(editor);
  const exts = getExtensions(editor);
  if (!rng || !exts?.some((x) => x.tagName === blockType)) {
    return;
  }
  const startEl = getStartEl(rng);
  const scope = findEditableScope(startEl, editor);
  if (!scope) {
    return;
  }
  const startNode = findRootAncestor(
    scope,
    rng.startContainer.childNodes[rng.startOffset] || rng.startContainer,
  );
  if (!startNode) {
    return;
  }
  const endNode = (
    findRootAncestor(
      scope,
      rng.endContainer.childNodes[rng.endOffset] || rng.endContainer,
    ) || startNode
  ).nextSibling;
  const nodes: Node[] = [];
  let isToggleOn = true;
  for (const node of eachSibling(startNode, endNode)) {
    nodes.push(node);
    if (node instanceof HTMLElement && node.matches(blockType)) {
      isToggleOn = false;
    }
  }
  if (!nodes.length) {
    return;
  }
  const tagName = isToggleOn ? blockType : "p";
  for (let i = 0; i < nodes.length; ++i) {
    const node = nodes[i];
    const el = document.createElement(tagName);
    nodes[i] = el;
    if (node instanceof Text) {
      node.replaceWith(el);
      el.append(node);
    } else if (node instanceof Element) {
      node.replaceWith(el);
      el.append(...node.childNodes);
    }
  }
  const start = nodes[0]!;
  const end = nodes[nodes.length - 1]!;
  rng.setStart(start, 0);
  rng.setEnd(end, end.childNodes.length);
}

export function isEmpty(node: Node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text && node.length) {
      return false;
    }
  }
  return true;
}

export function ensureNonEmpty(el: ChildNode | null) {
  if (el instanceof Element && isEmpty(el) && !el.querySelector("br")) {
    el.append(document.createElement("br"));
  }
}

function isAtBoundary(
  n: Node,
  startNode: Node,
  moveNext: (walker: TreeWalker) => Node | null,
) {
  const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
  walker.currentNode = startNode;
  while (moveNext(walker)) {
    if (walker.currentNode instanceof Text && walker.currentNode.length) {
      return false;
    }
  }
  return true;
}

export function isAtEndOf(rng: Range, n: Node) {
  const startNode =
    rng.startContainer.childNodes[rng.startOffset] || rng.startContainer;
  if (startNode instanceof Text && rng.startOffset < startNode.length - 1) {
    return false;
  }
  return isAtBoundary(n, startNode, (w) => w.nextNode());
}

export function isAtStartOf(rng: Range, n: Node) {
  const startNode =
    rng.startContainer.childNodes[rng.startOffset] || rng.startContainer;
  if (startNode instanceof Text && rng.startOffset) {
    return false;
  }
  return isAtBoundary(n, startNode, (w) => w.previousNode());
}

function rangeElement(node: Node, offset: number) {
  return toElement(node.childNodes[offset] || node);
}

export function getStartEl(rng: Range) {
  return rangeElement(rng.startContainer, rng.startOffset);
}

export function getEndEl(rng: Range) {
  return rangeElement(rng.endContainer, rng.endOffset);
}

export function on<K extends keyof DocumentEventMap>(
  el: Document,
  name: K,
  listener: (this: Document, ev: DocumentEventMap[K]) => any,
): () => void;
export function on<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
  el: T,
  name: K,
  listener: (this: T, ev: HTMLElementEventMap[K]) => any,
): () => void;
export function on(
  el: HTMLElement | Document,
  name: string,
  listener: EventListener,
): () => void {
  el.addEventListener(name, listener);
  return () => el.removeEventListener(name, listener);
}

export function deleteBlock(block: HTMLElement) {
  const nodes = {
    next: block.nextSibling,
    prev: block.previousSibling,
    parent: block.parentNode,
  };
  block.remove();
  if (nodes.next) {
    setCursorAtEnd(nodes.next);
  } else if (nodes.prev) {
    const rng = document.createRange();
    const sel = globalThis.getSelection();
    rng.selectNodeContents(nodes.prev);
    rng.collapse();
    sel?.removeAllRanges();
    sel?.addRange(rng);
  } else if (nodes.parent) {
    (nodes.parent as HTMLElement).focus?.();
  }
}

export function insertParagraph(after: Element) {
  const p = document.createElement("p");
  const br = document.createElement("br");
  p.append(br);
  after.insertAdjacentElement("afterend", p);
  return p;
}

export function setCursorAtStart(n: Node) {
  const rng = document.createRange();
  rng.selectNodeContents(n);
  rng.collapse(true);
  const sel = globalThis.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(rng);
}

export function setCursorAtEnd(n: Node) {
  const rng = document.createRange();
  rng.selectNodeContents(n);
  rng.collapse(false);
  const sel = globalThis.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(rng);
}

export function insertBlockFromHTML(
  e: InputEvent,
  editor: HTMLElement,
  selector: string,
): boolean {
  if (e.inputType !== "insertFromPaste" && e.inputType !== "insertFromDrop") {
    return false;
  }
  const html = e.data || e.dataTransfer?.getData("text/html");
  if (!html || !html.includes(selector)) {
    return false;
  }
  const rng = getRange(editor);
  if (!rng) {
    return false;
  }
  const startEl = getStartEl(rng);
  const scope = findEditableScope(startEl, editor);
  if (!scope) {
    return false;
  }
  const ancestor = findRootAncestor(scope, startEl);
  if (!ancestor || !(ancestor instanceof Element)) {
    return false;
  }
  let insertedBlock: Element | null;
  if (isEmpty(ancestor)) {
    ancestor.insertAdjacentHTML("beforebegin", html);
    insertedBlock = ancestor.previousElementSibling;
    ancestor.remove();
  } else {
    ancestor.insertAdjacentHTML("afterend", html);
    insertedBlock = ancestor.nextElementSibling;
  }
  if (insertedBlock) {
    requestAnimationFrame(() => {
      const innerEditable = insertedBlock.querySelector(
        '[contenteditable="true"]',
      );
      if (innerEditable) {
        const target = innerEditable.firstElementChild || innerEditable;
        setCursorAtStart(target);
      } else {
        const nextSibling =
          insertedBlock.nextElementSibling || insertParagraph(insertedBlock);
        setCursorAtStart(nextSibling);
      }
    });
  }
  return true;
}
