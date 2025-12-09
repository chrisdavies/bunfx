import { type LinkedListNode, makeLinkedList } from "./linked-list";

export type LRUCacheOptions<T> = {
  /** Maximum number of items to store. Set to 0 to disable caching (fetcher still called). */
  maxSize: number;
  /** Maximum time in milliseconds before an item expires. Set to 0 to disable expiration. */
  maxLifetimeMs?: number;
  /** Async function to fetch items by key. */
  fetcher: (key: string) => Promise<T>;
};

export type LRUCache<T> = {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  readonly size: number;
};

type CacheItem<T> = {
  key: string;
  value: T | Promise<T>;
  createdAt: number;
};

export function makeLRUCache<T>(options: LRUCacheOptions<T>): LRUCache<T> {
  const { maxSize, maxLifetimeMs = 0, fetcher } = options;

  const list = makeLinkedList<CacheItem<T>>();
  const nodes = new Map<string, LinkedListNode<CacheItem<T>>>();

  function evictTail() {
    const node = list.removeTail();
    if (node) {
      nodes.delete(node.data.key);
    }
  }

  function touch(node: LinkedListNode<CacheItem<T>>) {
    if (maxSize <= 0) return;
    list.moveToHead(node);
  }

  function getCachedNode(
    key: string,
  ): LinkedListNode<CacheItem<T>> | undefined {
    const node = nodes.get(key);
    if (!node) return;
    if (maxLifetimeMs > 0 && Date.now() - node.data.createdAt > maxLifetimeMs) {
      list.unlink(node);
      nodes.delete(key);
      return;
    }
    touch(node);
    return node;
  }

  function setNode<V extends T | Promise<T>>(
    key: string,
    value: V,
  ): LinkedListNode<CacheItem<T>> {
    const now = maxLifetimeMs > 0 ? Date.now() : 0;
    let node = nodes.get(key);
    if (node) {
      node.data.value = value;
      node.data.createdAt = now;
      touch(node);
    } else {
      node = list.createNode({ key, value, createdAt: now });
      nodes.set(key, node);
      if (maxSize > 0) {
        list.linkHead(node);
        if (nodes.size > maxSize) {
          evictTail();
        }
      }
    }
    return node;
  }

  function beginFetch(key: string): LinkedListNode<CacheItem<T>> {
    const promise = fetcher(key).then(
      (value) => {
        const node = nodes.get(key);
        if (node?.data.value === promise) {
          setNode(key, value);
        }
        return value;
      },
      (err) => {
        const node = nodes.get(key);
        if (node?.data.value === promise) {
          list.unlink(node);
          nodes.delete(key);
        }
        throw err;
      },
    );
    return setNode(key, promise);
  }

  return {
    get size() {
      return nodes.size;
    },

    get(key: string): Promise<T | undefined> {
      if (maxSize === 0) return fetcher(key);
      const cached = getCachedNode(key);
      if (cached) return Promise.resolve(cached.data.value) as Promise<T>;
      return beginFetch(key).data.value as Promise<T>;
    },

    set(key: string, value: T): void {
      setNode(key, value);
    },

    delete(key: string): boolean {
      const node = nodes.get(key);
      if (!node) return false;
      list.unlink(node);
      nodes.delete(key);
      return true;
    },

    has(key: string): boolean {
      return nodes.has(key);
    },

    clear(): void {
      nodes.clear();
      list.clear();
    },
  };
}
