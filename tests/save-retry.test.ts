import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RETRY_DELAYS_MS,
  createSaveRetry,
  retryDelayMs,
  saveStateOf,
  type RetryClock,
} from "../apps/mobile/src/features/sync/save-retry";

function fakeClock() {
  let now = 0,
    nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock: RetryClock = {
    setTimeout: (run, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, run });
      return id;
    },
    clearTimeout: (handle) => void timers.delete(handle as number),
  };
  return {
    clock,
    pending: () => timers.size,
    async advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
        await new Promise((resolve) => setImmediate(resolve));
      }
      now = target;
    },
  };
}

test("waits grow to a 30 second cap", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 50].map(retryDelayMs),
    [5_000, 10_000, 20_000, 30_000, 30_000, 30_000],
  );
  assert.equal(retryDelayMs(-3), RETRY_DELAYS_MS[0]);
});

test("the shown state puts failure first and counts unsent edits as saving", () => {
  const base = { failed: false, saving: false, unsaved: false };
  assert.equal(saveStateOf(base), "saved");
  assert.equal(saveStateOf({ ...base, unsaved: true }), "saving");
  assert.equal(saveStateOf({ ...base, saving: true }), "saving");
  assert.equal(saveStateOf({ ...base, failed: true, saving: true }), "failed");
});

test("failed attempts back off, then stop after a success", async () => {
  const time = fakeClock();
  const results = [false, false, false, true];
  let calls = 0;
  const retry = createSaveRetry({
    clock: time.clock,
    attempt: async () => results[calls++] ?? true,
  });
  retry.start();
  await time.advance(4_999);
  assert.equal(calls, 0);
  await time.advance(1);
  assert.equal(calls, 1);
  await time.advance(9_999);
  assert.equal(calls, 1);
  await time.advance(1);
  assert.equal(calls, 2);
  await time.advance(20_000);
  assert.equal(calls, 3);
  assert.equal(retry.failures, 3);
  await time.advance(30_000);
  assert.equal(calls, 4);
  assert.equal(time.pending(), 0, "no more attempts once saved");
  await time.advance(120_000);
  assert.equal(calls, 4);
});

test("retrying now skips the wait, and stopping resets the backoff", async () => {
  const time = fakeClock();
  let calls = 0;
  const retry = createSaveRetry({
    clock: time.clock,
    attempt: async () => (calls++, false),
  });
  retry.start();
  retry.retryNow();
  await time.advance(0);
  assert.equal(calls, 1);
  assert.equal(retry.failures, 1);
  retry.stop();
  assert.equal(time.pending(), 0);
  retry.retryNow();
  assert.equal(calls, 1, "a stopped retry ignores the foreground");
  retry.start();
  await time.advance(5_000);
  assert.equal(calls, 2, "the wait starts again at 5 seconds");
});

test("a throwing attempt counts as a failure and is retried", async () => {
  const time = fakeClock();
  let calls = 0;
  const retry = createSaveRetry({
    clock: time.clock,
    attempt: async () => {
      calls++;
      throw new Error("offline");
    },
  });
  retry.start();
  await time.advance(5_000);
  assert.equal(calls, 1);
  assert.equal(time.pending(), 1);
  retry.stop();
});
