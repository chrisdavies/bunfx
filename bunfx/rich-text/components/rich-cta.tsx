import { render } from 'preact';
import { Signal, effect, signal } from '@preact/signals';
import type { EditorExtension } from '../editor/extensions';
import { getExtensions } from '../editor/extensions';
import { deleteBlock, findEditor, insertBlockFromHTML } from '../editor/utils';
import { handleParagraphAsLineBreak } from '../editor/core';
import { serializeChildren } from '../editor/serialization';
import type { MenuChoice } from './editor-menu';
import {
  MenuItem,
  EditorMenu,
  MenuSection,
  MenuDivider,
  MenuDelete,
  MenuRadioSet,
  ColorMenuItem,
} from './editor-menu';
import { IcoTextCenter, IcoTextLeft, IcoTextRight } from '../icons';
import { setCSSVar } from '../theme';

type RichCtaState = {
  href?: string;
  linkBg?: string;
  linkFg?: string;
  linkPadding?: string;
  linkRounding?: string;
  linkTextAlign?: string;
  blockPadding?: string;
  blockAlignment?: string;
  linkText?: string;
};

type ValueChoice = MenuChoice & {
  cssValue: string;
};

const linkPaddingOpts: ValueChoice[] = [
  { value: 'sm', label: <span>SM</span>, cssValue: '0.5rem 1rem' },
  { value: 'md', isDefault: true, label: <span>MD</span>, cssValue: '0.75rem 1.5rem' },
  { value: 'lg', label: <span>LG</span>, cssValue: '1rem 2rem' },
];

const linkRoundingOpts: ValueChoice[] = [
  { value: 'none', label: <span>None</span>, cssValue: '0px' },
  { value: 'sm', label: <span>SM</span>, cssValue: '0.25rem' },
  { value: 'md', isDefault: true, label: <span>MD</span>, cssValue: '0.5rem' },
  { value: 'lg', label: <span>LG</span>, cssValue: '1rem' },
  { value: 'full', label: <span>Full</span>, cssValue: '9999px' },
];

const blockPaddingOpts: ValueChoice[] = [
  { value: 'none', label: <span>None</span>, cssValue: '0px' },
  { value: 'sm', label: <span>SM</span>, cssValue: '1rem' },
  { value: 'md', isDefault: true, label: <span>MD</span>, cssValue: '2rem' },
  { value: 'lg', label: <span>LG</span>, cssValue: '3rem' },
];

const blockAlignmentOpts: ValueChoice[] = [
  { value: 'left', label: <span>Left</span>, cssValue: 'left' },
  { value: 'center', isDefault: true, label: <span>Center</span>, cssValue: 'center' },
  { value: 'right', label: <span>Right</span>, cssValue: 'right' },
];

const linkTextAlignOpts: ValueChoice[] = [
  { value: 'left', label: <IcoTextLeft />, cssValue: 'left' },
  { value: 'center', isDefault: true, label: <IcoTextCenter />, cssValue: 'center' },
  { value: 'right', label: <IcoTextRight />, cssValue: 'right' },
];

function findOptByValue<T extends ValueChoice>(opts: T[], value: string | undefined): T {
  return opts.find((opt) => opt.value === value) || opts.find((opt) => opt.isDefault)!;
}

function findOptByCssValue<T extends ValueChoice>(opts: T[], cssValue: string | undefined): T {
  return opts.find((opt) => opt.cssValue === cssValue) || opts.find((opt) => opt.isDefault)!;
}

function deriveState(el: RichCta): RichCtaState {
  const link = el.querySelector('a') as HTMLAnchorElement;
  if (!link) {
    return { linkText: 'Click here' };
  }

  const style = getComputedStyle(el);

  const linkBg = style.getPropertyValue('--theme-cta-bg').trim() || undefined;
  const linkFg = style.getPropertyValue('--theme-cta-fg').trim() || undefined;
  const linkPaddingCss = style.getPropertyValue('--theme-cta-padding').trim();
  const linkRoundingCss = style.getPropertyValue('--theme-cta-rounding').trim();
  const linkTextAlignCss = style.getPropertyValue('--theme-cta-text-align').trim();
  const blockPaddingCss = style.getPropertyValue('--theme-cta-block-padding').trim();
  const blockAlignmentCss = style.getPropertyValue('--theme-cta-block-align').trim();

  return {
    href: link.getAttribute('href') || '',
    linkBg,
    linkFg,
    linkPadding: findOptByCssValue(linkPaddingOpts, linkPaddingCss).value,
    linkRounding: findOptByCssValue(linkRoundingOpts, linkRoundingCss).value,
    linkTextAlign: findOptByCssValue(linkTextAlignOpts, linkTextAlignCss).value,
    blockPadding: findOptByCssValue(blockPaddingOpts, blockPaddingCss).value,
    blockAlignment: findOptByCssValue(blockAlignmentOpts, blockAlignmentCss).value,
    linkText: link.textContent || '',
  };
}

