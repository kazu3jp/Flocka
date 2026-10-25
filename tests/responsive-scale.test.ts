import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISPLAY_FONT_MAX_MULTIPLIER,
  appliedFontScale,
  displayTextEm,
  fanCardHeightFor,
  fitDisplayName,
} from "../apps/mobile/src/components/responsive-scale";

const fit = (name: string, availableWidth: number, fontScale = 1) =>
  fitDisplayName({
    name,
    availableWidth,
    maxSize: 56,
    minSize: 16,
    fontScale,
  });

test("the system font scale is capped and never shrinks text", () => {
  assert.equal(appliedFontScale(0.85, 1.2), 1);
  assert.equal(appliedFontScale(1.1, 1.2), 1.1);
  assert.equal(appliedFontScale(2, DISPLAY_FONT_MAX_MULTIPLIER), 1.2);
});

test("kana and kanji count as a full em, Latin as less", () => {
  assert.equal(displayTextEm("テスト太郎"), 5);
  assert.ok(displayTextEm("Flocka") < 6);
});

test("a name that fits keeps the size the layout asked for", () => {
  assert.equal(fit("ハルカ", 252), 56);
});

test("a name shrinks to stay on one line before it wraps", () => {
  const size = fit("テスト太郎", 222);
  assert.ok(size < 56 && size >= 16);
  assert.ok(5 * size <= 222);
});

test("a long name plans two lines and never goes below the minimum", () => {
  const name = "あいうえおかきくけこさしすせそた";
  for (const width of [180, 200, 252]) {
    const size = fit(name, width);
    assert.ok(size >= 16);
    const perLine = Math.floor(width / (size * DISPLAY_FONT_MAX_MULTIPLIER));
    assert.ok(perLine * 2 >= 16, `${width}: ${size}`);
  }
});

test("an enlarged system font leaves a smaller name", () => {
  assert.ok(fit("テスト太郎", 222, 1.2) < fit("テスト太郎", 222, 1));
});

test("an unmeasured card keeps the requested size", () => {
  assert.equal(fit("ハルカ", 0), 56);
});

test("a fan needs room for its rotation and is dropped when too small", () => {
  assert.ok(fanCardHeightFor(244, 96) > 96);
  assert.equal(fanCardHeightFor(100, 96), 0);
});
