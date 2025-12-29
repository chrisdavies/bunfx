/**
 * Web component for rendering styled content blocks in the editor.
 */

import { effect, type Signal, signal } from "@preact/signals";
import { render } from "preact";
import { getEditorConfig } from "../editor/config";
import type { EditorExtension } from "../editor/extensions";
import { serializeChildren } from "../editor/serialization";
import { deleteBlock, findEditor, insertBlockFromHTML } from "../editor/utils";
import { IcoDotsHorizontal } from "../icons";
import { setCSSVar } from "../theme";
import { Toggle } from "../ui";
import type { MenuChoice } from "./editor-menu";
import {
  ColorMenuItem,
  EditorMenu,
  MenuDelete,
  MenuDivider,
  MenuItem,
  MenuLabel,
  MenuRadioSet,
  MenuSection,
} from "./editor-menu";

export type FilePickerResult = {
  url: string;
};

export type FilePicker = (opts?: {
  accept?: string;
}) => Promise<FilePickerResult | undefined>;

type RichBlockState = {
  bg?: string;
  fg?: string;
  overlay?: string;
  showOverlay?: boolean;
  columns?: string;
  fullBleed?: boolean;
};

type ValueChoice = MenuChoice & {
  cssValue: string;
};

const columnsOpts: ValueChoice[] = [
  { value: "1", isDefault: true, label: <span>One</span>, cssValue: "1" },
  { value: "2", label: <span>Two</span>, cssValue: "2" },
];

function findOptByValue<T extends ValueChoice>(
  opts: T[],
  value: string | undefined,
): T {
  return (
    opts.find((opt) => opt.value === value) ||
    opts.find((opt) => opt.isDefault)!
  );
}

function findOptByCssValue<T extends ValueChoice>(
  opts: T[],
  cssValue: string | undefined,
): T {
  return (
    opts.find((opt) => opt.cssValue === cssValue) ||
    opts.find((opt) => opt.isDefault)!
  );
}

function deriveState(el: HTMLElement): RichBlockState {
  const overlay = el.getAttribute("data-overlay") || "";

  const style = getComputedStyle(el);
  const bg =
    style.getPropertyValue("--theme-rich-block-bg").trim() || undefined;
  const fg =
    style.getPropertyValue("--theme-rich-block-fg").trim() || undefined;
  const columnsCss = style
    .getPropertyValue("--theme-rich-block-columns")
    .trim();
  const fullBleedCss = style
    .getPropertyValue("--theme-rich-block-fullbleed")
    .trim();
  const showOverlayCss = style
    .getPropertyValue("--theme-rich-block-show-overlay")
    .trim();

  return {
    bg,
    fg,
    overlay,
    showOverlay: showOverlayCss === "1" || (showOverlayCss === "" && !!overlay),
    columns: findOptByCssValue(columnsOpts, columnsCss).value,
    fullBleed: fullBleedCss === "1",
  };
}

function writeCssVars(el: HTMLElement, state: RichBlockState) {
  setCSSVar(el, "--theme-rich-block-bg", state.bg);
  setCSSVar(el, "--theme-rich-block-fg", state.fg);
  setCSSVar(
    el,
    "--theme-rich-block-columns",
    findOptByValue(columnsOpts, state.columns).cssValue,
  );
  setCSSVar(
    el,
    "--theme-rich-block-fullbleed",
    state.fullBleed ? "1" : undefined,
  );
  setCSSVar(
    el,
    "--theme-rich-block-show-overlay",
    state.showOverlay ? "1" : undefined,
  );
}

function blockStyle() {
  return {
    backgroundColor: "var(--theme-rich-block-bg, #f3f4f6)",
    color: "var(--theme-rich-block-fg, #111827)",
  };
}

function articleStyle() {
  return {
    columns: "var(--theme-rich-block-columns, 1)",
  };
}

function applyStyles(block: RichBlock) {
  const state = block.state.value;
  const style = blockStyle();

  block.style.backgroundColor = style.backgroundColor;
  block.style.color = style.color;
  writeCssVars(block, state);

  if (state.overlay) {
    block.setAttribute("data-overlay", state.overlay);
  } else {
    block.removeAttribute("data-overlay");
  }

  if (state.showOverlay && state.overlay) {
    block.style.backgroundImage = `url("${state.overlay}")`;
    block.style.backgroundSize = "cover";
    block.style.backgroundPosition = "center";
  } else {
    block.style.backgroundImage = "";
  }

  if (state.fullBleed) {
    block.setAttribute("data-fullbleed", "true");
  } else {
    block.removeAttribute("data-fullbleed");
  }
}

export class RichBlock extends HTMLElement {
  state: Signal<RichBlockState>;
  ondisconnect: Array<() => void> = [];

  constructor(state?: RichBlockState) {
    super();
    this.state = signal(state || {});
  }