function writeCssVars(el: HTMLElement, state: RichCtaState) {
  setCSSVar(el, '--theme-cta-bg', state.linkBg);
  setCSSVar(el, '--theme-cta-fg', state.linkFg);
  setCSSVar(el, '--theme-cta-padding', findOptByValue(linkPaddingOpts, state.linkPadding).cssValue);
  setCSSVar(
    el,
    '--theme-cta-rounding',
    findOptByValue(linkRoundingOpts, state.linkRounding).cssValue,
  );
  setCSSVar(
    el,
    '--theme-cta-text-align',
    findOptByValue(linkTextAlignOpts, state.linkTextAlign).cssValue,
  );
  setCSSVar(
    el,
    '--theme-cta-block-padding',
    findOptByValue(blockPaddingOpts, state.blockPadding).cssValue,
  );
  setCSSVar(
    el,
    '--theme-cta-block-align',
    findOptByValue(blockAlignmentOpts, state.blockAlignment).cssValue,
  );
}

function linkStyle() {
  return {
    backgroundColor: 'var(--theme-cta-bg, #3b82f6)',
    color: 'var(--theme-cta-fg, #ffffff)',
    padding: 'var(--theme-cta-padding, 0.75rem 1.5rem)',
    borderRadius: 'var(--theme-cta-rounding, 0.5rem)',
    textAlign: 'var(--theme-cta-text-align, center)',
  };
}

function blockStyle() {
  return {
    paddingTop: 'var(--theme-cta-block-padding, 2rem)',
    paddingBottom: 'var(--theme-cta-block-padding, 2rem)',
    textAlign: 'var(--theme-cta-block-align, center)',
  };
}

function applyStyles(cta: RichCta) {
  const state = cta.state.value;
  const style = blockStyle();
  cta.style.paddingTop = style.paddingTop;
  cta.style.paddingBottom = style.paddingBottom;
  cta.style.textAlign = style.textAlign;
  writeCssVars(cta, state);
}

export class RichCta extends HTMLElement {
  state: Signal<RichCtaState>;
  ondisconnect: Array<() => void> = [];

  constructor(state?: RichCtaState) {
    super();
    this.state = signal(state || { linkText: 'Click here' });
  }

  connectedCallback() {
    const editor = findEditor(this);

    const existingLink = this.querySelector('a');
    const initialContent = existingLink?.innerHTML || '';
    if (existingLink && !this.state.value.linkText) {
      this.state.value = deriveState(this);
    }

    this.ondisconnect.push(
      effect(() => {
        applyStyles(this);
      }),
    );

    if (!editor) {
      return;
    }

    this.contentEditable = 'false';
    this.className = 'focus-within:ring-2 ring-offset-2 ring-indigo-600 group/cta';
    this.tabIndex = -1;

    render(
      <EditableRichCta
        state={this.state}
        initialContent={initialContent}
        onDelete={() => deleteBlock(this)}
        editor={editor}
      />,
      this,
    );
  }

  disconnectedCallback() {
    render(null, this);
    this.ondisconnect.forEach((f) => f());
    this.ondisconnect.length = 0;
  }

  serialize() {
    const state = { ...this.state.value };
    const el = new RichCta(state);
    applyStyles(el);
    const link = this.querySelector('a');
    const linkContent = serializeChildren(link);
    render(<ReadonlyRichCta state={el.state} linkContent={linkContent} />, el);
    const html = el.outerHTML;
    render(null, el);
    return html;
  }
}

customElements.define('rich-cta', RichCta);

export function createEmptyHTML(): string {
  const state = {
    href: '',
    linkBg: '',
    linkFg: '',
    linkPadding: 'md',
    linkRounding: 'md',
    linkTextAlign: 'center',
    blockPadding: 'md',
    blockAlignment: 'center',
    linkText: 'Click here',
  };
  const el = new RichCta(state);
  applyStyles(el);
  render(<ReadonlyRichCta state={el.state} linkContent="Click here" />, el);
  const html = el.outerHTML;
  render(null, el);
  return html;
}

