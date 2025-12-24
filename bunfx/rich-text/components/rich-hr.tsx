import type { EditorExtension } from '../editor/extensions';
import { deleteForInput } from '../editor/core';
import {
  findEditableScope,
  findRootAncestor,
  getRange,
  getStartEl,
  insertParagraph,
} from '../editor/utils';

export class RichHr extends HTMLElement {
  connectedCallback() {
    this.contentEditable = 'false';
    this.tabIndex = 0;
    if (!this.querySelector('hr')) {
      this.innerHTML = '<hr/>';
    }
  }

  serialize() {
    return this.outerHTML;
  }
}

customElements.define('rich-hr', RichHr);

export const extRichHr: EditorExtension = {
  name: 'rich-hr',
  tagName: 'rich-hr',
  isChildless: true,
  capabilities: ['block*'],
  onbeforeinput(e, editor) {
    if (e.inputType === 'insertHorizontalRule') {
      deleteForInput(editor);
      const rng = getRange(editor);
      if (!rng) {
        return;
      }
      const startEl = getStartEl(rng);
      const scope = findEditableScope(startEl, editor);
      if (!scope) {
        return;
      }
      const richHr = document.createElement('rich-hr');
      const ancestor = findRootAncestor(scope, startEl);
      if (ancestor instanceof Element) {
        ancestor.replaceWith(richHr);
      } else {
        scope.insertBefore(richHr, ancestor?.nextSibling || null);
      }
      let next = richHr.nextElementSibling;
      if (!next) {
        next = insertParagraph(richHr);
      }
      rng.setStart(next, 0);
      next.scrollIntoView({ behavior: 'smooth', block: 'center' });

      return true;
    }
  },
};
