/**
 * Logic for handling text align.
 */

import type { EditorExtension } from "./extensions";
import { findRootAncestor, getRange, getStartEl } from "./utils";

function formatJustify(editor: HTMLElement, inputType: string) {
  const inputTypeAlign: Record<string, string> = {
    formatJustifyLeft: "left",
    formatJustifyCenter: "center",
    formatJustifyRight: "right",
  };
  const textAlign = inputTypeAlign[inputType];
  const rng = getRange(editor);
  if (!rng || !textAlign) {
    return;
  }
  let ancestor = findRootAncestor(editor, getStartEl(rng));
  while (ancestor instanceof HTMLElement && rng.intersectsNode(ancestor)) {
    ancestor.style.textAlign = textAlign;
    ancestor = ancestor.nextElementSibling;
  }
}

export const extTextAlign: EditorExtension = {
  name: "textAlign",
  capabilities: ["block*"],
  onbeforeinput(e, editor) {
    if (e.inputType.startsWith("formatJustify")) {
      formatJustify(editor, e.inputType);
      return true;
    }
  },
};
