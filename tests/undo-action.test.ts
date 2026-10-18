import assert from "node:assert/strict";
import { test } from "node:test";
import { createUndoAction } from "../apps/mobile/src/features/sync/undo-action";

test("an undo finishing after logout cannot refresh or notify another account", async () => {
  let active = true;
  let undoCalls = 0;
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const action = createUndoAction({
    undo: async () => {
      undoCalls++;
      await pending;
    },
    refresh: async () => {
      assert.fail("must not refresh a signed-out account");
    },
    isActive: () => active,
    notify: () => {
      assert.fail("must not show another account's feedback");
    },
    successMessage: "取り消しました",
  });
  const finishing = action.fn();
  active = false;
  complete();
  await finishing;
  await action.fn();
  assert.equal(undoCalls, 1);
});
