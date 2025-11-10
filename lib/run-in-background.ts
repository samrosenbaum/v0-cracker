/**
 * Lightweight helper to run fire-and-forget background work.
 *
 * Next.js 14.0.x does not expose `unstable_after`, so we schedule the task
 * ourselves using `setImmediate` (or `setTimeout`) to ensure it executes on
 * the next turn of the event loop without blocking the response.
 */
export function runInBackground(task: () => Promise<void> | void) {
  const schedule = typeof setImmediate === 'function'
    ? setImmediate
    : (fn: () => void) => setTimeout(fn, 0);

  schedule(() => {
    try {
      const result = task();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).catch((error) => {
          console.error('[runInBackground] Task failed:', error);
        });
      }
    } catch (error) {
      console.error('[runInBackground] Synchronous task error:', error);
    }
  });
}
