/**
 * Format-related logic (bold, italic, etc)
 */

import type { SelectionChangeEvent } from './selection';
import { getStartEl, getEndEl } from './utils';

export type CapableElement = HTMLElement & {
  capabilities?: EditorExtension[];
};

export type EditorExtension = {
  name: string;
  tagName?: string;
  selector?: string;
  isInline?: boolean;
  isChildless?: boolean;
  capabilities: string[];
  attach?(editor: HTMLElement): void;
  onkeydown?(e: KeyboardEvent, editor: HTMLElement): boolean | undefined | void;
  onbeforeinput?(e: InputEvent, editor: HTMLElement): boolean | undefined | void;
  onselectionchange?(e: SelectionChangeEvent, editor: HTMLElement): boolean | undefined | void;
};

type EditorWithExtensions = HTMLElement & {
  extensions?: EditorExtension[];
};

export function getExtensions(editor: HTMLElement): EditorExtension[] {
  return (editor as EditorWithExtensions).extensions || [];
}

function* walkAncestors(from: Node, to: Node) {
  let curr: Node | null = from;

  while (curr && curr !== to) {
    yield curr;
    curr = curr.parentNode;
  }
}

function* walkNodes({ ancestor, start, end }: { ancestor: Node; start: Node; end: Node }) {
  const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT);
  walker.currentNode = start;

  while (walker.currentNode) {
    yield walker.currentNode;
    if (walker.currentNode === end) {
      break;
    }
    if (!walker.nextNode()) {
      break;
    }
  }
}

function restrictCapabilities(capabilities: EditorExtension[], iter: Iterable<Node>) {
  for (const node of iter) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    const elCapabilities = (node as any).capabilities as EditorExtension[] | undefined;
    if (!elCapabilities) {
      continue;
    }
    capabilities = capabilities.filter((x) => elCapabilities.includes(x));
  }
  return capabilities;
}

export function selectionCapabilities({
  range,
  editor,
}: {
  range: Range;
  editor: HTMLElement;
}): EditorExtension[] {
  const start = getStartEl(range);
  const end = getEndEl(range);

  if (!start || !end) {
    return getExtensions(editor);
  }

  let capabilities = [...getExtensions(editor)];

  capabilities = restrictCapabilities(capabilities, walkAncestors(start, editor));

  if (start !== end) {
    capabilities = restrictCapabilities(capabilities, walkAncestors(end, editor));
  }

  if (!range.collapsed) {
    capabilities = restrictCapabilities(capabilities, walkNodes({ ancestor: editor, start, end }));
  }

  return capabilities;
}
