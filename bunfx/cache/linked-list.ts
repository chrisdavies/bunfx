export type LinkedListNode<T> = {
  data: T;
  prev: LinkedListNode<T> | null;
  next: LinkedListNode<T> | null;
};

export type LinkedList<T> = {
  unlink(node: LinkedListNode<T>): void;
  linkHead(node: LinkedListNode<T>): void;
  moveToHead(node: LinkedListNode<T>): void;
  removeTail(): LinkedListNode<T> | null;
  createNode(data: T): LinkedListNode<T>;
  clear(): void;
};

export function makeLinkedList<T>(): LinkedList<T> {
  let head: LinkedListNode<T> | null = null;
  let tail: LinkedListNode<T> | null = null;

  function unlink(node: LinkedListNode<T>) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      tail = node.prev;
    }
  }

  function linkHead(node: LinkedListNode<T>) {
    node.prev = null;
    node.next = head;
    if (head) {
      head.prev = node;
    }
    head = node;
    if (!tail) {
      tail = node;
    }
  }

  function moveToHead(node: LinkedListNode<T>) {
    if (node === head) return;
    unlink(node);
    linkHead(node);
  }

  function removeTail(): LinkedListNode<T> | null {
    if (!tail) return null;
    const node = tail;
    unlink(node);
    return node;
  }

  function createNode(data: T): LinkedListNode<T> {
    return { data, prev: null, next: null };
  }

  function clear() {
    head = null;
    tail = null;
  }

  return {
    unlink,
    linkHead,
    moveToHead,
    removeTail,
    createNode,
    clear,
  };
}
