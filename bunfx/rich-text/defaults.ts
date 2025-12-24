import type { EditorExtension } from './editor/extensions';
import { extRichCta } from './components/rich-cta';
import { extRichHr } from './components/rich-hr';
import { extRichImg } from './components/rich-img';
import { extRichBlock } from './components/rich-block';
import * as formats from './editor/formats';
import * as undoredo from './editor/undo-redo';
import * as marks from './editor/marks';
import * as hyperlinks from './editor/hyperlinks';
import * as lists from './editor/lists';
import * as core from './editor/core';
import * as textAlign from './editor/text-align';
import * as drag from './editor/drag-blocks';

export function getDefaultExtensions(): EditorExtension[] {
  return [
    extRichCta,
    extRichHr,
    extRichImg,
    extRichBlock,
    formats.extBold,
    formats.extItalic,
    undoredo.extUndoRedo,
    drag.extDrag,
    formats.extPendingFormats,
    formats.extStrikeThrough,
    formats.extUnderline,
    marks.extMarks,
    hyperlinks.extHyperlinks,
    lists.extLists,
    core.extLinebreak,
    core.extBlocks,
    textAlign.extTextAlign,
    { tagName: 'br', name: 'br', isInline: true, isChildless: true, capabilities: ['inline*'] },
    { tagName: 'img', name: 'img', isInline: true, isChildless: true, capabilities: ['inline*'] },
    { tagName: 'h1', name: 'h1', capabilities: ['block*'] },
    { tagName: 'h2', name: 'h2', capabilities: ['block*'] },
    { tagName: 'h3', name: 'h3', capabilities: ['block*'] },
    { tagName: 'h4', name: 'h4', capabilities: ['block*'] },
    { tagName: 'h5', name: 'h5', capabilities: ['block*'] },
    { tagName: 'h6', name: 'h6', capabilities: ['block*'] },
    { tagName: 'blockquote', name: 'blockquote', capabilities: ['block*'] },
    core.extEdit,
  ];
}
