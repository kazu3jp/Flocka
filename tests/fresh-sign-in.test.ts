import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FRESH_SIGN_IN_WINDOW_MS,
  consumeFreshSignIn,
  markFreshSignIn,
} from "../apps/mobile/src/features/auth/fresh-sign-in";

test("a sign-in starts at home once, and an unmarked launch restores the last screen", () => {
  assert.equal(consumeFreshSignIn(0), false);
  markFreshSignIn(1_000);
  assert.equal(consumeFreshSignIn(2_000), true);
  assert.equal(consumeFreshSignIn(2_001), false);
});

test("a mark that is not used within the window is dropped", () => {
  markFreshSignIn(1_000);
  assert.equal(consumeFreshSignIn(1_000 + FRESH_SIGN_IN_WINDOW_MS), false);
  markFreshSignIn(5_000);
  assert.equal(consumeFreshSignIn(5_000 + FRESH_SIGN_IN_WINDOW_MS - 1), true);
});
