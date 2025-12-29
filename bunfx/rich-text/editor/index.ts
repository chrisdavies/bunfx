import { attachChangeObserver } from "./change";
import type { EditorConfig } from "./config";
import { applyEdit } from "./core";
import type { EditorExtension } from "./extensions";
import { getExtensions } from "./extensions";
import { attachSelectionWatcher, type SelectionChangeEvent } from "./selection";
import { serializeChildren } from "./serialization";
import { deleteBlock, insertParagraph, setCursorAtEnd } from "./utils";

export { applyEdit } from "./core";
export { SelectionChangeEvent } from "./selection";

function isDeletion(e: KeyboardEvent) {
  return e.key === "Delete" || e.key === "Backspace";
}

function isUneditableBlock(editor: HTMLElement, el: Element | null) {
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  return el.contentEditable === "false" && editor.contains(el) && editor !== el;
}

function makeEditable(editor: HTMLElement | null) {
  if (
    !editor ||
    editor.contentEditable !== "true" ||
    editor.dataset.initialized
  ) {
    return;
  }
  editor.dataset.initialized = "true";
  editor.addEventListener("keydown", (e) => {
    if (isDeletion(e) && isUneditableBlock(editor, document.activeElement)) {
      e.preventDefault();
      deleteBlock(document.activeElement as HTMLElement);
      return;
    }
    if (
      e.key === "Enter" &&
      isUneditableBlock(editor, document.activeElement)
    ) {
      e.preventDefault();
      const block = document.activeElement as HTMLElement;
      const p = insertParagraph(block);
      setCursorAtEnd(p);
      return;
    }
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key === "z") {
      e.preventDefault();
      applyEdit(editor, "historyUndo");
    } else if (isCtrl && (e.key === "Z" || e.key === "y")) {
      e.preventDefault();
      applyEdit(editor, "historyRedo");
    } else if (isCtrl && e.key === "b") {
      e.preventDefault();
      applyEdit(editor, "formatBold");
    } else if (isCtrl && e.key === "i") {
      e.preventDefault();
      applyEdit(editor, "formatItalic");
    } else if (isCtrl && e.key === "u") {
      e.preventDefault();
      applyEdit(editor, "formatUnderline");
    } else if (isCtrl && e.shiftKey && e.key === "X") {
      e.preventDefault();
      applyEdit(editor, "formatStrikeThrough");
    } else if (e.key === "Tab") {
      e.preventDefault();
      applyEdit(editor, e.shiftKey ? "formatOutdent" : "formatIndent");
    }
  });
  editor.addEventListener("rich-text:selectionchange", (e: Event) => {
    const exts = getExtensions(editor);
    if (
      exts?.find((x) =>
        x.onselectionchange?.(e as SelectionChangeEvent, editor),
      )
    ) {
      e.preventDefault();
    }
  });
  editor.addEventListener("beforeinput", (e) => {
    if (isUneditableBlock(editor, document.activeElement)) {
      e.preventDefault();
      return;
    }
    const exts = getExtensions(editor);
    exts?.find((x) => x.onbeforeinput?.(e, editor));
    e.preventDefault();
  });
  getExtensions(editor).forEach((ext) => ext.attach?.(editor));
}

export class RichText extends HTMLElement {
  static observedAttributes = ["autofocus"];

  detach: Array<() => void> = [];
  extensions: EditorExtension[] = [];
  #value = "";
  #config: EditorConfig | undefined;
  #connected = false;

  get value() {
    return this.#value;
  }
  set value(s: string) {
    if (this.#value === s) {
      return;
    }
    this.#value = s;
    this.innerHTML = s;
  }

  get config() {
    return this.#config;
  }
  set config(c: EditorConfig | undefined) {
    this.#config = c;
    if (this.#connected && c) {
      this.#initialize();
    }
  }

  serialize() {
    this.#value = serializeChildren(this);
    return this.#value;
  }

  #initialize() {
    this.extensions = this.#config?.extensions || [];
    makeEditable(this);
    this.detach.push(attachChangeObserver(this));
    this.detach.push(attachSelectionWatcher(this));

    if (this.hasAttribute("autofocus")) {
      this.focus();
    }
  }

  connectedCallback() {
    this.#connected = true;
    if (this.#config) {
      this.#initialize();
    }
  }

  disconnectedCallback() {
    this.#connected = false;
    this.detach.forEach((f) => f());
    this.detach.length = 0;
  }
}

customElements.define("rich-text", RichText);
