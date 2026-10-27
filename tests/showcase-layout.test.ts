import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SHOWCASE_CHOICE_GAP,
  showcaseChoiceLayout,
} from "../apps/mobile/src/features/exchange/showcase-layout";

// The sheet has 18px padding on each side.
const gridWidth = (windowWidth: number) => windowWidth - 36;

test("wide phones show three showcase choices per row, narrow ones two", () => {
  assert.equal(showcaseChoiceLayout(gridWidth(390)).columns, 3);
  assert.equal(showcaseChoiceLayout(gridWidth(360)).columns, 3);
  assert.equal(showcaseChoiceLayout(gridWidth(320)).columns, 2);
});

test("a row of showcase choices never overflows the grid", () => {
  for (let width = 280; width <= 500; width += 0.5) {
    const { columns, width: choice } = showcaseChoiceLayout(width);
    const row = choice * columns + SHOWCASE_CHOICE_GAP * (columns - 1);
    assert.ok(row <= width, `${width}: row ${row} overflows`);
    assert.ok(width - row < columns, `${width}: ${width - row}px left over`);
    assert.equal(choice, Math.floor(choice));
  }
});
