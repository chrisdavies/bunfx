/**
 * Logic for handling ol, ul, li
 */

import { getContentEditableFalse } from "./core";
import type { EditorExtension } from "./extensions";
import {
  eachSibling,
  ensureNonEmpty,
  findRootAncestor,
  getEndEl,
  getRange,
  getStartEl,
  isAtStartOf,
  isEmpty,
  mergeSiblings,
  toElement,
} from "./utils";

type ListItem = {
  type: "li";
  depth: number;
  content: Element;
  listType: string;
  listStyle: string;
  selected: boolean;
};

type NonList = {
  type: "other";
  tagName: string;
  selected: boolean;
  content: Element;
};

type ListModel = ListItem | NonList;

function findOuterList(node: Element) {
  while (node.parentElement?.matches("ol,ul,li")) {
    node = node.parentElement;
  }
  return node as HTMLElement | null;
}

function domToModel(rng: Range) {
  const start = getStartEl(rng)?.closest("li");
  const end = getEndEl(rng)?.closest("li");
  if (!start || !end) {
    return;
  }
  const startList = findOuterList(start);
  const endList = findOuterList(end);
  if (!startList || !endList) {
    return;
  }
  const lis: ListModel[] = [];
  let inRange = false;
  function walk(list: HTMLElement, depth: number) {
    for (const child of list.children) {
      if (!(child instanceof HTMLLIElement)) {
        continue;
      }
      const selected = inRange ? rng.intersectsNode(child) : child === start;
      inRange ||= selected;
      lis.push({
        type: "li",
        depth,
        content: child,
        listType: list.tagName,
        listStyle: list.style.listStyleType || "",
        selected,
      });
      for (const nest of child.children) {
        if (
          nest instanceof HTMLOListElement ||
          nest instanceof HTMLUListElement
        ) {
          walk(nest, depth + 1);
        }
      }
      child.querySelectorAll("ol,ul,li").forEach((x) => x.remove());
    }
  }
  walk(startList!, 0);
  rng.setStartBefore(startList);
  rng.setEndAfter(endList);
  rng.deleteContents();
  return lis;
}

/**
 * Lists get weird when you allow something like
 * <li><ol><li><ol><li>...
 * So, here, we ensure that delta(depth) from one
 * li to the next is never > 1.
 */
function sanitizeDepths(items: ListModel[]) {
  let prevDepth = -1;
  for (let i = 0; i < items.length; ++i) {
    const item = items[i]!;
    if (item.type !== "li") {
      prevDepth = -1;
      continue;
    }
    ensureNonEmpty(item.content);
    if (Math.abs(item.depth - prevDepth) <= 1) {
      prevDepth = item.depth;
      continue;
    }
    const depth =
      prevDepth +
      (item.depth < prevDepth ? -1 : item.depth > prevDepth ? 1 : 0);
    const level = item.depth;
    item.depth = depth;
    for (let x = i + 1; x < items.length; ++x) {
      const item = items[x]!;
      if (item.type !== "li") {
        break;
      }
      if (item.depth !== level) {
        break;
      }
      item.depth = depth;
      i = x;
    }
  }
  return items;
}

function modelToDom(items: ListModel[]) {
  if (!items.length) {
    return;
  }
  const frag = document.createDocumentFragment();
  let list: HTMLElement | null = null;
  let depth = 0;
  const selected: Node[] = [];

  for (const item of sanitizeDepths(items)) {
    if (item.type !== "li") {
      list = null;
      depth = 0;
      if (item.tagName) {
        const el = document.createElement(item.tagName);
        if (item.content.firstChild) {
          el.append(...item.content.childNodes);
        } else {
          el.append(document.createElement("br"));
        }
        frag.append(el);
        if (item.selected) {
          selected.push(el);
        }
      }
      continue;
    }
    if (!list) {
      list = document.createElement(item.listType);
      if (item.listStyle) {
        list.style.listStyleType = item.listStyle;
      }
      frag.append(list);
    }
    while (item.depth < depth) {
      // li -> ol, ul
      list = list.parentElement!.parentElement!;
      --depth;
    }
    while (item.depth > depth) {
      const sub = document.createElement(item.listType);
      if (!list.lastChild) {
        list.append(document.createElement("li"));
      }
      list.lastElementChild!.append(sub);
      list = sub;
      ++depth;
    }
    if (item.selected) {
      selected.push(item.content.firstChild || item.content);
    }
    list.append(item.content);
  }
  return { selected, content: frag };
}

function modifyList(rng: Range, fn: (items: ListModel[]) => void) {
  const items = domToModel(rng);
  if (!items) {
    return;
  }
  fn(items);
  const result = modelToDom(items);
  if (!result) {
    return;
  }
  rng.insertNode(result.content);
  if (!result.selected.length) {
    return;
  }
  const start = result.selected[0]!;
  const end = result.selected[result.selected.length - 1]!;
  rng.selectNodeContents(end);
  rng.setStart(start, 0);
}

