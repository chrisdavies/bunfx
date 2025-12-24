/**
 * A basic, general undo / redo mechanism.
 */

import type { EditorExtension } from './extensions';
import { type RichText } from '.';
import type { SerializedSelection } from './selection';
import { restoreSelection, serializeSelection } from './selection';

type UndoRedoSnapshot = {
  content: string;
  selection?: SerializedSelection;
};

type UndoRedoEditor = RichText & {
  undoredo: ReturnType<typeof makeUndoRedo<UndoRedoSnapshot>>;
};

export const extUndoRedo: EditorExtension = {
  name: 'undoredo',
  capabilities: [],
  attach(editor) {
    const root = editor as UndoRedoEditor;
    const undoredo = makeUndoRedo<UndoRedoSnapshot>(
      {
        content: root.value || '',
      },
      (state) => {
        root.value = state.content;
        restoreSelection(root, state.selection);
      },
    );
    root.undoredo = undoredo;
    root.addEventListener('input', () => {
      undoredo.setState({
        content: root.value,
        selection: serializeSelection(root),
      });
    });
  },
  onbeforeinput(e, editor) {
    const root = editor as UndoRedoEditor;
    if (e.inputType === 'historyUndo') {
      root.undoredo?.undo();
      return true;
    } else if (e.inputType === 'historyRedo') {
      root.undoredo?.redo();
      return true;
    }
  },
};

/**
 * Generic / general undo / redo system...
 */
type UndoRedo<T> = {
  hist: T[];
  index: number;
  pendingSnapshot?(): void;
};

function makeUndoRedo<T>(state: T, setState: (state: T) => void) {
  const undoredo: UndoRedo<T> = {
    hist: [state],
    index: 0,
  };
  let prev = state;
  let timeout: any;

  const performUndoRedo = (direction: number) => () => {
    undoredo.pendingSnapshot?.();
    undoredo.index = Math.min(undoredo.hist.length, Math.max(0, undoredo.index + direction));
    const newState = undoredo.hist[undoredo.index];
    if (!newState) {
      return;
    }
    prev = newState;
    setState(newState);
  };

  return {
    undo: performUndoRedo(-1),
    redo: performUndoRedo(1),
    setState(state: T) {
      if (state === prev) {
        return;
      }
      prev = state;
      undoredo.pendingSnapshot = () => {
        undoredo.pendingSnapshot = undefined;
        clearTimeout(timeout);
        timeout = undefined;
        undoredo.hist = undoredo.hist.slice(0, undoredo.index + 1);
        undoredo.hist.push(state);
        if (undoredo.hist.length > 500) {
          undoredo.hist = undoredo.hist.slice(undoredo.hist.length - 500);
        }
        undoredo.index = undoredo.hist.length - 1;
      };
      if (!timeout) {
        timeout = setTimeout(() => undoredo.pendingSnapshot?.(), 300);
      }
    },
  };
}
