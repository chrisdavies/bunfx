/**
 * Web component for rendering images in the editor.
 */

import { effect, type Signal, signal } from "@preact/signals";
import { render } from "preact";
import { getEditorConfig } from "../editor/config";
import { handleParagraphAsLineBreak } from "../editor/core";
import type { EditorExtension } from "../editor/extensions";
import { getExtensions } from "../editor/extensions";
import { serializeChildren } from "../editor/serialization";
import {
  deleteBlock,
  findEditableScope,
  findEditor,
  findRootAncestor,
  getRange,
  getStartEl,
  isEmpty,
  split,
} from "../editor/utils";
import { IcoTextCenter, IcoTextLeft, IcoTextRight } from "../icons";
import {
  EditorMenu,
  MenuDelete,
  MenuDivider,
  MenuItem,
  MenuRadioSet,
  MenuSection,
} from "./editor-menu";
import { EditorPlaceholder } from "./editor-ui";
import { addUpload, makeUpload } from "./upload";

type RichImgState = {
  src?: string;
  alt?: string;
  float?: string;
  aspectRatio?: string;
  textAlign?: string;
  width?: string;
  caption?: string;
};

function deriveState(el: HTMLElement): RichImgState {
  const figcaption = el.querySelector("figcaption");
  const img = el.querySelector("img");
  return {
    src: img?.getAttribute("src") || "",
    alt: img?.getAttribute("alt") ?? undefined,
    float: el.style.float || "",
    aspectRatio: img?.style.aspectRatio || "",
    textAlign: figcaption?.style.textAlign || "",
    width: el.style.width || "",
    caption: figcaption?.innerHTML || "",
  };
}

function applyInlineStyles(richimg: RichImg) {
  const state = richimg.state.value;
  richimg.style.float = state.float === "center" ? "" : state.float || "";
  richimg.style.width = state.width || "";
  richimg.style.marginLeft =
    state.float === "right" ? "1.5rem" : state.float !== "left" ? "auto" : "";
  richimg.style.marginRight =
    state.float === "left" ? "1.5rem" : state.float !== "right" ? "auto" : "";
  richimg.style.zIndex = state.float ? "10" : "";
}

export class RichImg extends HTMLElement {
  state: Signal<RichImgState>;
  ondisconnect: Array<() => void> = [];

  constructor(state?: RichImgState) {
    super();
    this.state = signal(state || {});
  }

