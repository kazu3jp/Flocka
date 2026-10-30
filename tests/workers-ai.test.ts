import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("an expired shared deadline sends no billable AI request", () => {
  // Run the Worker module separately from the browser-oriented test typecheck.
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    import { AiTimeoutError, runHedged } from './apps/api/src/services/workers-ai.ts';
    for (const deadlineMs of [0, -1]) {
      let calls = 0;
      const outcome = await runHedged({
        run: async () => { calls++; return {}; },
        model: 'test-model', inputs: {}, deadlineMs, hedgeAfterMs: 6000,
        secondMinMs: 5000,
        reserveSecond: async () => { throw new Error('must not reserve a hedge'); },
      });
      assert.equal(calls, 0);
      assert.equal(outcome.ok, false);
      assert.ok(outcome.error instanceof AiTimeoutError);
      assert.deepEqual(outcome.requests, []);
    }
  `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
});
