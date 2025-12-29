/**
 * This hook creates and manages editor state that automatically updates UI components
 * when the selection changes. It tracks the current selection range and computes
 * available capabilities (formatting options, block operations, etc.) based on the
 * selection context.
 *
 * Usage: Call `useEditorState()` once per editor instance and pass the state to
 * toolbar components. The state provides:
 * - `ref`: Callback to bind the editor element
 * - `onSelectionChange`: Handler for selection change events
 * - `range`: Signal containing the current selection range
 * - `capabilities`: Computed signal with available editor extensions for current context
 */
import { computed, signal } from "@preact/signals";
import type { SignalLike } from "preact";
import { useMemo } from "preact/hooks";
import type { EditorExtension } from "../editor/extensions";
import { selectionCapabilities } from "../editor/extensions";
import type { SelectionChangeEvent } from "../editor/selection";

export type PreactEditorState = {
  id: string;
  editor?: HTMLElement;
  range: SignalLike<Range | undefined>;
  capabilities: SignalLike<EditorExtension[]>;
};

export type PreactEditorStateManager = PreactEditorState & {
  ref(el: HTMLElement | null): void;
  onSelectionChange(e: SelectionChangeEvent): void;
};

export function useEditorState(): PreactEditorStateManager {
  return useMemo(() => {
    const rangeSignal = signal<Range | undefined>();
    const state: PreactEditorStateManager = {
      id: `s${globalThis.crypto.randomUUID()}`,
      range: rangeSignal,
      capabilities: computed(() => {
        const range = rangeSignal.value;
        const editor = state.editor;
        if (!range || !editor) {
          return [];
        }
        return selectionCapabilities({ range, editor });
      }),
      ref(el) {
        if (el) {
          state.editor = el;
        }
      },
      onSelectionChange(e) {
        rangeSignal.value = e.detail.cloneRange();
      },
    };
    return state;
  }, []);
}
