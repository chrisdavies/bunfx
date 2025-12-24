# Rich-Text Preact Layer

This directory contains the Preact-based UI layer for the rich-text editor, bridging the core editor functionality with interactive visual components.

## Overview

The preact layer sits on top of the core editor (`../editor`) and provides:

- **Web Components** - Custom HTML elements for rich content (images, blocks, CTAs, horizontal rules)
- **Reactive UI** - Context toolbars and menus that respond to editor state using Preact signals
- **State Management** - Reactive selection tracking and capability detection

## Architecture

### Web Components (Custom Elements)

These extend `HTMLElement` and register themselves as custom elements:

- **`rich-img`** - Image component with upload, sizing, alignment, and caption support
- **`rich-block`** - Multi-column layout blocks with drag-and-drop
- **`rich-cta`** - Call-to-action blocks with customizable styling
- **`rich-hr`** - Horizontal rule separator
- **`editor-ui`** - Non-editable UI container (excluded from serialization)
- **`editor-placeholder`** - Temporary placeholder for async operations like uploads

Web components use Preact's `render()` to create interactive UI within the shadow-free custom element, allowing them to participate in the editor's content model while providing rich interactivity.

### Reactive UI Components

Pure Preact components that render based on editor state:

- **`SelectionContextToolbar`** - Floating toolbar appearing on text selection (formatting, links, colors)
- **`NewBlockToolbar`** - Block insertion toolbar shown on empty paragraphs (insert images, blocks, CTAs)
- **`EditorMenu`** - Reusable menu primitives (sections, items, radio sets, dividers)

### State Management

**`useEditorState()`** - Central state management hook using Preact signals:

- Tracks current selection range
- Computes available capabilities based on selection context
- Provides ref callback for editor element binding
- Handles selection change events

The state is reactive - when selection changes, capabilities automatically recompute, and UI components update accordingly.

## Extension System Integration

Each web component exports an `EditorExtension` object that registers with the core editor:

- Declares capabilities (what operations are allowed)
- Provides serialization logic
- Handles lifecycle (attach, detach, custom events)
- Responds to editor events (beforeinput, selectionchange)

The app layer (`../app`) imports and registers all extensions, connecting them to the core editor.

## File Organization

- **`index.ts`** - Public exports (state management, toolbars)
- **`use-editor-signal.ts`** - Reactive state management hook
- **`editor-ui.ts`** - Helper custom elements
- **`editor-menu.tsx`** - Reusable menu components
- **`selection-context-toolbar.tsx`** - Text selection toolbar
- **`new-block-toolbar.tsx`** - Block insertion toolbar
- **`rich-*.tsx`** - Individual rich content components
- **`upload.tsx`** - File upload utilities
- **`types.d.ts`** - TypeScript type definitions

## Design Philosophy

The preact layer follows these principles:

1. **Web Components as Content** - Rich blocks are custom elements that participate in the DOM and can be serialized
2. **Signals for Reactivity** - Use Preact signals for fine-grained reactive updates without re-rendering the entire editor
3. **Capability-Based UI** - Toolbars and menus adapt based on selection context and available extensions
4. **Separation of Concerns** - Core editor logic stays in `../editor`, UI presentation stays here
