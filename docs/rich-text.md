# Rich Text Editor

A modular rich text editor built with Web Components. The core editor is framework-agnostic, with an optional Preact wrapper for easy integration.

## Basic Usage

### With Preact

```tsx
import { RichTextEditor } from "bunfx/rich-text/preact";

function MyEditor() {
  const [content, setContent] = useState("");

  return (
    <RichTextEditor
      value={content}
      onChange={setContent}
    />
  );
}
```

### With Image Upload

To enable image paste/drop, provide an `uploader` function:

```tsx
import { RichTextEditor } from "bunfx/rich-text/preact";
import type { MakeUploader } from "bunfx/rich-text";

const myUploader: MakeUploader = ({ file, name, onProgress }) => {
  return {
    async upload() {
      const formData = new FormData();
      formData.append("file", file, name);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const { url } = await response.json();
      return { publicUrl: url };
    },
    abort() {
      // Optional: implement upload cancellation
    },
  };
};

function MyEditor() {
  return (
    <RichTextEditor
      value={content}
      onChange={setContent}
      uploader={myUploader}
    />
  );
}
```

### With File Picker

For the rich-block component's overlay image feature, provide a `filepicker`:

```tsx
import type { FilePicker } from "bunfx/rich-text";

const myFilepicker: FilePicker = async (opts) => {
  // Open your file picker UI
  const file = await openFilePicker(opts?.accept);
  if (!file) return undefined;

  // Upload and return URL
  const url = await uploadFile(file);
  return { url };
};

function MyEditor() {
  return (
    <RichTextEditor
      value={content}
      onChange={setContent}
      uploader={myUploader}
      filepicker={myFilepicker}
    />
  );
}
```

## Core Editor (No Preact)

The core editor is a Web Component that can be used without Preact:

```ts
import { RichText, getDefaultExtensions } from "bunfx/rich-text";
import type { EditorConfig } from "bunfx/rich-text";

// Create config
const config: EditorConfig = {
  extensions: getDefaultExtensions(),
  uploader: myUploader,
  filepicker: myFilepicker,
};

// Get or create the editor element
const editor = document.querySelector("rich-text") as RichText;
editor.config = config;
editor.value = "<p>Hello world</p>";

// Listen for changes
editor.addEventListener("input", () => {
  console.log(editor.serialize());
});
```

## Built-in Components

The editor includes several rich content blocks:

### rich-img

Image component with captions, alignment, and sizing options.

- Supports paste/drop image upload (requires `uploader`)
- Float left/center/right
- Width: 25%, 50%, 100%
- Editable captions

### rich-block

Styled content section with customizable colors and layout.

- Background and text color pickers
- Optional background overlay image (requires `filepicker`)
- Single or two-column layout
- Full-bleed option

### rich-cta

Call-to-action button with styling options.

- Primary and secondary button colors
- Text alignment
- Link configuration

### rich-hr

Horizontal rule with multiple style options.

## Extending the Editor

### Custom Extensions

Extensions add behavior to the editor. Each extension can handle keyboard events, input events, and selection changes:

```ts
import type { EditorExtension } from "bunfx/rich-text";

const myExtension: EditorExtension = {
  name: "my-extension",
  tagName: "my-component", // Optional: associated custom element
  capabilities: ["block*"], // What contexts this extension works in

  // Handle keyboard shortcuts
  onkeydown(e, editor) {
    if (e.ctrlKey && e.key === "m") {
      e.preventDefault();
      // Do something
      return true; // Prevent other handlers
    }
  },

  // Handle text input
  onbeforeinput(e, editor) {
    if (e.inputType === "insertFromPaste") {
      // Handle paste
    }
  },

  // React to selection changes
  onselectionchange(e, editor) {
    // Update toolbar state, etc.
  },

  // Called when editor initializes
  attach(editor) {
    // Setup code
  },
};
```

### Adding Extensions

Pass extra extensions via the `extraExtensions` prop:

```tsx
<RichTextEditor
  value={content}
  onChange={setContent}
  extraExtensions={[myExtension, anotherExtension]}
/>
```

### Custom Components

Create custom Web Components that integrate with the editor:

```tsx
import { render } from "preact";
import { signal } from "@preact/signals";
import { findEditor, deleteBlock } from "bunfx/rich-text/editor/utils";
import { getEditorConfig } from "bunfx/rich-text/editor/config";

class MyComponent extends HTMLElement {
  state = signal({ /* component state */ });

  connectedCallback() {
    const editor = findEditor(this);
    const config = getEditorConfig(editor);

    // Access editor config (uploader, filepicker, etc.)
    console.log(config?.uploader);

    // Render your component UI
    render(<MyComponentUI state={this.state} />, this);
  }

  disconnectedCallback() {
    render(null, this);
  }

  serialize() {
    // Return HTML string for saving
    return `<my-component data-value="${this.state.value}"></my-component>`;
  }
}

customElements.define("my-component", MyComponent);
```

Then create an extension to handle insertion:

```ts
const extMyComponent: EditorExtension = {
  name: "my-component",
  tagName: "my-component",
  capabilities: ["block*"],

  onbeforeinput(e, editor) {
    // Handle paste/insertion logic
  },
};
```

## API Reference

### RichTextEditorProps

```ts
type RichTextEditorProps = {
  value?: string;                    // HTML content
  onChange?(html: string): void;     // Called on content change
  uploader?: MakeUploader;           // Enables image upload
  filepicker?: FilePicker;           // Enables file picker UI
  extraExtensions?: EditorExtension[]; // Additional extensions
};
```

### EditorConfig

```ts
type EditorConfig = {
  extensions: EditorExtension[];     // All active extensions
  uploader?: MakeUploader;           // Image upload handler
  filepicker?: FilePicker;           // File picker handler
};
```

### MakeUploader

```ts
type MakeUploader = (opts: {
  file: File | Blob;
  name?: string;
  onProgress?(state: { progress: number }): void;
}) => {
  upload(): Promise<{ publicUrl: string } | undefined>;
  abort(): void;
};
```

### FilePicker

```ts
type FilePicker = (opts?: {
  accept?: string;
}) => Promise<{ url: string } | undefined>;
```

### EditorExtension

```ts
type EditorExtension = {
  name: string;
  tagName?: string;
  selector?: string;
  isInline?: boolean;
  isChildless?: boolean;
  capabilities: string[];
  attach?(editor: HTMLElement): void;
  onkeydown?(e: KeyboardEvent, editor: HTMLElement): boolean | void;
  onbeforeinput?(e: InputEvent, editor: HTMLElement): boolean | void;
  onselectionchange?(e: SelectionChangeEvent, editor: HTMLElement): boolean | void;
};
```

## Utilities

### Editor Utils

```ts
import {
  findEditor,      // Find parent editor element
  deleteBlock,     // Remove a block element
  insertParagraph, // Insert paragraph after element
  getRange,        // Get current selection range
  isEmpty,         // Check if element is empty
} from "bunfx/rich-text/editor/utils";
```

### Serialization

```ts
import {
  serialize,          // Serialize element to HTML
  serializeChildren,  // Serialize child elements
} from "bunfx/rich-text/editor/serialization";
```

### Config Access

```ts
import { getEditorConfig } from "bunfx/rich-text/editor/config";

// Inside a custom element
const editor = findEditor(this);
const config = getEditorConfig(editor);
```
