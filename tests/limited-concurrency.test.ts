import assert from "node:assert/strict";
import { test } from "node:test";
import { forEachWithLimit } from "../apps/mobile/src/features/sync/limited-concurrency";

test("photo downloads run in parallel without exceeding the limit", async () => {
  let running = 0,
    peak = 0;
  const done: number[] = [];
  await forEachWithLimit([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (item) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 10 - item));
    done.push(item);
    running--;
  });
  assert.equal(peak, 4);
  assert.deepEqual(
    done.sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  await forEachWithLimit([], 4, async () => {
    throw new Error("an empty list runs nothing");
  });
});
