/**
 * Logic for observing editor changes and patching changes
 * back into the editor.
 */

import { serializeChildren } from './serialization';

export function patch(editor: HTMLElement | null | undefined, value: string) {
  const root = editor as HTMLElement & { value?: string };
  if (!root || root.value === value) {
    return;
  }
  root.value = value;
  root.innerHTML = value;
}

export function attachChangeObserver(editor: HTMLElement) {
  const root = editor as HTMLElement & { value?: string; serialize?(): string };
  const observer = new MutationObserver(() => {
    const oldValue = root.value;
    const newValue = root.serialize?.() || serializeChildren(editor);
    if (newValue === oldValue) {
      return;
    }
    if (!root.serialize) {
      root.value = newValue;
    }
    root.dispatchEvent(new InputEvent('input'));
  });

  observer.observe(editor, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  return () => observer.disconnect();
}
