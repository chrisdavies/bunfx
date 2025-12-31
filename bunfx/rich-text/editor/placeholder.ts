import type { EditorExtension } from "./extensions";

/**
 * Fast check for whether the editor is empty from the user's perspective.
 * Returns true if:
 * - No children at all
 * - Single child that is either empty or <p><br></p>
 */
function isEditorEmpty(editor: HTMLElement): boolean {
  const count = editor.childElementCount;

  // No children at all
  if (count === 0) return true;

  // More than one child = not empty
  if (count > 1) return false;

  // Exactly one child - check if it's an empty paragraph
  const child = editor.firstElementChild!;
  if (child.tagName !== "P") return false;

  // Empty <p></p> or <p><br></p>
  const inner = child.childNodes;
  if (inner.length === 0) return true;
  if (inner.length === 1 && inner[0]?.nodeName === "BR") return true;

  return false;
}

/**
 * Creates a placeholder extension that shows hint text when the editor is empty.
 * Uses CSS ::before pseudo-element for rendering - no extra DOM elements.
 */
export function extPlaceholder(text: string): EditorExtension {
  return {
    name: "placeholder",
    capabilities: [],

    attach(editor: HTMLElement) {
      editor.setAttribute("data-placeholder", text);

      const update = () => {
        editor.toggleAttribute("data-empty", isEditorEmpty(editor));
      };

      update();
      editor.addEventListener("input", update);

      return () => {
        editor.removeEventListener("input", update);
        editor.removeAttribute("data-placeholder");
        editor.removeAttribute("data-empty");
      };
    },
  };
}
