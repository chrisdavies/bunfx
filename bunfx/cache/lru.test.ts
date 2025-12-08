import { expect, mock, test } from "bun:test";
import { makeLRUCache } from "./lru";

test("basic set and get", async () => {
  const cache = makeLRUCache<string>({ maxSize: 3 });

  cache.set("a", "value-a");
  cache.set("b", "value-b");

  expect(await cache.get("a")).toBe("value-a");
  expect(await cache.get("b")).toBe("value-b");
  expect(await cache.get("c")).toBeUndefined();
});

test("has and delete", () => {
  const cache = makeLRUCache<string>({ maxSize: 3 });

  cache.set("a", "value-a");
  expect(cache.has("a")).toBe(true);
  expect(cache.has("b")).toBe(false);

  expect(cache.delete("a")).toBe(true);
  expect(cache.has("a")).toBe(false);
  expect(cache.delete("a")).toBe(false);
});

test("clear", async () => {
  const cache = makeLRUCache<string>({ maxSize: 3 });

  cache.set("a", "value-a");
  cache.set("b", "value-b");
  expect(cache.size).toBe(2);

  cache.clear();
  expect(cache.size).toBe(0);
  expect(await cache.get("a")).toBeUndefined();
});

test("evicts oldest when maxSize exceeded", async () => {
  const cache = makeLRUCache<string>({ maxSize: 3 });

  cache.set("a", "value-a");
  cache.set("b", "value-b");
  cache.set("c", "value-c");
  cache.set("d", "value-d"); // Should evict "a"

  expect(cache.size).toBe(3);
  expect(await cache.get("a")).toBeUndefined();
  expect(await cache.get("b")).toBe("value-b");
  expect(await cache.get("c")).toBe("value-c");
  expect(await cache.get("d")).toBe("value-d");
});

test("get updates LRU order", async () => {
  const cache = makeLRUCache<string>({ maxSize: 3 });

  cache.set("a", "value-a");
  cache.set("b", "value-b");
  cache.set("c", "value-c");

  // Access "a" to make it most recently used
  await cache.get("a");

  // Add "d" - should evict "b" (oldest) not "a"
  cache.set("d", "value-d");

  expect(await cache.get("a")).toBe("value-a");
  expect(await cache.get("b")).toBeUndefined();
  expect(await cache.get("c")).toBe("value-c");
  expect(await cache.get("d")).toBe("value-d");
});

test("set updates LRU order for existing key", async () => {
  const cache = makeLRUCache<string>({ maxSize: 3 });

  cache.set("a", "value-a");
  cache.set("b", "value-b");
  cache.set("c", "value-c");

  // Update "a" to make it most recently used
  cache.set("a", "value-a-updated");

  // Add "d" - should evict "b" (oldest) not "a"
  cache.set("d", "value-d");

  expect(await cache.get("a")).toBe("value-a-updated");
  expect(await cache.get("b")).toBeUndefined();
});

test("fetch function populates cache", async () => {
  const fetchFn = mock((key: string) => Promise.resolve(`fetched-${key}`));

  const cache = makeLRUCache<string>({
    maxSize: 3,
    fetch: fetchFn,
  });

  const value = await cache.get("x");
  expect(value).toBe("fetched-x");
  expect(fetchFn).toHaveBeenCalledTimes(1);

  // Second get should use cache
  const value2 = await cache.get("x");
  expect(value2).toBe("fetched-x");
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("concurrent fetches for same key are deduplicated", async () => {
  let resolvePromise: (value: string) => void;
  const fetchFn = mock(
    (_key: string) =>
      new Promise<string>((resolve) => {
        resolvePromise = resolve;
      }),
  );

  const cache = makeLRUCache<string>({
    maxSize: 3,
    fetch: fetchFn,
  });

  // Start two concurrent gets
  const promise1 = cache.get("x");
  const promise2 = cache.get("x");

  // Should only call fetch once
  expect(fetchFn).toHaveBeenCalledTimes(1);

  // Resolve and verify both get the value
  resolvePromise!("result");
  expect(await promise1).toBe("result");
  expect(await promise2).toBe("result");
});

test("fetch errors are not cached", async () => {
  let callCount = 0;
  const fetchFn = mock((key: string) => {
    callCount++;
    if (callCount === 1) {
      return Promise.reject(new Error("first call fails"));
    }
    return Promise.resolve(`fetched-${key}`);
  });

  const cache = makeLRUCache<string>({
    maxSize: 3,
    fetch: fetchFn,
  });

  // First call fails
  await expect(cache.get("x")).rejects.toThrow("first call fails");
  expect(fetchFn).toHaveBeenCalledTimes(1);

  // Second call should retry (not use cached error)
  const value = await cache.get("x");
  expect(value).toBe("fetched-x");
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

test("maxSize=0 calls fetch but does not cache", async () => {
  const fetchFn = mock((key: string) => Promise.resolve(`fetched-${key}`));

  const cache = makeLRUCache<string>({
    maxSize: 0,
    fetch: fetchFn,
  });

  const value1 = await cache.get("x");
  expect(value1).toBe("fetched-x");
  expect(fetchFn).toHaveBeenCalledTimes(1);

  // Second get should call fetch again (no caching)
  const value2 = await cache.get("x");
  expect(value2).toBe("fetched-x");
  expect(fetchFn).toHaveBeenCalledTimes(2);

  // Size should remain 0
  expect(cache.size).toBe(0);
});

test("manual set overrides pending fetch", async () => {
  let resolvePromise: (value: string) => void;
  const fetchFn = mock(
    (_key: string) =>
      new Promise<string>((resolve) => {
        resolvePromise = resolve;
      }),
  );

  const cache = makeLRUCache<string>({
    maxSize: 3,
    fetch: fetchFn,
  });

  // Start a fetch
  const promise = cache.get("x");

  // Manually set before fetch completes
  cache.set("x", "manual-value");

  // The pending promise still resolves with fetched value
  resolvePromise!("fetched-value");
  expect(await promise).toBe("fetched-value");

  // But cache has the manual value
  expect(await cache.get("x")).toBe("manual-value");
});
