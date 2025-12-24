/**
 * The toolbar we display when an empty paragraph is focused,
 * allowing the user to insert blocks (media, hrs, etc)
 */

import { useSignal } from '@preact/signals';
import { getStartEl, isEmpty, on } from '../editor/utils';
import { type PreactEditorState } from './use-editor-signal';
import { Button } from '../ui';
import { IcoImage, IcoPlus, IcoRectangleGroup, IcoRocketLaunch } from '../icons';
import { applyEdit } from '../editor';
import { useEffect } from 'preact/hooks';

function pickFile(accept?: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) {
      input.accept = accept;
    }
    input.onchange = () => {
      resolve(input.files?.[0]);
    };
    input.oncancel = () => resolve(undefined);
    input.click();
  });
}
import { createEmptyHTML as createEmptyCta } from './rich-cta';
import { createEmptyHTML as createEmptyBlock } from './rich-block';
import { type ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';

type BlockButtonProps = {
  icon: ComponentChildren;
  text: string;
  onClick: () => void;
};

function BlockButton({ icon, text, onClick }: BlockButtonProps) {
  return (
    <Button
      class="flex flex-col items-center gap-1 p-2 rounded-lg transition-all cursor-pointer group"
      title={text}
      onClick={onClick}
    >
      <div class="ring inline-flex items-center justify-center rounded-full size-10 group-hover:ring-2">
        {icon}
      </div>
      <span class="text-xs font-medium opacity-75">{text}</span>
    </Button>
  );
}

type ToolbarState = {
  ancestor: Element;
  top: string;
  left: string;
  container: Element;
};

function findEditableContext(
  editor: HTMLElement,
  node: Node | null,
): { ancestor: Node; container: Element } | undefined {
  const container = (node as Element)?.closest?.('article[contenteditable]') || editor;
  let ancestor: Node | null = node;
  while (ancestor && ancestor.parentElement !== container) {
    ancestor = ancestor.parentElement;
  }
  if (ancestor && container) {
    return { ancestor, container };
  }
}

function getToolbarPosition(editor?: HTMLElement, rng?: Range): ToolbarState | undefined {
  if (!editor || !rng || !rng.collapsed) {
    return;
  }
  const node = getStartEl(rng);
  const context = findEditableContext(editor, node);
  if (!context) {
    return;
  }
  const { ancestor, container } = context;
  if (!isEmpty(ancestor) || !(ancestor instanceof Element)) {
    return;
  }
  const bounds = ancestor.getBoundingClientRect();
  const isInsideRichBlock =
    container instanceof HTMLElement && container.tagName.toLowerCase() === 'rich-block';
  if (isInsideRichBlock) {
    const containerBounds = container.getBoundingClientRect();
    return {
      ancestor,
      container,
      top: `${bounds.top - containerBounds.top + bounds.height / 2}px`,
      left: `${bounds.left - containerBounds.left}px`,
    };
  }
  const editorBounds = editor.getBoundingClientRect();
  const editorTop = editorBounds.top - editor.offsetTop;
  const editorLeft = editorBounds.left - editor.offsetLeft;
  return {
    ancestor,
    container,
    top: `${bounds.top - editorTop + bounds.height / 2}px`,
    left: `${bounds.left - editorLeft}px`,
  };
}

export function NewBlockToolbar({ state }: { state: PreactEditorState }) {
  const expanded = useSignal(false);
  const pos = getToolbarPosition(state.editor, state.range.value);
  useEffect(() => {
    if (state.editor) {
      return on(state.editor, 'focusin', () => {
        expanded.value = false;
      });
    }
  }, [state.editor]);
  if (!pos) {
    return null;
  }

  const hasBlockCapability = state.capabilities.value.some((x) =>
    x.capabilities.includes('block*'),
  );

  if (!hasBlockCapability) {
    return null;
  }

  const isInsideRichBlock = pos.container.tagName.toLowerCase() === 'rich-block';

  const toolbar = (
    <div
      class="absolute z-40 left-0 -translate-y-1/2 -translate-x-14"
      style={{ top: pos.top, left: pos.left }}
    >
      <Button
        class={`ring inline-flex items-center justify-center rounded-full size-10 bg-white text-gray-700 hover:opacity-100 hover:scale-110 transition-all ${expanded.value ? 'rotate-45' : 'opacity-75'}`}
        title="Insert..."
        onClick={() => {
          expanded.value = !expanded.value;
        }}
      >
        <IcoPlus class="size-4 stroke-2" />
      </Button>
      {expanded.value && (
        <nav class="absolute left-14 top-0 flex items-center gap-2 p-3 bg-gray-900 rounded-2xl an-fade-in-right text-white shadow-xl">
          <BlockButton
            icon={<IcoImage class="size-4 stroke-2" />}
            text="Image"
            onClick={async () => {
              const file = await pickFile('image/*');
              if (!file || !state.editor) {
                return;
              }
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              applyEdit(
                state.editor,
                new InputEvent('beforeinput', {
                  bubbles: true,
                  cancelable: true,
                  inputType: 'insertFromPaste',
                  dataTransfer,
                  data: null,
                }),
              );
            }}
          />
          <BlockButton
            icon={<span class="text-xs">- - -</span>}
            text="Divider"
            onClick={() => {
              state.editor && applyEdit(state.editor, 'insertHorizontalRule');
            }}
          />
          <BlockButton
            icon={<IcoRocketLaunch class="size-4 stroke-2" />}
            text="Button"
            onClick={() => {
              if (!state.editor) {
                return;
              }
              const html = createEmptyCta();
              const dataTransfer = new DataTransfer();
              dataTransfer.setData('text/html', html);
              applyEdit(
                state.editor,
                new InputEvent('beforeinput', {
                  bubbles: true,
                  cancelable: true,
                  inputType: 'insertFromPaste',
                  dataTransfer,
                  data: html,
                }),
              );
            }}
          />
          <BlockButton
            icon={<IcoRectangleGroup class="size-4 stroke-2" />}
            text="Block"
            onClick={() => {
              if (!state.editor) {
                return;
              }
              const html = createEmptyBlock();
              const dataTransfer = new DataTransfer();
              dataTransfer.setData('text/html', html);
              applyEdit(
                state.editor,
                new InputEvent('beforeinput', {
                  bubbles: true,
                  cancelable: true,
                  inputType: 'insertFromPaste',
                  dataTransfer,
                  data: html,
                }),
              );
            }}
          />
        </nav>
      )}
    </div>
  );

  if (isInsideRichBlock) {
    return createPortal(toolbar, pos.container);
  }

  return toolbar;
}
