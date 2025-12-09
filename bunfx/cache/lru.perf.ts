import { makeLRUCache } from "./lru";

const iterations = 100_000;

async function bench(name: string, ttl?: number) {
  console.log(`=== ${name} ===\n`);

  const cache = makeLRUCache<string>({
    maxSize: 1000,
    maxLifetimeMs: ttl,
    fetcher: (key) => Promise.resolve(`value-${key}`),
  });

  // Warm up
  for (let i = 0; i < 1000; i++) {
    cache.set(`key-${i}`, `value-${i}`);
  }

  // Test set performance
  const setStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    cache.set(`key-${i % 1000}`, `value-${i}`);
  }
  const setTime = performance.now() - setStart;
  console.log(
    `set: ${setTime.toFixed(2)}ms (${((iterations / setTime) * 1000).toFixed(0)} ops/sec)`,
  );

  // Test get (cache hit) performance
  const getHitStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    cache.get(`key-${i % 1000}`);
  }
  const getHitTime = performance.now() - getHitStart;
  console.log(
    `get (hit): ${getHitTime.toFixed(2)}ms (${((iterations / getHitTime) * 1000).toFixed(0)} ops/sec)`,
  );

  // Test get (cache miss -> fetch) performance
  const missCache = makeLRUCache<string>({
    maxSize: iterations,
    maxLifetimeMs: ttl,
    fetcher: (key) => Promise.resolve(`value-${key}`),
  });

  const getMissStart = performance.now();
  const promises: Promise<unknown>[] = [];
  for (let i = 0; i < iterations; i++) {
    promises.push(missCache.get(`key-${i}`));
  }
  await Promise.all(promises);
  const getMissTime = performance.now() - getMissStart;
  console.log(
    `get (miss + fetch): ${getMissTime.toFixed(2)}ms (${((iterations / getMissTime) * 1000).toFixed(0)} ops/sec)`,
  );

  // Test has performance
  const hasStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    cache.has(`key-${i % 1000}`);
  }
  const hasTime = performance.now() - hasStart;
  console.log(
    `has: ${hasTime.toFixed(2)}ms (${((iterations / hasTime) * 1000).toFixed(0)} ops/sec)`,
  );

  // Test delete performance
  const deleteCache = makeLRUCache<string>({
    maxSize: iterations,
    maxLifetimeMs: ttl,
    fetcher: (key) => Promise.resolve(`value-${key}`),
  });
  for (let i = 0; i < iterations; i++) {
    deleteCache.set(`key-${i}`, `value-${i}`);
  }

  const deleteStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    deleteCache.delete(`key-${i}`);
  }
  const deleteTime = performance.now() - deleteStart;
  console.log(
    `delete: ${deleteTime.toFixed(2)}ms (${((iterations / deleteTime) * 1000).toFixed(0)} ops/sec)`,
  );

  console.log();
}

await bench("With TTL", 60_000);
await bench("No TTL");