  connectedCallback() {
    const editor = findEditor(this);
    if (!editor) {
      return;
    }

    if (this.querySelector("img") && !this.state.value.src) {
      this.state.value = deriveState(this);
    }

    this.contentEditable = "false";
    this.className =
      "focus-within:ring-2 ring-offset-2 ring-indigo-600 group/fig";
    this.tabIndex = -1;
    this.ondisconnect.push(
      effect(() => {
        applyInlineStyles(this);
      }),
    );

    render(
      <EditableRichImg
        state={this.state}
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
    state.caption = serializeChildren(this.querySelector("figcaption"));
    const el = new RichImg(state);
    applyInlineStyles(el);
    render(<ReadonlyRichImg state={el.state} />, el);
    const html = el.outerHTML;
    render(null, el);
    return html;
  }
}

customElements.define("rich-img", RichImg);

function ImgSettings(props: { state: Signal<RichImgState>; onDelete(): void }) {
  const state = props.state.value;
  return (
    <EditorMenu
      render={() => (
        <>
          <MenuSection title="Image layout">
            <MenuItem title="Align">
              <MenuRadioSet
                name="float"
                value={state.float}
                onClick={(float) => {
                  props.state.value = { ...props.state.value, float };
                }}
                choices={[
                  { value: "left", label: <span>Left</span> },
                  {
                    value: "center",
                    isDefault: true,
                    label: <span>Center</span>,
                  },
                  { value: "right", label: <span>Right</span> },
                ]}
              />
            </MenuItem>
            <MenuItem title="Width">
              <MenuRadioSet
                name="width"
                value={state.width}
                onClick={(width) => {
                  props.state.value = { ...props.state.value, width };
                }}
                choices={[
                  { value: "25%", label: <span>25%</span> },
                  { value: "50%", label: <span>50%</span> },
                  { value: "100%", isDefault: true, label: <span>100%</span> },
                ]}
              />
            </MenuItem>
          </MenuSection>
          <MenuDivider />
          <MenuItem title="Caption">
            <MenuRadioSet
              name="textAlign"
              value={state.textAlign}
              onClick={(textAlign) => {
                props.state.value = { ...props.state.value, textAlign };
              }}
              choices={[
                { value: "left", label: <IcoTextLeft /> },
                { value: "center", isDefault: true, label: <IcoTextCenter /> },
                { value: "right", label: <IcoTextRight /> },
              ]}
            />
          </MenuItem>
          <MenuDivider />
          <MenuDelete title="Delete image" onDelete={props.onDelete} />
        </>
      )}
    />
  );
}

function EditableRichImg(props: {
  state: Signal<RichImgState>;
  onDelete(): void;
  editor: HTMLElement;
}) {
  const state = props.state.value;
  return (
    <figure>
      <img
        draggable={false}
        src={state.src}
        alt={state.alt}
        style={{
          aspectRatio: state.aspectRatio,
        }}
      />
      <figcaption
        contentEditable
        class="empty:hidden group-focus-within/fig:empty:block"
        aria-placeholder="Type a caption..."
        ref={(el: any) => {
          if (!el || el.capabilities) {
            return;
          }
          const exts = getExtensions(props.editor);
          el.capabilities = exts.filter((x) => {
            return x.capabilities.includes("inline*") || x.name === "br";
          });
        }}
        style={{
          textAlign: state.textAlign,
        }}
        dangerouslySetInnerHTML={{ __html: state.caption || "" }}
      ></figcaption>
      <editor-ui class="opacity-0 transition-all group-hover/fig:opacity-100 group-focus-within/fig:opacity-100">
        <ImgSettings {...props} />
      </editor-ui>
    </figure>
  );
}

function ReadonlyRichImg(props: { state: Signal<RichImgState> }) {
  const state = props.state.value;
  return (
    <figure>
      <img
        src={state.src}
        alt={state.alt}
        style={{
          aspectRatio: state.aspectRatio,
        }}
      />
      {state.caption && (
        <figcaption
          style={{
            textAlign: state.textAlign,
          }}
          dangerouslySetInnerHTML={{ __html: state.caption || "" }}
        ></figcaption>
      )}
    </figure>
  );
}

export const extRichImg: EditorExtension = {
  name: "rich-img",
  tagName: "rich-img",
  capabilities: ["block*"],
  onbeforeinput(e, editor) {
    if (handleParagraphAsLineBreak(e, editor, "figcaption")) {
      return true;
    }

    if (e.inputType !== "insertFromPaste" && e.inputType !== "insertFromDrop") {
      return;
    }
    const file = e.dataTransfer?.files[0];
    if (!file?.type.startsWith("image/")) {
      return;
    }
    const config = getEditorConfig(editor);
    if (!config?.uploader) {
      return;
    }
    const rng = getRange(editor);
    if (!rng) {
      return;
    }
    const startEl = getStartEl(rng);
    const scope = findEditableScope(startEl, editor);
    if (!scope) {
      return;
    }
    const ancestor = findRootAncestor(scope, startEl);
    const upload = addUpload(
      editor,
      makeUpload(file, config.uploader, async (uploadEl, u) => {
        const placeholder = uploadEl.closest("editor-placeholder");
        if (!u.url || !placeholder) {
          return;
        }
        const src = u.url;
        const img = new Image();
        await new Promise<HTMLImageElement>((ok, fail) => {
          img.onload = () => ok(img);
          img.onerror = fail;
          img.src = src;
        });
        placeholder.replaceWith(
          new RichImg({
            src,
            aspectRatio: `${img.width / img.height}`,
          }),
        );
      }),
    );

    const placeholder = new EditorPlaceholder();
    placeholder.innerHTML = `<file-upload uploadid="${upload.peek().id}"></file-upload>`;

    if (ancestor instanceof Element && isEmpty(ancestor)) {
      ancestor.replaceWith(placeholder);
    } else if (ancestor instanceof Element) {
      split(rng, ancestor.tagName);
      rng.insertNode(placeholder);
    } else {
      scope.insertBefore(placeholder, ancestor?.nextSibling || null);
    }

    return true;
  },
};
