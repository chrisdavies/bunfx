import { useEffect, useMemo } from 'preact/hooks';
import type { PreactEditorState } from './use-editor-signal';
import { useSignal } from '@preact/signals';
import type { ComponentChildren, SignalLike } from 'preact';
import { Button } from '../ui';
import { applyEdit } from '../editor';
import type { EditorExtension } from '../editor/extensions';
import { getExtensions } from '../editor/extensions';
import {
  IcoArrowLeft,
  IcoLink,
  IcoPaintBrush,
  IcoTextCenter,
  IcoTextLeft,
  IcoTextRight,
  IcoX,
} from '../icons';
import { getStartEl, toElement } from '../editor/utils';

type ToolbarMode = 'color' | 'link' | 'default';

export function SelectionContextToolbar({ state }: { state: PreactEditorState }) {
  const range = state.range.value;
  const show = useSignal(false);
  useEffect(() => {
    if (range?.collapsed) {
      return;
    }
    const timeout = setTimeout(() => {
      show.value = !!range && !range?.collapsed;
    }, 150);
    return () => clearTimeout(timeout);
  }, [range]);

  if (!show.value || range?.collapsed || !state.editor) {
    return null;
  }
  return <ContextToolbar state={state} />;
}

function ContextToolbar(props: { state: PreactEditorState }) {
  const range = props.state.range.value;
  const capabilities = props.state.capabilities.value;
  const mode = useSignal<ToolbarMode>('default');
  const { top, left } = useMemo(() => {
    const bounds = range?.getBoundingClientRect();
    const editor = props.state.editor;
    if (!bounds || !editor) {
      return { top: 0, left: 0 };
    }
    const editorBounds = editor.getBoundingClientRect();
    const editorTop = editorBounds.top - editor.offsetTop;
    const editorLeft = editorBounds.left - editor.offsetLeft;
    return {
      top: bounds.top - editorTop,
      left: bounds.left + bounds.width / 2 - editorLeft,
    };
  }, [range]);

  if (capabilities.length === 0) {
    return null;
  }

  return (
    <nav
      class="absolute z-20 top-0 left-0 bg-gray-900 text-white p-1 rounded-lg flex items-center -translate-x-1/2 -translate-y-full -mt-1 shadow-md max-w-screen overflow-auto"
      style={{ top: `${top}px`, left: `${left}px` }}
      ref={(el) => {
        if (!el) {
          return;
        }
        const bounds = el.getBoundingClientRect();
        if (bounds.left < 0) {
          el.style.left = `${left - bounds.left}px`;
        } else if (bounds.right > window.innerWidth) {
          el.style.left = `${left - (bounds.right - window.innerWidth)}px`;
        }
      }}
    >
      {mode.value === 'default' && <DefaultToolbar mode={mode} state={props.state} />}
      {mode.value === 'link' && <LinkToolbar mode={mode} state={props.state} />}
      {mode.value === 'color' && <ColorToolbar mode={mode} state={props.state} />}
    </nav>
  );
}

function BtnToolbar(props: {
  class?: string;
  title?: string;
  active?: boolean;
  children: ComponentChildren;
  onClick?(): void;
}) {
  return (
    <Button
      class={`inline-flex items-center justify-center size-8 rounded-md aspect-square hover:bg-gray-700/50 ${props.active ? 'text-teal-200' : ''} ${props.class}`}
      onClick={props.onClick}
      title={props.title}
    >
      {props.children}
    </Button>
  );
}

function getFormat(node: Node, formats: EditorExtension[]) {
  return (
    node instanceof Element &&
    formats.find((x) => {
      const selector = x.selector || x.tagName;
      return selector && node.matches(selector);
    })
  );
}

function elementsInRange(editor: HTMLElement, range?: Range): HTMLElement[] {
  if (!range || range.collapsed) {
    return [];
  }
  const exts = getExtensions(editor);
  const tags = ['h1', 'h2', 'a', 'blockquote', 'mark'];
  const formats = exts.filter(
    (x) => (x.tagName && tags.includes(x.tagName)) || x.capabilities.includes('format*'),
  );
  const startNode = range.startContainer.childNodes[range.startOffset] || range.startContainer;
  const endNode = range.endContainer.childNodes[range.endOffset] || range.endContainer;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  walker.currentNode = startNode;
  const result: Record<string, HTMLElement> = {};
  const addEl = (node: Node) => {
    if (node instanceof HTMLElement && !result[node.tagName]) {
      result[node.tagName] = node;
    }
  };
  while (walker.currentNode) {
    const curr = walker.currentNode;
    const fmt = getFormat(curr, formats);
    fmt && addEl(curr);
    if (curr === endNode) {
      break;
    }
    if (!walker.nextNode()) {
      break;
    }
  }
  let el: Node | null = startNode;
  while (el && el !== editor) {
    const fmt = getFormat(el, formats);
    fmt && addEl(el);
    el = el.parentElement;
  }
  return Object.values(result);
}

