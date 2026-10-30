import assert from "node:assert/strict";
import { test } from "node:test";
import { AiTimeoutError, runHedged } from "../apps/api/src/services/workers-ai";

test("an expired shared deadline sends no billable AI request", async () => {
  for (const deadlineMs of [0, -1]) {
    let calls = 0;
    const outcome = await runHedged({
      run: async () => {
        calls++;
        return {};
      },
      model: "test-model",
      inputs: {},
      deadlineMs,
      hedgeAfterMs: 6_000,
      secondMinMs: 5_000,
      reserveSecond: async () => {
        throw new Error("must not reserve a hedge");
      },
    });
    assert.equal(calls, 0);
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.ok(outcome.error instanceof AiTimeoutError);
    assert.deepEqual(outcome.requests, []);
  }
});