function changeDepth(editor: HTMLElement, direction: number) {
  const rng = getListRange(editor);
  if (!rng) {
    return;
  }
  modifyList(rng, (items) => {
    items.forEach((x) => {
      if (x.selected && x.type === "li") {
        x.depth = Math.max(0, x.depth + direction);
      }
    });
  });
  return true;
}

function getListRange(editor: HTMLElement) {
  const rng = getRange(editor);
  if (!rng) {
    return;
  }
  const ancestor = toElement(rng.commonAncestorContainer);
  const isList =
    ancestor?.closest("ol,ul") || ancestor?.querySelector("ol,ul,li");
  return isList ? rng : undefined;
}

/**
 * Special-case logic for converting a list (or part of a list) to a different
 * block type (e.g. li to h1), or converting non-lists to a list.
 */
function setListBlockType(editor: HTMLElement, rng: Range, blockType: string) {
  if (blockType === "ol" || blockType === "ul") {
    const ancestor = toElement(rng.commonAncestorContainer)?.closest("ol,ul");
    if (ancestor) {
      const list = document.createElement(blockType);
      list.append(...ancestor.childNodes);
      ancestor.replaceWith(list);
      rng.selectNodeContents(list);
      return;
    }

    const startNode = findRootAncestor(editor, getStartEl(rng));
    if (!startNode) {
      return;
    }
    const endNode = (findRootAncestor(editor, getEndEl(rng)) || startNode)
      .nextSibling;
    let list = startNode as Element;
    if (!list.matches(blockType)) {
      const newList = document.createElement(blockType);
      list.parentElement?.insertBefore(newList, startNode);
      list = newList;
    }
    for (const node of eachSibling(startNode, endNode)) {
      if (node === list) {
        continue;
      }
      if (node instanceof Element && node.matches("ol,ul")) {
        list.append(...node.childNodes);
        node.remove();
        continue;
      }
      const li = document.createElement("li");
      list.append(li);
      if (node instanceof Text) {
        li.append(node);
      } else if (node instanceof Element) {
        li.append(...node.childNodes);
        node.remove();
      }
      ensureNonEmpty(li);
    }
    rng.selectNodeContents(list);
  } else {
    modifyList(rng, (items) => {
      items.forEach((x, i) => {
        if (x.selected) {
          items[i] = {
            type: "other",
            content: x.content,
            selected: true,
            tagName: blockType,
          };
        }
      });
    });
  }

  mergeSiblings(editor, "ol");
  mergeSiblings(editor, "ul");
}

function findNext(ancestor: Node, start: Node, selector: string) {
  const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT);
  walker.currentNode = start;
  while (walker.previousNode()) {
    const curr = walker.currentNode;
    if (curr instanceof Element && curr.matches(selector)) {
      return curr;
    }
  }
}

function collapseRange(rng: Range) {
  if (rng.collapsed) {
    return true;
  }
  const startEl = getStartEl(rng);
  const endEl = getEndEl(rng);
  if (!startEl?.closest("li") && !endEl?.closest("li")) {
    return false;
  }
  rng.deleteContents();
  endEl && rng.setStart(endEl, 0);
  rng.collapse();
  return true;
}

function deleteContentForward(editor: HTMLElement) {
  const rng = getRange(editor);

  if (rng?.collapsed) {
    const sel = globalThis.getSelection();
    sel?.modify("extend", "forward", "character");
    const extendedRng = getRange(editor);
    if (extendedRng) {
      const start = getStartEl(extendedRng);
      const end = getEndEl(extendedRng);
      const nonEditableStart = getContentEditableFalse(start);
      const nonEditableEnd = getContentEditableFalse(end);
      const nonEditable = nonEditableStart || nonEditableEnd;
      if (nonEditable) {
        nonEditable.focus();
        return true;
      }
    }
  }

  return deleteContentBackward(editor);
}

