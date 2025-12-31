/**
 * The core extensions manage standard block elements,
 * edit operations such as text input, and line breaks.
 */

import { type EditorExtension, getExtensions } from "./extensions";
import { restoreSelectionFromState } from "./selection";
import { serialize } from "./serialization";
import {
  deleteBlock,
  ensureNonEmpty,
  getEndEl,
  getRange,
  getStartEl,
  merge,
  toggleBlockType,
} from "./utils";

export class CustomInputEvent extends InputEvent {
  #inputType: string;

  override get inputType() {
    return this.#inputType;
  }

  constructor(eventInitDict?: InputEventInit) {
    super("beforeinput", eventInitDict);
    this.#inputType = eventInitDict?.inputType || "";
  }
}

/**
 * Display the selection even when the editor loses focus.
 */
export function registerBlurHighlight(editor: HTMLElement) {
  const highlightId = "editor-selection";
  const state: { highlight?: Highlight; range?: Range } = {};
  (editor as any).highlightState = state;

  editor.addEventListener("blur", () => {
    const rng = getRange(editor);
    if (!rng) {
      return;
    }
    if (CSS.highlights) {
      state.range = rng;
      state.highlight = CSS.highlights.get(highlightId) || new Highlight();
      state.highlight.add(rng);
      CSS.highlights.set(highlightId, state.highlight);
    }
  });

  editor.addEventListener("focus", () => {
    if (CSS.highlights && state.highlight && state.range) {
      state.highlight.delete(state.range);
      state.highlight = undefined;
      state.range = undefined;
    }
  });
}

export function applyEdit(editor: HTMLElement, e: InputEvent): void;
export function applyEdit(
  editor: HTMLElement,
  inputType: string,
  data?: string,
): void;
export function applyEdit(
  editor: HTMLElement,
  inputType: string | InputEvent,
  data = "",
) {
  if (!editor.contains(document.activeElement)) {
    restoreSelectionFromState(editor);
  }
  const event =
    inputType instanceof Event
      ? inputType
      : new CustomInputEvent({ inputType, data });
  editor.dispatchEvent(event);
}

export function deleteForInput(editor: HTMLElement) {
  const rng = getRange(editor);
  if (rng?.collapsed) {
    return;
  }
  applyEdit(editor, "deleteContentBackward");
}

export function getContentEditableFalse(
  node: Node | null,
): HTMLElement | undefined {
  const el = (
    node instanceof HTMLElement ? node : node?.parentElement
  )?.closest<HTMLElement>("[contenteditable]");
  return el?.contentEditable === "false" ? el : undefined;
}

function isUneditableBlock(editor: HTMLElement, el: Element | null) {
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  return el.contentEditable === "false" && editor.contains(el) && editor !== el;
}

function spansContentEditableFalseBlocks(rng: Range): HTMLElement | undefined {
  const start = getStartEl(rng);
  const end = getEndEl(rng);
  const nonEditableStart = getContentEditableFalse(start);
  if (nonEditableStart) {
    return nonEditableStart;
  }
  if (start === end || !end || !start) {
    return;
  }
  const nonEditableEnd = getContentEditableFalse(end);
  if (nonEditableEnd) {
    return nonEditableEnd;
  }
  let node = start.nextSibling;
  while (node && node !== end) {
    if (rng.intersectsNode(node)) {
      const nonEditable = getContentEditableFalse(node);
      if (nonEditable) {
        return nonEditable;
      }
    }
    node = node.nextSibling;
  }
}

export function insertLineBreak(editor: HTMLElement) {
  deleteForInput(editor);
  const rng = getRange(editor);
  if (!rng) {
    return;
  }
  const br = document.createElement("br");
  const txt = document.createTextNode("");
  rng.insertNode(br);
  br.parentElement?.insertBefore(txt, br.nextSibling);
  rng.selectNodeContents(txt);
  rng.collapse();
  let next = txt.nextSibling;
  while (next && next instanceof Text && !next.length) {
    next = next.nextSibling;
  }
  if (!next) {
    br.parentElement?.insertBefore(br.cloneNode(), txt.nextSibling);
  }
}

