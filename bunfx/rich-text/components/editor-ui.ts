/**
 * A custom element that exists purely to make "ignore this"
 * editor-ui state ignorable by the serialization logic.
 */
export class EditorUI extends HTMLElement {
  connectedCallback() {
    this.contentEditable = "false";
  }
}

customElements.define("editor-ui", EditorUI);

/**
 * A custom element that exists to represent a pending editor
 * operation such as a file upload so that it can be swapped
 * out with a final form when the operation completes. The
 * undo / redo mechanism can gracefully handle these.
 */
export class EditorPlaceholder extends HTMLElement {
  connectedCallback() {
    this.contentEditable = "false";
  }

  serialize() {
    return "";
  }
}

customElements.define("editor-placeholder", EditorPlaceholder);
