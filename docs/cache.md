# Cache

LRU (Least Recently Used) cache with optional TTL (time-to-live) support and automatic fetching.

## Import

```ts
import { makeLRUCache } from "bunfx/cache/lru";
```

## Basic Usage

```ts
const cache = makeLRUCache<User>({
  maxSize: 100,
  maxLifetimeMs: 60_000, // 1 minute TTL
  fetcher: async (key) => {
    return await db.query(`SELECT * FROM users WHERE id = ?`, [key]);
  },
});

// Fetch user - calls fetcher on cache miss, returns cached value on hit
const user = await cache.get("user-123");

// Manually set a value
cache.set("user-456", { id: "456", name: "Jane" });

// Check if key exists (does not call fetcher)
if (cache.has("user-123")) {
  // ...
}

// Delete a key
cache.delete("user-123");

// Clear all entries
cache.clear();

// Get current cache size
console.log(cache.size);
```

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `maxSize` | `number` | Yes | Maximum number of items to store. Set to `0` to disable caching (fetcher still called on every `get`). |
| `maxLifetimeMs` | `number` | No | Maximum time in milliseconds before an item expires. Default: `0` (no expiration). |
| `fetcher` | `(key: string) => Promise<T>` | Yes | Async function to fetch items by key on cache miss. |

## API

### `get(key: string): Promise<T | undefined>`

Returns the cached value for the given key. If the key is not in the cache (or has expired), calls the `fetcher` function to retrieve the value and caches the result.

Accessing a key updates its LRU order, making it the most recently used.

### `set(key: string, value: T): void`

Manually sets a value in the cache. This also updates the LRU order.

### `delete(key: string): boolean`

Removes a key from the cache. Returns `true` if the key existed, `false` otherwise.

### `has(key: string): boolean`

Checks if a key exists in the cache. Does not call the fetcher or update LRU order.

### `clear(): void`

Removes all entries from the cache.

### `size: number`

Read-only property returning the current number of items in the cache.

## Behavior Notes

### LRU Eviction

When the cache exceeds `maxSize`, the least recently used item is evicted. Both `get` and `set` operations update an item's LRU position.

### Concurrent Fetches

Multiple concurrent `get` calls for the same key are deduplicated. Only one fetch is performed, and all callers receive the same result.

```ts
// Only one fetch is performed
const [user1, user2] = await Promise.all([
  cache.get("user-123"),
  cache.get("user-123"),
]);
```

### Error Handling

Fetch errors are not cached. If the fetcher throws, subsequent `get` calls will retry the fetch.

```ts
try {
  const user = await cache.get("user-123");
} catch (err) {
  // Fetcher threw - next get() will retry
}
```

### Disabling Caching

Set `maxSize: 0` to disable caching while still using the fetcher interface. Every `get` call will invoke the fetcher.

```ts
const cache = makeLRUCache<Data>({
  maxSize: 0, // Caching disabled
  fetcher: async (key) => fetchData(key),
});
```

### Manual Override During Fetch

If you call `set` while a fetch is in progress, the cache will store your manual value. However, any pending `get` promises will still resolve with the fetched value.

```ts
const promise = cache.get("key"); // Starts fetch
cache.set("key", manualValue);    // Override cache

await promise; // Resolves with fetched value
await cache.get("key"); // Returns manualValue
```
