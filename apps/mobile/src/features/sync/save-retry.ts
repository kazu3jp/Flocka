/** Waits between automatic retries of a failed save; the last value repeats. */
export const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 30_000] as const;

export function retryDelayMs(failures: number): number {
  const index = Math.min(
    Math.max(0, Math.floor(failures)),
    RETRY_DELAYS_MS.length - 1,
  );
  return RETRY_DELAYS_MS[index];
}

export type RetryClock = {
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

/**
 * Retries `attempt` with growing waits until it reports success or `stop` is
 * called. `retryNow` skips the wait (foreground, button). Stopping resets the
 * backoff, so the next failure starts again at the shortest wait.
 */
export function createSaveRetry(options: {
  clock: RetryClock;
  /** Resolves true once nothing is left to save. */
  attempt: () => Promise<boolean>;
}) {
  const { clock, attempt } = options;
  let failures = 0,
    handle: unknown = null,
    running = false,
    active = false;
  const clear = () => {
    if (handle !== null) clock.clearTimeout(handle);
    handle = null;
  };
  const schedule = () => {
    clear();
    handle = clock.setTimeout(() => void run(), retryDelayMs(failures));
  };
  const run = async () => {
    handle = null;
    if (!active || running) return;
    running = true;
    let saved = false;
    try {
      saved = await attempt();
    } catch {
      saved = false;
    } finally {
      running = false;
    }
    if (!active) return;
    if (saved) {
      active = false;
      failures = 0;
    } else {
      failures += 1;
      schedule();
    }
  };
  return {
    start() {
      if (active) return;
      active = true;
      failures = 0;
      schedule();
    },
    stop() {
      active = false;
      failures = 0;
      clear();
    },
    retryNow() {
      if (!active || running) return;
      clear();
      void run();
    },
    get failures() {
      return failures;
    },
  };
}
