/**
 * Logic for handling marks (bg and fg color) for selections.
 */

import type { EditorExtension } from "./extensions";
import {
  getRange,
  getStartEl,
  merge,
  removeEmptyNodes,
  split,
  wrapInline,
} from "./utils";

function unwrapMarks(
  content: DocumentFragment,
  attr: "background" | "color",
  color: string,
) {
  content.querySelectorAll("mark").forEach((el) => {
    el.style[attr] = color;
    if (!el.style.background && !el.style.color) {
      el.replaceWith(...el.childNodes);
    }
  });
}

/**
 * If the color is empty "", this is a *remove* mark (if the alternate
 * color (background / color) is also empty.
 * If the selection is collapsed, this is an *update* color.
 * If the selection is expanded, this is a new mark.
 */
function insertMark(
  editor: HTMLElement,
  attr: "background" | "color",
  color: string,
) {
  const rng = getRange(editor);
  if (!rng) {
    return;
  }
  const selector = "mark";
  const existing = getStartEl(rng)?.closest(selector);
  if (!color) {
    if (rng.collapsed && !existing) {
      return;
    }
    if (existing) {
      existing.style[attr] = color;
      if (existing.style.color || existing.style.background) {
        return;
      }
    }
    if (rng.collapsed && existing) {
      rng.selectNodeContents(existing);
    }
    const content = rng.extractContents();
    existing?.remove();
    unwrapMarks(content, attr, color);
    rng.insertNode(content);
  } else if (rng.collapsed) {
    existing?.setAttribute(attr, color);
  } else {
    const content = split(rng, selector);
    const mark = document.createElement("mark");
    mark.style[attr] = color;
    unwrapMarks(content, attr, color);
    wrapInline(content, mark);
    merge(rng, content);
  }
  removeEmptyNodes(editor);
}

export const extMarks: EditorExtension = {
  name: "mark",
  tagName: "mark",
  capabilities: ["inline*"],
  onbeforeinput(e, editor) {
    if (
      e.inputType === "formatBackColor" ||
      e.inputType === "formatFontColor"
    ) {
      insertMark(
        editor,
        e.inputType === "formatBackColor" ? "background" : "color",
        e.data || "",
      );
      return true;
    }
  },
};