function CtaSettings(props: { state: Signal<RichCtaState>; onDelete(): void }) {
  const state = props.state.value;
  return (
    <EditorMenu
      render={() => (
        <>
          <MenuSection title="Link settings">
            <MenuItem title="URL">
              <input
                type="text"
                class="text-sm w-48 px-2 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={state.href || ''}
                placeholder="https://example.com"
                onInput={(e) => {
                  props.state.value = {
                    ...props.state.value,
                    href: (e.target as HTMLInputElement).value,
                  };
                }}
              />
            </MenuItem>
            <ColorMenuItem
              name="linkBg"
              value={state.linkBg}
              onPick={(linkBg) => {
                props.state.value = { ...props.state.value, linkBg };
              }}
            >
              Background
            </ColorMenuItem>
            <ColorMenuItem
              name="linkFg"
              value={state.linkFg}
              onPick={(linkFg) => {
                props.state.value = { ...props.state.value, linkFg };
              }}
            >
              Text
            </ColorMenuItem>
            <MenuItem title="Padding">
              <MenuRadioSet
                name="linkPadding"
                value={state.linkPadding}
                onClick={(linkPadding) => {
                  props.state.value = { ...props.state.value, linkPadding };
                }}
                choices={linkPaddingOpts}
              />
            </MenuItem>
            <MenuItem title="Rounding">
              <MenuRadioSet
                name="linkRounding"
                value={state.linkRounding}
                onClick={(linkRounding) => {
                  props.state.value = { ...props.state.value, linkRounding };
                }}
                choices={linkRoundingOpts}
              />
            </MenuItem>
            <MenuItem title="Text align">
              <MenuRadioSet
                name="linkTextAlign"
                value={state.linkTextAlign}
                onClick={(linkTextAlign) => {
                  props.state.value = { ...props.state.value, linkTextAlign };
                }}
                choices={linkTextAlignOpts}
              />
            </MenuItem>
          </MenuSection>
          <MenuDivider />
          <MenuSection title="Block settings">
            <MenuItem title="Spacing">
              <MenuRadioSet
                name="blockPadding"
                value={state.blockPadding}
                onClick={(blockPadding) => {
                  props.state.value = { ...props.state.value, blockPadding };
                }}
                choices={blockPaddingOpts}
              />
            </MenuItem>
            <MenuItem title="Alignment">
              <MenuRadioSet
                name="blockAlignment"
                value={state.blockAlignment}
                onClick={(blockAlignment) => {
                  props.state.value = { ...props.state.value, blockAlignment };
                }}
                choices={blockAlignmentOpts}
              />
            </MenuItem>
          </MenuSection>
          <MenuDivider />
          <MenuDelete title="Delete call to action" onDelete={props.onDelete} />
        </>
      )}
    />
  );
}

function EditableRichCta(props: {
  state: Signal<RichCtaState>;
  initialContent: string;
  onDelete(): void;
  editor: HTMLElement;
}) {
  const state = props.state.value;
  return (
    <>
      <editor-ui class="opacity-0 transition-all group-hover/cta:opacity-100 group-focus-within/cta:opacity-100">
        <CtaSettings {...props} />
      </editor-ui>
      <a
        contentEditable
        class="cursor-pointer"
        href={state.href || '#'}
        style={linkStyle()}
        onClick={(e) => e.preventDefault()}
        ref={(el: any) => {
          if (!el || el.capabilities) {
            return;
          }
          const exts = getExtensions(props.editor);
          el.capabilities = exts.filter((x) => {
            return (
              (x.capabilities.includes('inline*') || x.name === 'br') && x.name !== 'hyperlinks'
            );
          });
        }}
        dangerouslySetInnerHTML={{ __html: props.initialContent || 'Click here' }}
      />
    </>
  );
}

function ReadonlyRichCta(props: { state: Signal<RichCtaState>; linkContent: string }) {
  const state = props.state.value;
  return (
    <a
      href={state.href || '#'}
      style={linkStyle()}
      dangerouslySetInnerHTML={{ __html: props.linkContent }}
    />
  );
}

export const extRichCta: EditorExtension = {
  name: 'rich-cta',
  tagName: 'rich-cta',
  capabilities: ['block*'],
  onbeforeinput(e, editor) {
    if (handleParagraphAsLineBreak(e, editor, 'rich-cta a')) {
      return true;
    }
    return insertBlockFromHTML(e, editor, 'rich-cta');
  },
};
