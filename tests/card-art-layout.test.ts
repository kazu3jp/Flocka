import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CARD_ART_LABEL_BAND,
  CARD_ART_LABEL_LEFT,
  CARD_ART_LABEL_RIGHT,
  cardIllustrationBox,
} from "../apps/mobile/src/components/card-art-layout";

test("the card illustration never covers the No. label or the stamp", () => {
  for (let width = 60; width <= 360; width += 7)
    for (let height = 30; height <= 300; height += 5) {
      const { size, left, top } = cardIllustrationBox(width, height);
      const inBand = top < CARD_ART_LABEL_BAND;
      if (inBand && size > 0) {
        assert.ok(left >= CARD_ART_LABEL_LEFT, `${width}x${height}: left`);
        assert.ok(
          left + size <= width - CARD_ART_LABEL_RIGHT,
          `${width}x${height}: right`,
        );
      }
      assert.ok(left >= 0 && left + size <= width, `${width}x${height}: x`);
      assert.ok(top >= 0 && top + size <= height, `${width}x${height}: y`);
    }
});

test("short, wide art keeps a usable illustration beside the labels", () => {
  // A two-column deck card on a 390px phone.
  assert.ok(cardIllustrationBox(152, 62).size >= 48);
  // A three-column showcase choice.
  assert.ok(cardIllustrationBox(96, 87).size >= 50);
});