export function handleParagraphAsLineBreak(
  e: InputEvent,
  editor: HTMLElement,
  selector: string,
): boolean {
  if (e.inputType !== "insertParagraph") {
    return false;
  }
  const target = e.target as Node;
  const element = (
    target instanceof Element ? target : target.parentElement
  )?.closest(selector);
  if (!element) {
    return false;
  }
  insertLineBreak(editor);
  return true;
}

export const extLinebreak: EditorExtension = {
  name: "linebreak",
  isInline: true,
  capabilities: ["inline*"],
  onbeforeinput(e, editor) {
    if (e.inputType === "insertLineBreak") {
      insertLineBreak(editor);
      return true;
    }
  },
};

export const extEdit: EditorExtension = {
  name: "edit",
  isInline: true,
  capabilities: ["inline*", "edit*"],
  onbeforeinput(e, editor) {
    if (
      e.inputType === "insertText" ||
      e.inputType === "insertReplacementText"
    ) {
      insertText(editor, e);
      return true;
    }
    if (e.inputType === "insertFromDrop" || e.inputType === "insertFromPaste") {
      if (e.dataTransfer?.types.includes("text/html")) {
        insertHTML(editor, e);
        return true;
      }
      if (e.dataTransfer?.types.includes("text/plain")) {
        insertText(editor, e);
        return true;
      }
      return;
    }
    if (e.inputType.startsWith("deleteContent")) {
      const sel = window.getSelection();
      if (sel?.isCollapsed) {
        sel?.modify(
          "extend",
          e.inputType.endsWith("Backward") ? "backward" : "forward",
          "character",
        );
        const rng = getRange(editor);
        if (!rng) {
          return;
        }
        const nonEditable = spansContentEditableFalseBlocks(rng);
        if (nonEditable) {
          rng.collapse();
          nonEditable.focus();
          return true;
        }
      }
      deleteSelection(editor);
      return true;
    }
  },
};

export const extBlocks: EditorExtension = {
  name: "blocks",
  tagName: "p",
  capabilities: ["blocks*"],
  onbeforeinput(e, editor) {
    if (e.inputType === "insertParagraph") {
      insertParagraph(editor);
      return true;
    }
    if (e.inputType === "formatBlock" && e.data) {
      toggleBlockType(editor, e.data);
      return true;
    }
    // Ensure cursor is in a valid block context before text input
    if (
      e.inputType === "insertText" ||
      e.inputType === "insertReplacementText" ||
      e.inputType === "insertFromPaste" ||
      e.inputType === "insertFromDrop"
    ) {
      ensureBlockContext(editor);
    }
  },
  attach(editor) {
    ensureEditorNotEmpty(editor);

    const handleCopyCut = (e: ClipboardEvent) => {
      if (isUneditableBlock(editor, document.activeElement)) {
        e.preventDefault();
        const block = document.activeElement as HTMLElement;
        e.clipboardData?.setData("text/html", serialize(block));
        e.clipboardData?.setData("text/plain", block.textContent || "");
        if (e.type === "cut") {
          deleteBlock(block);
        }
      }
    };

    editor.addEventListener("copy", handleCopyCut);
    editor.addEventListener("cut", handleCopyCut);
  },
};

/**
 * Ensure the editor has at least one paragraph if empty.
 */
function ensureEditorNotEmpty(editor: HTMLElement) {
  if (!editor.firstChild) {
    const p = document.createElement("p");
    p.appendChild(document.createElement("br"));
    editor.appendChild(p);
  }
}

/**
 * Ensure cursor is inside a block element, not directly in the editor root.
 * If cursor is at root level, creates a paragraph and moves cursor into it.
 */
function ensureBlockContext(editor: HTMLElement) {
  const sel = globalThis.getSelection();
  if (!sel?.anchorNode || !editor.contains(sel.anchorNode)) {
    return;
  }
  const anchor = sel.anchorNode;
  const offset = sel.anchorOffset;

  // Cursor is directly in the editor element (empty or between blocks)
  if (anchor === editor) {
    const p = document.createElement("p");
    p.appendChild(document.createElement("br"));
    const refNode = editor.childNodes[offset];
    if (refNode) {
      editor.insertBefore(p, refNode);
    } else {
      editor.appendChild(p);
    }
    sel.setPosition(p, 0);
    return;
  }

  // Text node directly under editor (shouldn't happen with valid content, but handle it)
  if (anchor instanceof Text && anchor.parentNode === editor) {
    const p = document.createElement("p");
    anchor.before(p);
    p.appendChild(anchor);
    sel.setPosition(anchor, offset);
  }
}

