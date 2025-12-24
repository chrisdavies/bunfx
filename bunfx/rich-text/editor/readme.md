# Rich Text Editor

An extensible rich-text editor built on web standards, primarily using:

- [Web components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
- [Selection / range API](https://developer.mozilla.org/en-US/docs/Web/API/Selection)
- [Before input events](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event)

## Architecture

The editor is built around a custom `<rich-text>` Web Component that manages contenteditable functionality through an extension-based system. Rather than relying on browser defaults, the editor intercepts `beforeinput` events and implements custom behavior for maximum control and consistency.

### Core Components

- **index.ts** - Main entry point; defines the `<rich-text>` custom element
- **core.ts** - Core editing extensions (text input, line breaks, paragraphs, blocks)
- **extensions.ts** - Extension system and capability management
- **utils.ts** - DOM manipulation utilities shared across extensions

## Usage

### Basic Setup

```typescript
import 'client/lib/rich-text/editor';

// The <rich-text> element is now available
const editor = document.createElement('rich-text');
editor.value = '<p>Hello, world!</p>';
document.body.appendChild(editor);
```

### Getting/Setting Content

```typescript
// Set HTML content
editor.value = '<p>Some <strong>bold</strong> text</p>';

// Get HTML content
const html = editor.value;

// Manually serialize current DOM to update value
editor.serialize();
```

### Programmatic Editing

Use the `applyEdit` function to programmatically apply formatting or trigger commands. This dispatches standard `beforeinput` events. See [w3c input events](https://w3c.github.io/input-events/#interface-InputEvent-Attributes) for documentation. If there is no standard input event for a specific scenario, a custom event can be dispatched, and extensions can be built to handle them.

```typescript
import { applyEdit } from 'client/lib/rich-text/editor';

// Apply bold formatting
applyEdit(editor, 'formatBold');

// Insert text
applyEdit(editor, 'insertText', 'Hello');

// Undo/Redo
applyEdit(editor, 'historyUndo');
applyEdit(editor, 'historyRedo');
```

### Listening to Changes

The editor emits custom events for selection changes and content modifications:

```typescript
// Listen for selection changes
editor.addEventListener('rich-text:selectionchange', (e) => {
  console.log('Selection changed:', e.detail);
});

// Listen for content changes (standard input event)
editor.addEventListener('input', () => {
  console.log('Content changed');
});
```

## Features

### Text Formatting

Supports standard inline formatting via marks:

- **Bold** - `<strong>` or `<b>`
- **Italic** - `<em>` or `<i>`
- **Underline** - `<u>`
- **Strikethrough** - `<s>`

Keyboard shortcuts:
- `Ctrl/Cmd + B` - Bold
- `Ctrl/Cmd + I` - Italic
- `Ctrl/Cmd + U` - Underline
- `Ctrl/Cmd + Shift + X` - Strikethrough

### Lists

Full support for nested ordered and unordered lists:

- Ordered lists (`<ol>`)
- Unordered lists (`<ul>`)
- Nested lists with arbitrary depth
- Indent/outdent with Tab/Shift+Tab
- Smart Enter behavior (continue list, exit list on empty item)

### Hyperlinks

Create and edit hyperlinks with URL validation and editing capabilities.

### Block Elements

- Paragraphs (`<p>`)
- Headings (`<h1>` through `<h6>`)
- Block-level formatting changes via `formatBlock` command

### Text Alignment

Support for text alignment across block elements:
- Left
- Center
- Right

### Drag and Drop

Reorder blocks via drag and drop for intuitive content organization.

### Undo/Redo

Full undo/redo support with content and selection state preservation:
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` - Redo

## Extension System

The editor uses a capability-based extension system. Each extension declares:

- **name** - Unique identifier
- **capabilities** - Array of capability strings (e.g., `['inline*', 'format*']`)
- **tagName** - Optional HTML tag this extension manages
- **selector** - Optional CSS selector for matching elements
- **isInline** - Whether this creates inline (span-level) elements
- **Event handlers**:
  - `onbeforeinput` - Handle input events
  - `onkeydown` - Handle keyboard events
  - `onselectionchange` - Handle selection changes
  - `attach` - Initialize when editor is created

### Example Extension

```typescript
import { EditorExtension } from './extensions';

export const extBold: EditorExtension = {
  name: 'bold',
  tagName: 'strong',
  selector: 'b,strong',
  isInline: true,
  capabilities: ['inline*', 'format*'],
  onbeforeinput(e, editor) {
    if (e.inputType === 'formatBold') {
      toggleFormat(editor, { tagName: 'strong', selector: 'b,strong' });
      return true; // Prevent default
    }
  },
};
```

### Registering Extensions

Extensions are automatically registered when imported. The registry is organized by capability strings, allowing the editor to query available operations based on the current selection context.

## Selection Management

The editor includes sophisticated selection tracking:

- **Persistent Selection State** - Maintains selection even when editor loses focus
- **Selection Serialization** - Can save and restore selection positions
- **Highlight on Blur** - Uses CSS Custom Highlights API to show selection when unfocused
- **Capability-based Restrictions** - Available operations change based on selection context

## Content Editable Strategy

Rather than using browser default contenteditable behavior, the editor:

1. **Intercepts all input** via `beforeinput` event
2. **Prevents default behavior** for nearly all inputs
3. **Implements custom handling** for each operation
4. **Maintains precise control** over the DOM structure

This approach ensures:
- Consistent behavior across browsers
- Predictable HTML output
- Fine-grained control over formatting
- Ability to implement custom business logic

## Uneditable Blocks

The editor supports blocks with `contenteditable="false"` for embedding non-editable content:

- Focus the block to select it
- Delete/Backspace to remove the block
- Enter to insert a paragraph after the block
- Copy/cut/paste works with entire block

## File Structure

```
editor/
├── index.ts           # Main entry point, RichText custom element
├── core.ts            # Core editing (text input, blocks, line breaks)
├── extensions.ts      # Extension registry and capability system
├── formats.ts         # Text formatting (bold, italic, etc.)
├── marks.ts           # Mark-related utilities
├── lists.ts           # List handling (ol, ul, li)
├── hyperlinks.ts      # Link creation and editing
├── text-align.ts      # Text alignment support
├── drag-blocks.ts     # Drag and drop for block reordering
├── undo-redo.ts       # Undo/redo history management
├── selection.ts       # Selection tracking and serialization
├── serialization.ts   # HTML serialization
├── change.ts          # Change observation and events
└── utils.ts           # Shared DOM manipulation utilities
```

## Design Principles

1. **Modular** - Features are isolated in separate modules and can be composed
2. **Extensible** - New capabilities can be added via the extension system
3. **Controlled** - All input is handled explicitly rather than relying on browser defaults
4. **Type-safe** - Written in TypeScript with strong typing throughout
5. **Lightweight** - Minimal dependencies, focused on core editing functionality
6. **Standards-based** - Uses standard Web Components and DOM APIs

## Browser Support

The editor requires:
- `contenteditable` support
- `beforeinput` event support
- Custom Elements v1
- CSS Custom Highlights API (optional, for blur highlighting)

Tested on modern versions of Chrome, Firefox, Safari, and Edge.

## Future Enhancements

Potential areas for expansion:
- Table support
- Image handling and uploads
- Collaborative editing
- Markdown shortcuts
- Custom block types
- Keyboard-only navigation mode
- Accessibility improvements (ARIA attributes)
