/**
 * Format-related logic (bold, italic, etc)
 */

import { getExtensions, type EditorExtension } from './extensions';
import { getRange, removeEmptyNodes, toggleFormat } from './utils';

type Formattable = HTMLElement & {
  pendingFormats: Set<string>;
};

function getFormattable(editor: HTMLElement): Formattable {
  const fmt = editor as Formattable;
  if (!fmt.pendingFormats) {
    fmt.pendingFormats = new Set();
  }
  return fmt;
}

function defFormat(fmt: { tagName: string; selector: string; inputType: string }): EditorExtension {
  return {
    name: fmt.inputType,
    selector: fmt.selector,
    tagName: fmt.tagName,
    isInline: true,
    capabilities: ['inline*', 'format*'],
    onbeforeinput(e, editorEl) {
      const editor = getFormattable(editorEl);
      if (e.inputType !== fmt.inputType) {
        return;
      }
      const rng = getRange(editor);
      if (!rng) {
        return;
      }
      if (rng.collapsed) {
        editor.pendingFormats.has(fmt.tagName)
          ? editor.pendingFormats.delete(fmt.tagName)
          : editor.pendingFormats.add(fmt.tagName);
        return true;
      }
      toggleFormat(editor, fmt);
      removeEmptyNodes(editor);
      return true;
    },
  };
}

export const extPendingFormats: EditorExtension = {
  name: 'pendingFormats',
  capabilities: ['inline*', 'format*'],
  onselectionchange(_e, editor) {
    getFormattable(editor).pendingFormats.clear();
  },
  onbeforeinput(_e, editorEl) {
    const editor = getFormattable(editorEl);
    if (!editor.pendingFormats.size) {
      return;
    }
    const fmts = Array.from(editor.pendingFormats);
    editor.pendingFormats.clear();
    const rng = getRange(editor);
    if (!rng) {
      return;
    }
    const txt = document.createTextNode('');
    rng.insertNode(txt);
    const exts = getExtensions(editor);
    if (exts) {
      for (const tagName of fmts) {
        const def = exts.find((x) => x.tagName === tagName);
        def && toggleFormat(editor, { tagName, selector: def?.selector || tagName });
      }
    }
    rng.selectNode(txt);
  },
};

export const extBold = defFormat({
  inputType: 'formatBold',
  tagName: 'strong',
  selector: 'b,strong',
});

export const extItalic = defFormat({
  inputType: 'formatItalic',
  tagName: 'em',
  selector: 'i,em',
});

export const extUnderline = defFormat({
  inputType: 'formatUnderline',
  tagName: 'u',
  selector: 'u',
});

export const extStrikeThrough = defFormat({
  inputType: 'formatStrikeThrough',
  tagName: 's',
  selector: 's',
});