function ToolbarDivider() {
  return <span class="border-l border-gray-500 h-6 mx-2"></span>;
}

function LinkToolbar({ mode, state }: { mode: SignalLike<ToolbarMode>; state: PreactEditorState }) {
  const range = state.range.value;
  const editor = state.editor;
  const anchor = range && getStartEl(range)?.closest('a');
  const href = useSignal(anchor?.href || '');

  if (!editor) {
    return null;
  }

  return (
    <>
      <input
        class="text-inherit bg-transparent outline-none border-none ring-0"
        type="url"
        autoFocus
        placeholder="https://example.com"
        value={href}
        onInput={(e: any) => {
          href.value = e.target.value;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            applyEdit(editor, 'insertLink', href.value);
            mode.value = 'default';
          }
        }}
      />
      <BtnToolbar
        onClick={() => {
          applyEdit(editor, 'insertLink', '');
          mode.value = 'default';
        }}
      >
        <IcoX />
      </BtnToolbar>
    </>
  );
}

function MenuLabel(props: { children: ComponentChildren }) {
  return (
    <label class="flex items-center p-2 justify-between gap-4 cursor-pointer rounded-md dark:hover:bg-gray-700/50 hover:bg-gray-100 transition-all">
      {props.children}
    </label>
  );
}

function ColorMenuItem({
  name,
  value,
  onPick,
  children,
}: {
  name: string;
  value?: string;
  onPick(color: string): void;
  children?: ComponentChildren;
}) {
  return (
    <div class="flex gap-2">
      <div class="grow">
        <MenuLabel>
          {children && <span>{children}</span>}
          {!value && (
            <span class="rounded-md px-1 text-xs font-medium border" style={{ background: value }}>
              Default
            </span>
          )}
          {value && (
            <span
              class="size-6 rounded-full inline-block shrink-0 ring-1 ring-offset-2 ring-gray-300"
              style={{ background: value }}
            ></span>
          )}
          <input
            type="color"
            name={name}
            class="opacity-0 size-1 absolute top-0 left-0"
            value={value}
            onInput={(e: any) => onPick(e.target.value)}
          />
        </MenuLabel>
      </div>
      {value && (
        <MenuLabel>
          <Button onClick={() => onPick('')}>
            <IcoX />
          </Button>
        </MenuLabel>
      )}
    </div>
  );
}

function ColorToolbar({
  mode,
  state,
}: {
  mode: SignalLike<ToolbarMode>;
  state: PreactEditorState;
}) {
  const range = state.range.value;
  const editor = state.editor;

  if (!editor) {
    return null;
  }

  const mark = elementsInRange(editor, range).find((x) => x.matches('mark'));
  const bg = useSignal(mark?.style.background);
  const fg = useSignal(mark?.style.color);
  return (
    <div class="dark w-56">
      <ColorMenuItem
        name="background"
        value={bg.value}
        onPick={(color) => {
          applyEdit(editor, 'formatBackColor', color);
          bg.value = color;
        }}
      >
        Background
      </ColorMenuItem>
      <ColorMenuItem
        name="color"
        value={fg.value}
        onPick={(color) => {
          applyEdit(editor, 'formatFontColor', color);
          fg.value = color;
        }}
      >
        Text
      </ColorMenuItem>
      <MenuLabel>
        <span class="flex items-center gap-2">
          <IcoArrowLeft strokeWidth="2" />
          Back
        </span>
        <input
          type="button"
          class="hidden"
          onClick={() => {
            mode.value = 'default';
          }}
        />
      </MenuLabel>
    </div>
  );
}

