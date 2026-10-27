import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chosenShowcase,
  toggleShowcase,
} from "../apps/mobile/src/features/exchange/showcase-selection";

const deck = ["bridge", "impl", "focus", "warm"];

test("an unsaved showcase shows the first three cards", () => {
  assert.deepEqual(chosenShowcase([], deck), ["bridge", "impl", "focus"]);
  assert.deepEqual(chosenShowcase(["warm", "gone"], deck), ["warm"]);
});

test("removing the last chosen card is refused instead of selecting the defaults", () => {
  let chosen = chosenShowcase([], deck);
  for (const key of ["bridge", "impl"]) {
    const result = toggleShowcase(chosen, key);
    assert.ok("showcase" in result);
    chosen = chosenShowcase(result.showcase, deck);
  }
  assert.deepEqual(chosen, ["focus"]);
  assert.deepEqual(toggleShowcase(chosen, "focus"), {
    refused: "1枚以上選んでください",
  });
});

test("a fourth card is refused", () => {
  assert.deepEqual(toggleShowcase(["bridge", "impl", "focus"], "warm"), {
    refused: "3枚まで選べます",
  });
  assert.deepEqual(toggleShowcase(["bridge"], "warm"), {
    showcase: ["bridge", "warm"],
  });
});