function insertHTML(editor: HTMLElement, e: InputEvent) {
  deleteForInput(editor);
  const html = e.data || e.dataTransfer?.getData("text/html");
  if (!html) {
    return;
  }
  const rng = getRange(editor);
  if (!rng) {
    return;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const frag = document.createDocumentFragment();
  frag.append(...doc.body.childNodes);
  merge(rng, frag);
}

function insertText(editor: HTMLElement, e: InputEvent) {
  deleteForInput(editor);
  const text = e.data || e.dataTransfer?.getData("text/plain");
  if (!text) {
    return;
  }
  const sel = window.getSelection();
  if (!sel) {
    return;
  }
  const node = sel.anchorNode;
  if (!editor.contains(node)) {
    return;
  }
  if (node instanceof Text) {
    node.insertData(sel.anchorOffset, text);
    sel.setPosition(node, sel.anchorOffset + 1);
  }
  if (node instanceof HTMLElement) {
    const txt = document.createTextNode(text);
    node.insertBefore(txt, node.childNodes[sel.anchorOffset] || null);
    sel.setPosition(txt, 1);
  }
}

function getIsInline(exts: EditorExtension[], node: Node) {
  if (node instanceof Text) {
    return true;
  }
  return (
    node instanceof HTMLElement &&
    exts.some((x) => {
      if (!x.isInline) {
        return;
      }
      const selector = x.selector || x.tagName;
      return selector && (node as Element).matches(selector);
    })
  );
}

function closestBlock(
  exts: EditorExtension[],
  common: Node,
  node: Node | null,
) {
  const isInline = true;
  while (node) {
    if (isInline && !getIsInline(exts, node)) {
      return node;
    }
    if (node.parentNode === common) {
      break;
    }
    node = node.parentNode;
  }
  return null;
}

function insertParagraph(editor: HTMLElement) {
  deleteForInput(editor);
  const rng = getRange(editor);
  const exts = getExtensions(editor);
  if (!rng || !exts) {
    return;
  }
  const node = closestBlock(exts, editor, getStartEl(rng));
  if (!node) {
    return;
  }
  rng.setEndAfter(node);
  const content = rng.extractContents();
  let first = content.firstChild;
  if (first instanceof Element && !getIsInline(exts, first)) {
    const p = document.createElement("p");
    p.append(...first.childNodes);
    first = p;
    ensureNonEmpty(p);
  }
  first && node.parentElement?.insertBefore(first, node.nextSibling);
  rng.collapse();
  first && rng.setStart(first, 0);
  for (const child of editor.children) {
    ensureNonEmpty(child);
  }
}

function findAncestor(
  exts: EditorExtension[],
  common: Node,
  node: Node | null,
) {
  let isInline = true;
  while (node) {
    if (isInline && !getIsInline(exts, node)) {
      isInline = false;
    }
    if (node.parentNode === common) {
      break;
    }
    node = node.parentNode;
  }
  return { node, isInline };
}

function deleteSelection(editor: HTMLElement) {
  const rng = getRange(editor);
  const exts = getExtensions(editor);
  if (!rng || !exts) {
    return;
  }
  const ancestor = rng.commonAncestorContainer;
  const start = findAncestor(exts, ancestor, getStartEl(rng));
  const end = findAncestor(exts, ancestor, getEndEl(rng));
  rng.deleteContents();
  if (start.isInline || !start.node || !end.node) {
    return;
  }
  const childNodes = [...end.node.childNodes];
  (start.node as HTMLElement).append(...childNodes);
  (end.node as HTMLElement).remove();
  rng.setStart(childNodes[0] || start.node.lastChild!, 0);
  rng.collapse(true);
}