  connectedCallback() {
    const editor = findEditor(this);
    const config = getEditorConfig(editor);
    const filepicker = config?.filepicker;

    const existingContent = this.querySelector("article")?.innerHTML || "";
    if (
      this.querySelector("article") &&
      this.state.value.columns === undefined
    ) {
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

    this.contentEditable = "false";
    this.className =
      "focus-within:ring-2 ring-offset-2 ring-indigo-600 group/block";
    this.tabIndex = -1;

    render(
      <EditableRichBlock
        state={this.state}
        initialContent={existingContent}
        onDelete={() => deleteBlock(this)}
        filepicker={filepicker}
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
    const el = new RichBlock(state);
    applyStyles(el);
    const article = this.querySelector("article");
    render(
      <article
        style={articleStyle()}
        dangerouslySetInnerHTML={{ __html: serializeChildren(article) }}
      ></article>,
      el,
    );
    const html = el.outerHTML;
    render(null, el);
    return html;
  }
}

customElements.define("rich-block", RichBlock);

export function createEmptyHTML(): string {
  const state: RichBlockState = {
    bg: undefined,
    fg: undefined,
    columns: "1",
    fullBleed: true,
  };
  const el = new RichBlock(state);
  applyStyles(el);
  render(
    <article style={articleStyle()}>
      <p>
        <br />
      </p>
    </article>,
    el,
  );
  const html = el.outerHTML;
  render(null, el);
  return html;
}

function BlockSettings(props: {
  state: Signal<RichBlockState>;
  onDelete(): void;
  filepicker?: FilePicker;
}) {
  const state = props.state.value;
  return (
    <EditorMenu
      render={() => (
        <>
          <MenuSection title="Color">
            <ColorMenuItem
              name="bg"
              value={state.bg}
              onPick={(bg) => {
                props.state.value = { ...props.state.value, bg };
              }}
            >
              Background
            </ColorMenuItem>
            <ColorMenuItem
              name="fg"
              value={state.fg}
              onPick={(fg) => {
                props.state.value = { ...props.state.value, fg };
              }}
            >
              Text
            </ColorMenuItem>
          </MenuSection>
          <MenuDivider />
          {props.filepicker && (
            <>
              <MenuSection title="Overlay">
                <MenuLabel>
                  <span>Show overlay</span>
                  <Toggle
                    checked={state.showOverlay}
                    onClick={() => {
                      props.state.value = {
                        ...props.state.value,
                        showOverlay: !state.showOverlay,
                      };
                    }}
                  />
                </MenuLabel>
                <MenuLabel>
                  <span>Image</span>
                  <span class="border rounded-md px-2 p-1 inline-flex items-center gap-2 bg-white">
                    {state.overlay && (
                      <span class="text-xs font-medium text-gray-500">
                        {state.overlay.slice(-3)}
                      </span>
                    )}
                    <input
                      type="button"
                      class="hidden"
                      onClick={async () => {
                        const result = await props.filepicker?.({
                          accept: "image/*",
                        });
                        if (result?.url) {
                          props.state.value = {
                            ...props.state.value,
                            overlay: result.url,
                          };
                        }
                      }}
                    />
                    <IcoDotsHorizontal />
                  </span>
                </MenuLabel>
              </MenuSection>
              <MenuDivider />
            </>
          )}
          <MenuSection title="Layout">
            <MenuItem title="Columns">
              <MenuRadioSet
                name="columns"
                value={state.columns || "1"}
                onClick={(columns) => {
                  props.state.value = { ...props.state.value, columns };
                }}
                choices={columnsOpts}
              />
            </MenuItem>
            <MenuLabel>
              <span>Full bleed</span>
              <Toggle
                checked={state.fullBleed}
                onClick={() => {
                  props.state.value = {
                    ...props.state.value,
                    fullBleed: !state.fullBleed,
                  };
                }}
              />
            </MenuLabel>
          </MenuSection>
          <MenuDivider />
          <MenuDelete title="Delete block" onDelete={props.onDelete} />
        </>
      )}
    />
  );
}

function EditableRichBlock(props: {
  state: Signal<RichBlockState>;
  initialContent: string;
  onDelete(): void;
  filepicker?: FilePicker;
}) {
  return (
    <>
      <editor-ui class="opacity-0 transition-all group-hover/block:opacity-100 group-focus-within/block:opacity-100">
        <BlockSettings
          state={props.state}
          onDelete={props.onDelete}
          filepicker={props.filepicker}
        />
      </editor-ui>
      <article
        contentEditable
        style={articleStyle()}
        dangerouslySetInnerHTML={{ __html: props.initialContent }}
      ></article>
    </>
  );
}

export const extRichBlock: EditorExtension = {
  name: "rich-block",
  tagName: "rich-block",
  capabilities: ["block*"],
  onbeforeinput(e, editor) {
    return insertBlockFromHTML(e, editor, "rich-block");
  },
};