function DefaultToolbar({
  mode,
  state,
}: {
  mode: SignalLike<ToolbarMode>;
  state: PreactEditorState;
}) {
  const range = state.range.value;
  const editor = state.editor;
  const capabilities = state.capabilities.value;

  if (!editor) {
    return null;
  }

  const formats = elementsInRange(editor, range);
  const hasExt = (name: string) => capabilities.some((x) => x.name === name);

  const hasBold = hasExt('formatBold');
  const hasItalic = hasExt('formatItalic');
  const hasUnderline = hasExt('formatUnderline');
  const hasStrike = hasExt('formatStrikeThrough');
  const hasLink = hasExt('hyperlinks');
  const hasColor = hasExt('mark');
  const hasAlign = hasExt('textAlign');
  const hasH1 = hasExt('h1');
  const hasH2 = hasExt('h2');
  const hasH3 = hasExt('h3');
  const hasBlockquote = hasExt('blockquote');

  const inlineButtons = (
    <>
      {hasBold && (
        <BtnToolbar
          title="Bold"
          onClick={() => applyEdit(editor, 'formatBold')}
          active={formats.some((x) => x.matches('b,strong'))}
        >
          <strong>B</strong>
        </BtnToolbar>
      )}
      {hasItalic && (
        <BtnToolbar
          title="Italic"
          onClick={() => applyEdit(editor, 'formatItalic')}
          active={formats.some((x) => x.matches('i,em'))}
        >
          <em>I</em>
        </BtnToolbar>
      )}
      {hasUnderline && (
        <BtnToolbar
          title="Underline"
          onClick={() => applyEdit(editor, 'formatUnderline')}
          active={formats.some((x) => x.matches('u'))}
        >
          <u>U</u>
        </BtnToolbar>
      )}
      {hasStrike && (
        <BtnToolbar
          title="Strike through"
          onClick={() => applyEdit(editor, 'formatStrikeThrough')}
          active={formats.some((x) => x.matches('s'))}
        >
          <s>S</s>
        </BtnToolbar>
      )}
    </>
  );

  const linkButton = hasLink && (
    <BtnToolbar
      title="Link"
      active={formats.some((x) => x.matches('a'))}
      onClick={() => {
        mode.value = 'link';
      }}
    >
      <IcoLink class="size-4" />
    </BtnToolbar>
  );

  const colorButton = hasColor && (
    <BtnToolbar
      title="Highlight / Color"
      active={formats.some((x) => x.matches('mark'))}
      onClick={() => {
        mode.value = 'color';
      }}
    >
      <IcoPaintBrush class="size-4" />
    </BtnToolbar>
  );

  const textAlignButton = hasAlign && <BtnTextAlign state={state} />;

  const blockButtons = (
    <>
      {hasH1 && (
        <BtnToolbar
          class="font-semibold text-xl"
          title="Page title"
          active={formats.some((x) => x.matches('h1'))}
          onClick={() => {
            applyEdit(editor, 'formatBlock', 'h1');
          }}
        >
          T
        </BtnToolbar>
      )}
      {hasH2 && (
        <BtnToolbar
          class="font-semibold text-sm"
          title="Title"
          active={formats.some((x) => x.matches('h2'))}
          onClick={() => {
            applyEdit(editor, 'formatBlock', 'h2');
          }}
        >
          T
        </BtnToolbar>
      )}
      {hasH3 && (
        <BtnToolbar
          class="font-semibold text-sm"
          title="Subtitle"
          active={formats.some((x) => x.matches('h3'))}
          onClick={() => {
            applyEdit(editor, 'formatBlock', 'h3');
          }}
        >
          t
        </BtnToolbar>
      )}
      {hasBlockquote && (
        <BtnToolbar
          class="font-semibold text-2xl leading-0 font-serif"
          title="Blockquote"
          active={formats.some((x) => x.matches('blockquote'))}
          onClick={() => {
            applyEdit(editor, 'formatBlock', 'blockquote');
          }}
        >
          <span class="relative -mb-2">"</span>
        </BtnToolbar>
      )}
    </>
  );

  const hasAnyInline = hasBold || hasItalic || hasUnderline || hasStrike;
  const hasAnyFormatting = linkButton || colorButton || textAlignButton;
  const hasAnyBlock = hasH1 || hasH2 || hasH3 || hasBlockquote;

  if (!hasAnyInline && !hasAnyFormatting && !hasAnyBlock) {
    return null;
  }

  return (
    <>
      {inlineButtons}
      {hasAnyInline && hasAnyFormatting && <ToolbarDivider />}
      {linkButton}
      {colorButton}
      {textAlignButton}
      {(hasAnyInline || hasAnyFormatting) && hasAnyBlock && <ToolbarDivider />}
      {blockButtons}
    </>
  );
}

function BtnTextAlign({ state }: { state: PreactEditorState }) {
  const range = state.range.value;
  const editor = state.editor;

  if (!editor) {
    return null;
  }

  const ancestor = range?.commonAncestorContainer && toElement(range?.commonAncestorContainer);
  const textAlign = getComputedStyle(ancestor instanceof Element ? ancestor : editor).textAlign;
  const nextAlign: Record<string, string> = {
    right: 'formatJustifyLeft',
    end: 'formatJustifyLeft',
    start: 'formatJustifyCenter',
    left: 'formatJustifyCenter',
    center: 'formatJustifyRight',
  };

  return (
    <BtnToolbar
      class="font-semibold text-xl"
      title="Text align"
      onClick={() => {
        const inputType = nextAlign[textAlign] || 'formatJustifyLeft';
        applyEdit(editor, inputType);
      }}
    >
      {(textAlign === 'left' || textAlign === 'start') && <IcoTextLeft class="size-4" />}
      {textAlign === 'center' && <IcoTextCenter class="size-4" />}
      {(textAlign === 'right' || textAlign === 'end') && <IcoTextRight class="size-4" />}
    </BtnToolbar>
  );
}