function deleteContentBackward(editor: HTMLElement) {
  const rng = getRange(editor);
  if (!rng || !collapseRange(rng)) {
    return;
  }
  const startEl = getStartEl(rng);
  const rootAncestor = findRootAncestor(editor, startEl);
  const fromEl = startEl?.closest("li");

  if (!fromEl) {
    return;
  }
  if (!isAtStartOf(rng, fromEl)) {
    return;
  }

  const into =
    fromEl.previousSibling ||
    (rootAncestor &&
      rootAncestor !== fromEl &&
      findNext(rootAncestor, fromEl, "li")) ||
    rootAncestor?.previousSibling;
  if (!into) {
    return;
  }

  const lis =
    into instanceof Element && !into.contains(fromEl)
      ? into.querySelectorAll("li:last-child")
      : [];
  const intoEl = lis.length ? lis[lis.length - 1]! : into;

  const firstChild = fromEl.firstChild;
  modifyList(rng, (items) => {
    const fromIndex = items.findIndex((x) => x.content === fromEl);
    if (fromIndex >= 0) {
      items.splice(fromIndex, 1);
    }
    const toItem = items.find((x) => x.content === intoEl);
    if (toItem) {
      toItem.content.append(...fromEl.childNodes);
    }
  });

  if (intoEl instanceof Element && fromEl.firstChild) {
    intoEl.append(...fromEl.childNodes);
  }
  (fromEl as ChildNode).remove();
  firstChild && rng.setEndBefore(firstChild);
  rng.collapse();

  return true;
}

function insertParagraph(editor: HTMLElement) {
  const rng = getListRange(editor);
  if (!rng) {
    return;
  }
  const li = rng.collapsed ? getStartEl(rng)?.closest("li") : undefined;
  if (li && isEmpty(li)) {
    setListBlockType(editor, rng, "p");
  } else if (li) {
    rng.setEndAfter(li);
    const suffix = rng.extractContents().firstChild;
    ensureNonEmpty(li);
    if (suffix instanceof Element) {
      li.insertAdjacentElement("afterend", suffix);
      ensureNonEmpty(suffix);
      rng.setStart(suffix, 0);
    }
  }
  modifyList(rng, () => {});
  rng.collapse(true);
  return true;
}

function setBlockType(editor: HTMLElement, e: InputEvent) {
  if (!e.data) {
    return;
  }
  const isToList = e.data === "ol" || e.data === "ul";
  const rng = isToList ? getRange(editor) : getListRange(editor);
  if (rng) {
    setListBlockType(editor, rng, e.data);
    return isToList;
  }
}

/**
 * Detect if the user enters `* ` or `- ` or `1. `
 * at the start of an empty pargraph or li. In the case of
 * an li, this constitutes a "change list type". We use
 * inline styles here to specify the list-style-type to get
 * around CSS resets such as Tailwind's.
 */
type ListPrefix = {
  text: string;
  tag: string;
  listStyle: string;
};
const listPrefixes: ListPrefix[] = [
  { text: "-", tag: "ul", listStyle: "" },
  { text: "*", tag: "ul", listStyle: "" },
  { text: "1.", tag: "ol", listStyle: "decimal" },
  { text: "a.", tag: "ol", listStyle: "lower-alpha" },
  { text: "A.", tag: "ol", listStyle: "uppper-alpha" },
  { text: "i.", tag: "ol", listStyle: "lower-roman" },
  { text: "I.", tag: "ol", listStyle: "upper-roman" },
];
function insertText(editor: HTMLElement, e: InputEvent) {
  if (e.data !== " ") {
    return;
  }
  const rng = getRange(editor);
  if (!rng?.collapsed) {
    return;
  }
  const start =
    rng.startContainer.childNodes[rng.startOffset] || rng.startContainer;
  if (!(start instanceof Text) || start.length > 2 || start.previousSibling) {
    return;
  }
  const text = start.nodeValue;
  const prefix = listPrefixes.find((x) => x.text === text);
  if (!prefix) {
    return;
  }
  const ancestor = findRootAncestor(editor, start);
  if (!ancestor) {
    return;
  }
  if (!(ancestor instanceof HTMLParagraphElement)) {
    return;
  }
  const tagName = text === "-" || text === "*" ? "ul" : "ol";
  const list = document.createElement(tagName);
  const li = document.createElement("li");
  if (prefix.listStyle) {
    list.style.listStyleType = prefix.listStyle;
  }
  list.append(li);
  li.append(document.createElement("br"));
  ancestor.replaceWith(list);
  rng.setStart(li, 0);
  return true;
}

export const extLists: EditorExtension = {
  name: "lists",
  selector: "ol,ul,li",
  capabilities: ["block*"],
  onbeforeinput(e, editor) {
    if (e.inputType === "formatOutdent") {
      return changeDepth(editor, -1);
    } else if (e.inputType === "formatIndent") {
      return changeDepth(editor, 1);
    } else if (e.inputType === "formatBlock" && e.data) {
      return setBlockType(editor, e);
    } else if (e.inputType === "insertParagraph") {
      return insertParagraph(editor);
    } else if (e.inputType === "deleteContentBackward") {
      return deleteContentBackward(editor);
    } else if (e.inputType === "deleteContentForward") {
      return deleteContentForward(editor);
    } else if (e.inputType === "insertText") {
      return insertText(editor, e);
    }
  },
};
