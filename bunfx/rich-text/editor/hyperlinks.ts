/**
 * Logic for handling anchor tags.
 */

import { type EditorExtension } from './extensions';
import {
  getRange,
  getStartEl,
  merge,
  mergeSiblings,
  removeEmptyNodes,
  split,
  unwrap,
  wrapInline,
} from './utils';

/**
 * If the href is empty "", this is a *remove* link.
 * If the selection is collapsed, this is an *update* link.
 * If the selection is expanded, this is an *upsert* link.
 */
function insertLink(editor: HTMLElement, href: string) {
  const rng = getRange(editor);
  if (!rng) {
    return;
  }
  const existing = getStartEl(rng)?.closest('a');
  if (!href) {
    if (rng.collapsed && !existing) {
      return;
    }
    if (rng.collapsed) {
      rng.selectNodeContents(existing!);
    }
    const content = rng.extractContents();
    existing?.remove();
    unwrap(content, 'a');
    rng.insertNode(content);
  } else if (rng.collapsed) {
    existing?.setAttribute('href', href);
  } else {
    const content = split(rng, 'a');
    const a = document.createElement('a');
    a.href = href;
    unwrap(content, 'a');
    wrapInline(content, a);
    mergeSiblings(content, `a[href=${CSS.escape(href)}]`);
    merge(rng, content);
  }
  removeEmptyNodes(editor);
}

export const extHyperlinks: EditorExtension = {
  name: 'hyperlinks',
  tagName: 'a',
  capabilities: ['inline*'],
  onbeforeinput(e, editor) {
    if (e.inputType === 'insertLink') {
      insertLink(editor, e.data || '');
      return true;
    }
  },
};
