/**
 * Wraps an async function to ensure only one invocation runs at a time.
 * If called while a previous call is in flight, queues the latest call
 * to run after the current one completes (only the most recent is kept).
 */
export function serialAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): T {
  let running = false;
  let queued: Parameters<T> | null = null;

  const wrapper = async (...args: Parameters<T>): Promise<void> => {
    if (running) {
      queued = args;
      return;
    }

    running = true;
    try {
      await fn(...args);
    } finally {
      running = false;
      if (queued) {
        const next = queued;
        queued = null;
        wrapper(...next);
      }
    }
  };

  return wrapper as T;
}
