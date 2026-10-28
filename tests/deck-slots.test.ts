import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DECK_SLOTS,
  deckSlots,
} from "../apps/mobile/src/features/game/deck-slots";

test("a deck under six cards leaves the other slots locked", () => {
  assert.deepEqual(deckSlots(["a", "b"]), {
    slots: ["a", "b", null, null, null, null],
    hidden: 0,
  });
});

test("exactly six cards fill the grid without a more tile", () => {
  const deck = ["a", "b", "c", "d", "e", "f"];
  assert.deepEqual(deckSlots(deck), { slots: deck, hidden: 0 });
});

test("seven or more show five cards and a more tile counting the rest", () => {
  const deck = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const { slots, hidden } = deckSlots(deck);
  assert.equal(slots.length, DECK_SLOTS);
  assert.deepEqual(slots, ["a", "b", "c", "d", "e", "more"]);
  assert.equal(hidden, 3);
});
