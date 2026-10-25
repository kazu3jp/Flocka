import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TOUR_POPOVER_GAP,
  TOUR_POPOVER_MARGIN,
  TOUR_POPOVER_MAX_WIDTH,
  TOUR_SPOTLIGHT_PADDING,
  dimRects,
  isUsableRect,
  placePopover,
  popoverWidth,
  relativeRect,
  sameRect,
  spotlightRect,
} from "../apps/mobile/src/features/guided-tour/tour-geometry";

const phone = { width: 390, height: 844 };
const noInsets = { top: 0, bottom: 0, left: 0, right: 0 };
const insets = { top: 47, bottom: 34, left: 0, right: 0 };

test("a target is made relative to the overlay origin", () => {
  assert.deepEqual(
    relativeRect(
      { x: 150, y: 90, width: 40, height: 20 },
      { x: 100, y: 50, width: 390, height: 800 },
    ),
    { x: 50, y: 40, width: 40, height: 20 },
  );
});

test("measurements are only trusted when they have a size and are on screen", () => {
  const box = { x: 10, y: 10, width: 50, height: 20 };
  assert.equal(isUsableRect(box, phone), true);
  assert.equal(isUsableRect(null, phone), false);
  assert.equal(isUsableRect({ ...box, width: 0, height: 0 }, phone), false);
  assert.equal(isUsableRect({ ...box, width: 0.4 }, phone), false);
  assert.equal(isUsableRect({ ...box, x: 500 }, phone), false);
  assert.equal(isUsableRect({ ...box, y: -100 }, phone), false);
  assert.equal(isUsableRect({ ...box, x: NaN }, phone), false);
  // A box partly scrolled off still counts: the visible part is highlighted.
  assert.equal(isUsableRect({ ...box, y: -10, height: 40 }, phone), true);
});

test("sameRect tolerates sub-pixel noise only", () => {
  const a = { x: 10, y: 10, width: 50, height: 20 };
  assert.equal(sameRect(a, { ...a, x: 10.3 }), true);
  assert.equal(sameRect(a, { ...a, x: 11 }), false);
  assert.equal(sameRect(null, null), true);
  assert.equal(sameRect(a, null), false);
});

test("the cut-out grows the target by the padding and stays on screen", () => {
  assert.deepEqual(
    spotlightRect({ x: 50, y: 100, width: 100, height: 40 }, phone),
    {
      x: 50 - TOUR_SPOTLIGHT_PADDING,
      y: 100 - TOUR_SPOTLIGHT_PADDING,
      width: 100 + TOUR_SPOTLIGHT_PADDING * 2,
      height: 40 + TOUR_SPOTLIGHT_PADDING * 2,
    },
  );
  const edge = spotlightRect({ x: 0, y: 0, width: 390, height: 40 }, phone);
  assert.equal(edge.x, 0);
  assert.equal(edge.y, 0);
  assert.equal(edge.width, 390);
});

test("the four dim rectangles tile the screen around the hole without overlap", () => {
  const hole = { x: 40, y: 200, width: 120, height: 80 };
  const rects = dimRects(phone, hole);
  const all = [rects.top, rects.bottom, rects.left, rects.right];
  const area = all.reduce((sum, r) => sum + (r ? r.width * r.height : 0), 0);
  assert.equal(area, phone.width * phone.height - hole.width * hole.height);
  assert.deepEqual(rects.left, { x: 0, y: 200, width: 40, height: 80 });
  assert.deepEqual(rects.right, { x: 160, y: 200, width: 230, height: 80 });
});

test("without a hole the whole screen is dimmed", () => {
  const rects = dimRects(phone, null);
  assert.deepEqual(rects.top, { x: 0, y: 0, width: 390, height: 844 });
  assert.equal(rects.bottom, null);
});

test("the popover goes below the target when it fits", () => {
  const target = { x: 20, y: 100, width: 100, height: 44 };
  const place = placePopover({
    spotlight: target,
    size: { width: 340, height: 200 },
    bounds: phone,
    insets,
  });
  assert.equal(place.placement, "below");
  assert.equal(place.top, target.y + target.height + TOUR_POPOVER_GAP);
});

test("it goes above when there is no room below", () => {
  const target = { x: 20, y: 700, width: 100, height: 44 };
  const place = placePopover({
    spotlight: target,
    size: { width: 340, height: 200 },
    bounds: phone,
    insets,
  });
  assert.equal(place.placement, "above");
  assert.equal(place.top, target.y - TOUR_POPOVER_GAP - 200);
});

test("it covers the roomier side when the target fills the screen", () => {
  const place = placePopover({
    spotlight: { x: 14, y: 60, width: 362, height: 700 },
    size: { width: 340, height: 220 },
    bounds: phone,
    insets,
  });
  assert.equal(place.placement, "over");
  assert.ok(place.top >= insets.top + TOUR_POPOVER_MARGIN);
  assert.ok(
    place.top + 220 <= phone.height - insets.bottom - TOUR_POPOVER_MARGIN,
  );
});

test("it stays inside the safe area on every side, whatever the target", () => {
  const sizes = [
    { width: 320, height: 740 },
    { width: 390, height: 640 },
    { width: 1280, height: 1000 },
  ];
  for (const bounds of sizes)
    for (const x of [0, bounds.width / 2, bounds.width - 40])
      for (const y of [0, bounds.height / 2, bounds.height - 44]) {
        const place = placePopover({
          spotlight: { x, y, width: 40, height: 44 },
          size: { width: popoverWidth(bounds, insets), height: 210 },
          bounds,
          insets,
        });
        const right = bounds.width - insets.right - TOUR_POPOVER_MARGIN;
        const bottom = bounds.height - insets.bottom - TOUR_POPOVER_MARGIN;
        assert.ok(place.left >= insets.left + TOUR_POPOVER_MARGIN);
        assert.ok(place.left + place.width <= right + 0.001);
        assert.ok(place.top >= insets.top + TOUR_POPOVER_MARGIN);
        assert.ok(place.top + 210 <= bottom + 0.001);
        assert.ok(place.pointerX >= 0 && place.pointerX <= place.width);
      }
});

test("the pointer aims at the target centre and is kept off the corners", () => {
  const place = placePopover({
    spotlight: { x: 20, y: 100, width: 44, height: 44 },
    size: { width: 340, height: 200 },
    bounds: phone,
    insets: noInsets,
  });
  assert.equal(place.left, TOUR_POPOVER_MARGIN);
  assert.equal(place.pointerX, 20 + 22 - TOUR_POPOVER_MARGIN);
  const corner = placePopover({
    spotlight: { x: 0, y: 100, width: 4, height: 44 },
    size: { width: 340, height: 200 },
    bounds: phone,
    insets: noInsets,
  });
  assert.equal(corner.pointerX, 22);
});

test("the popover is as wide as the screen allows, up to a maximum", () => {
  assert.equal(
    popoverWidth({ width: 1280, height: 1000 }, noInsets),
    TOUR_POPOVER_MAX_WIDTH,
  );
  assert.equal(
    popoverWidth({ width: 320, height: 740 }, noInsets),
    320 - TOUR_POPOVER_MARGIN * 2,
  );
});
