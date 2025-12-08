/**
 * Note: Storing Promise<T> as the value type is not well-supported because
 * JavaScript automatically flattens nested promises when awaited. If you need
 * to cache promises, wrap them in an object: { promise: Promise<T> }
 */

export type LRUCacheOptions<T> = {
  maxSize: number;
  fetch?: (key: string) => Promise<T>;
};

export type LRUCache<T> = {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  readonly size: number;
};

export function makeLRUCache<T>(options: LRUCacheOptions<T>): LRUCache<T> {
  const { maxSize, fetch } = options;
  const items = new Map<string, T | Promise<T>>();

  function evictIfNeeded() {
    if (items.size > maxSize) {
      const firstKey = items.keys().next().value;
      if (firstKey !== undefined) {
        items.delete(firstKey);
      }
    }
  }

  function touch(key: string, value: T | Promise<T>) {
    items.delete(key);
    items.set(key, value);
  }

  return {
    get size() {
      return items.size;
    },

    async get(key: string): Promise<T | undefined> {
      const cached = items.get(key);

      if (cached !== undefined) {
        touch(key, cached);
        return cached;
      }

      if (!fetch) return;

      // maxSize=0 means no caching, just fetch
      if (maxSize === 0) {
        return fetch(key);
      }

      const promise = fetch(key)
        .then((value) => {
          // Replace pending promise with resolved value
          if (items.get(key) === promise) {
            touch(key, value);
          }
          return value;
        })
        .catch((err) => {
          // Don't cache errors - remove the pending entry
          if (items.get(key) === promise) {
            items.delete(key);
          }
          throw err;
        });

      touch(key, promise);
      evictIfNeeded();

      return promise;
    },

    set(key: string, value: T): void {
      touch(key, value);
      evictIfNeeded();
    },

    delete(key: string): boolean {
      return items.delete(key);
    },

    has(key: string): boolean {
      return items.has(key);
    },

    clear(): void {
      items.clear();
    },
  };
}
