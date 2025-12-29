/**
 * Logic for dealing with editor selection state, including
 * serializing it so it can be restored with undo / redo
 * snapshots, and highlighting it when the editor loses focus.
 */

import { findRootAncestor, getRange, on } from "./utils";

type SelectionState = {
  highlight?: Highlight;
  range?: Range;
};

type DeserializedPosition = {
  node: Node;
  offset: number;
};

type SerializedPosition = {
  /**
   * The index of the root child, empty text nodes being ignored.
   */
  rootIndex: number;
  /**
   * The character offset within the root child.
   */
  offset: number;
};

export type SerializedSelection = {
  start: SerializedPosition;
  end?: SerializedPosition;
};

export class SelectionChangeEvent extends CustomEvent<Range> {
  constructor(rng: Range) {
    super("selectionchange", {
      detail: rng,
    });
  }
}

export function onSelectionChange(
  editor: HTMLElement,
  handler: (e: SelectionChangeEvent) => void,
) {
  return on(editor, "selectionchange" as any, handler);
}

export function getSelectionState(editor: HTMLElement) {
  let state: SelectionState = (editor as any).$selection;
  if (!state) {
    state = {};
    (editor as any).$selection = state;
  }
  return state;
}

export function restoreSelectionFromState(editor: HTMLElement) {
  const range = getSelectionState(editor).range;
  if (range) {
    const sel = globalThis.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

/**
 * Display the selection even when the editor loses focus.
 */
function registerBlurHighlight(editor: HTMLElement) {
  if (!CSS.highlights) {
    return [];
  }
  const highlightId = "editor-selection";
  return [
    on(editor, "blur", () => {
      const state = getSelectionState(editor);
      if (!state.range) {
        return;
      }
      state.highlight = CSS.highlights.get(highlightId) || new Highlight();
      state.highlight.add(state.range);
      CSS.highlights.set(highlightId, state.highlight);
    }),

    on(editor, "focus", () => {
      const state = getSelectionState(editor);
      if (state.highlight && state.range) {
        state.highlight.delete(state.range);
        state.highlight = undefined;
      }
    }),
  ];
}

function attachSelectionChange(editor: HTMLElement) {
  let watchingSelection = false;
  const onselectionchange = () => {
    if (!editor.contains(document.activeElement)) {
      return;
    }
    const rng = getRange(editor);
    if (!rng) {
      return;
    }
    const state = getSelectionState(editor);
    state.range = rng;
    editor.dispatchEvent(new SelectionChangeEvent(rng));
  };
  const watchSelection = () => {
    if (watchingSelection) {
      return;
    }
    watchingSelection = true;
    document.addEventListener("selectionchange", onselectionchange);
  };
  const removeSelectionWatcher = () => {
    watchingSelection = false;
    document.removeEventListener("selectionchange", onselectionchange);
  };

  return [
    removeSelectionWatcher,
    on(editor, "focusin", watchSelection),
    on(editor, "focusout", (e) => {
      if (!e.relatedTarget || !editor.contains(e.relatedTarget as Node)) {
        removeSelectionWatcher();
      }
    }),
  ];
}

export function attachSelectionWatcher(editor: HTMLElement) {
  const off: Array<() => void> = [
    ...registerBlurHighlight(editor),
    ...attachSelectionChange(editor),
  ];
  return () => off.forEach((fn) => fn());
}

function serializePos(
  editor: HTMLElement,
  rangeNode: Node,
  rangeOffset: number,
) {
  const node = rangeNode.childNodes[rangeOffset] || rangeNode;
  const rootChild = findRootAncestor(editor, node);
  if (!rootChild) {
    return;
  }
  const pos: SerializedPosition = {
    rootIndex: 0,
    offset: node === rangeNode ? rangeOffset : 0,
  };
  for (const child of editor.childNodes) {
    if (child === rootChild) {
      break;
    }
    if (child instanceof Text && !child.length) {
      continue;
    }
    ++pos.rootIndex;
  }
  const walker = document.createTreeWalker(
    rootChild,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  walker.currentNode = node;
  while (walker.previousNode()) {
    const curr = walker.currentNode!;
    if (curr === rootChild) {
      break;
    }
    if (curr instanceof Text) {
      pos.offset += curr.length;
    } else if (curr instanceof Element) {
      ++pos.offset;
    }
  }
  return pos;
}

function deserializePos(
  editor: HTMLElement,
  pos: SerializedPosition,
): DeserializedPosition | undefined {
  let rootIndex = 0;
  let offset = pos.offset;
  let rootChild: Node | null = null;
  for (rootChild of editor.childNodes) {
    if (rootIndex === pos.rootIndex) {
      break;
    }
    if (rootChild instanceof Text && !rootChild.length) {
      continue;
    }
    ++rootIndex;
  }
  if (!rootChild) {
    return;
  }
  const walker = document.createTreeWalker(
    rootChild,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  while (walker.nextNode()) {
    const curr = walker.currentNode!;
    if (curr === rootChild) {
      return;
    }
    const nextOffset = offset - (curr instanceof Text ? curr.length : 1);
    if (nextOffset <= 0) {
      return { node: curr, offset };
    }
    offset = nextOffset;
  }
}

export function serializeSelection(
  editor: HTMLElement,
): SerializedSelection | undefined {
  const rng = getRange(editor);
  if (!rng) {
    return;
  }
  const start = serializePos(editor, rng.startContainer, rng.startOffset);
  if (!start) {
    return;
  }
  const end = rng.collapsed
    ? undefined
    : serializePos(editor, rng.endContainer, rng.endOffset);
  return { start, end };
}

export function restoreSelection(
  editor: HTMLElement,
  selection?: SerializedSelection,
) {
  if (!selection) {
    return;
  }
  const start = deserializePos(editor, selection.start);
  if (!start) {
    return;
  }
  const end = selection.end && deserializePos(editor, selection.end);
  const sel = window.getSelection();
  const rng = document.createRange();
  rng.setStart(start.node, start.offset);
  end && rng.setEnd(end.node, end.offset);
  sel?.removeAllRanges();
  sel?.addRange(rng);
}
