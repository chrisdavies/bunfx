/**
 * Drag and drop support for contentEditable=false blocks.
 *
 * Instead of moving DOM elements directly (which causes issues with custom
 * elements that use disconnectedCallback for cleanup), we serialize the
 * dragged element on drag start, then remove and re-insert from the
 * serialized HTML on drop. This mirrors how cut/paste works.
 */

import type { CapableElement, EditorExtension } from './extensions';
import { serialize } from './serialization';

type DropPosition = 'beforebegin' | 'afterend';
type DropTarget = { target: HTMLElement; position: DropPosition };
type DragState = {
  dragging: HTMLElement;
  serializedHTML: string;
  indicator: HTMLElement;
  dropTarget?: DropTarget;
};

type DraggableEditor = HTMLElement & {
  dragstate?: DragState;
};

function getDragState(editor: DraggableEditor) {
  return editor.dragstate;
}

function makeDragState(dragging: HTMLElement): DragState {
  const indicator = document.createElement('editor-ui');
  indicator.className =
    'drop-indicator absolute left-0 right-0 h-0.5 bg-blue-500 transition-all pointer-events-none z-max';
  return {
    dragging,
    serializedHTML: serialize(dragging),
    indicator,
  };
}

function closestEditable(e: Event, editor: DraggableEditor) {
  const target = e.target instanceof HTMLElement ? e.target : undefined;
  const block = target?.closest<HTMLElement>('[contenteditable]');
  if (block && editor.contains(block)) {
    return block;
  }
}

function onmousedown(e: MouseEvent, editor: DraggableEditor) {
  // When the user mouses down in a contenteditable=false block, we
  // make it draggable. If they mouse down in a contenteditable=true
  // block that is *nested* in a contenteditable=false, we don't do
  // anything here.
  const block = closestEditable(e, editor);
  if (!block) {
    return;
  }
  if (block.contentEditable === 'false') {
    if (!block.draggable) {
      block.draggable = true;
    }
    return;
  }
  // Having a draggable ancestor means clicking doesn't work for placing
  // the selection / caret within a contenteditable, so we turn off dragging
  // to restore selection behavior.
  const draggableAncestor = block.closest<HTMLElement>('[draggable=true]');
  if (draggableAncestor) {
    draggableAncestor.draggable = false;
  }
}

function ondragstart(e: DragEvent, editor: DraggableEditor) {
  // Find the closest `[contenteditable]`. If it's `false`, we allow
  // the drag and initialize the drag state. Otherwise, we disallow
  // since this is unlikely to be intended as a drag operation.
  const block = closestEditable(e, editor);
  if (!block) {
    return;
  }
  editor.dragstate = makeDragState(block);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }
  block.style.opacity = '0.5';
}

function canHandleDrop(el: HTMLElement | null) {
  if (el?.contentEditable !== 'true') {
    return false;
  }
  const exts = (el as CapableElement).capabilities;
  return !exts || exts.some((x) => x.capabilities.includes('block*'));
}

function findDropTarget(e: DragEvent, editor: DraggableEditor) {
  let targetEl =
    e.target instanceof HTMLElement
      ? e.target
      : e.target instanceof Node
        ? e.target.parentElement
        : null;
  while (targetEl && !canHandleDrop(targetEl.parentElement)) {
    targetEl = targetEl.parentElement;
  }

  if (!editor.contains(targetEl)) {
    return;
  }

  // We've dragged over a margin / gap between children, so we
  // need to find the child beneath which we'll perform the insert.
  if (targetEl?.contentEditable === 'true') {
    for (const child of targetEl.children) {
      const rect = child.getBoundingClientRect();
      if (child instanceof HTMLElement && e.clientY < rect.bottom) {
        return child;
      }
    }
  }

  return targetEl;
}

function removeDropIndicator(editor: DraggableEditor) {
  const dragstate = getDragState(editor);
  if (!dragstate) {
    return;
  }
  dragstate.dropTarget = undefined;
  dragstate.indicator.remove();
}

function upsertDropIndicator(e: DragEvent, editor: DraggableEditor, target: HTMLElement) {
  const dragstate = getDragState(editor);
  if (!dragstate) {
    return;
  }
  const targetBounds = target.getBoundingClientRect();
  const editorBounds = editor.getBoundingClientRect();
  const midpoint = targetBounds.top + targetBounds.height / 2;
  const indicator = dragstate.indicator;
  const position: DropPosition = e.clientY < midpoint ? 'beforebegin' : 'afterend';
  const indicatorTop =
    position === 'beforebegin'
      ? `${targetBounds.top - editorBounds.top + editor.scrollTop}px`
      : `${targetBounds.bottom - editorBounds.top + editor.scrollTop}px`;
  dragstate.dropTarget = { target, position };
  if (indicator.style.top !== indicatorTop) {
    indicator.style.top = indicatorTop;
  }
  if (!indicator.isConnected) {
    editor.append(indicator);
  }
}

function ondragover(e: DragEvent, editor: DraggableEditor) {
  // Calculate the drop position and upsert a drop indicator
  // if this is a block drag.
  const dragstate = getDragState(editor);
  if (!dragstate) {
    return;
  }
  if (e.dataTransfer) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  const target = findDropTarget(e, editor);
  if (!target) {
    return;
  }
  if (target === dragstate.dragging) {
    removeDropIndicator(editor);
    return;
  }
  upsertDropIndicator(e, editor, target);
}

function ondragend(editor: DraggableEditor) {
  // Remove the original element and insert from serialized HTML.
  // This avoids issues with custom elements that clean up in disconnectedCallback.
  const dragstate = getDragState(editor);
  if (!dragstate) {
    return;
  }
  const dropTarget = dragstate.dropTarget;
  removeDropIndicator(editor);
  if (dropTarget) {
    dragstate.dragging.remove();
    dropTarget.target.insertAdjacentHTML(dropTarget.position, dragstate.serializedHTML);
  } else {
    // No drop target - restore the element's appearance
    dragstate.dragging.style.opacity = '';
    dragstate.dragging.draggable = false;
  }
  editor.dragstate = undefined;
}

export const extDrag: EditorExtension = {
  name: 'drag-blocks',
  capabilities: [],
  onbeforeinput(e, editor) {
    if (e.inputType === 'insertFromDrop' && getDragState(editor)) {
      e.stopPropagation();
      return true;
    }
  },
  attach(editor) {
    editor.addEventListener('mousedown', (e) => onmousedown(e, editor));
    editor.addEventListener('dragstart', (e) => ondragstart(e, editor));
    editor.addEventListener('dragover', (e) => ondragover(e, editor));
    editor.addEventListener('dragend', () => ondragend(editor));
  },
};
