/**
 * The tour's layout math, free of React Native so node:test can run it. All
 * rectangles are in the overlay's own coordinates (top left at 0, 0).
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Insets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** The ring sits this far outside the highlighted element. */
export const TOUR_SPOTLIGHT_PADDING = 6;
/** Corner radius of the cut-out, matching the app's panels. */
export const TOUR_SPOTLIGHT_RADIUS = 16;
export const TOUR_POPOVER_MAX_WIDTH = 340;
/** Distance of the popover from the screen edges (LAYOUT.screenPadding). */
export const TOUR_POPOVER_MARGIN = 14;
/** Distance between the cut-out and the popover. */
export const TOUR_POPOVER_GAP = 14;
/** Half the width of the pointer, so it never sits on a rounded corner. */
const TOUR_POINTER_INSET = 22;

/** `target` and `origin` are in the same (window) coordinates. */
export function relativeRect(target: Rect, origin: Rect): Rect {
  return {
    x: target.x - origin.x,
    y: target.y - origin.y,
    width: target.width,
    height: target.height,
  };
}

export function sameRect(a: Rect | null, b: Rect | null, tolerance = 0.5) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}

/**
 * A measurement is only trusted when it has a size and lies on screen. A
 * screen kept hidden measures as zeros, and one that is mid-navigation can
 * measure off screen; both mean "not there yet".
 */
export function isUsableRect(rect: Rect | null, bounds: Size): rect is Rect {
  if (!rect) return false;
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every(Number.isFinite)) return false;
  if (rect.width < 1 || rect.height < 1) return false;
  return (
    intersection(rect, {
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    }) !== null
  );
}

/** The cut-out: the target grown by `padding`, kept inside the screen. */
export function spotlightRect(
  target: Rect,
  bounds: Size,
  padding: number = TOUR_SPOTLIGHT_PADDING,
): Rect {
  const grown = {
    x: target.x - padding,
    y: target.y - padding,
    width: target.width + padding * 2,
    height: target.height + padding * 2,
  };
  return (
    intersection(grown, {
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    }) ?? grown
  );
}

/**
 * The four dim rectangles around a hole. Together they cover the screen
 * except the hole, with no overlap, so the dim stays a flat colour.
 */
export function dimRects(bounds: Size, hole: Rect | null) {
  if (!hole)
    return {
      top: { x: 0, y: 0, width: bounds.width, height: bounds.height },
      bottom: null,
      left: null,
      right: null,
    };
  const holeBottom = hole.y + hole.height;
  const holeRight = hole.x + hole.width;
  return {
    top: { x: 0, y: 0, width: bounds.width, height: Math.max(0, hole.y) },
    bottom: {
      x: 0,
      y: holeBottom,
      width: bounds.width,
      height: Math.max(0, bounds.height - holeBottom),
    },
    left: {
      x: 0,
      y: hole.y,
      width: Math.max(0, hole.x),
      height: hole.height,
    },
    right: {
      x: holeRight,
      y: hole.y,
      width: Math.max(0, bounds.width - holeRight),
      height: hole.height,
    },
  };
}

type PopoverPlacement = "below" | "above" | "over";

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
  placement: PopoverPlacement;
  /** Where the pointer's centre sits, from the popover's left edge. */
  pointerX: number;
};

export function popoverWidth(
  bounds: Size,
  insets: Insets,
  margin: number = TOUR_POPOVER_MARGIN,
) {
  const room = bounds.width - insets.left - insets.right - margin * 2;
  return Math.max(0, Math.min(TOUR_POPOVER_MAX_WIDTH, room));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Puts the popover below the cut-out when it fits, else above, else over the
 * side with more room (a target that fills the screen). It always stays
 * inside the safe area, and the pointer aims at the cut-out's centre.
 */
export function placePopover({
  spotlight,
  size,
  bounds,
  insets,
  margin = TOUR_POPOVER_MARGIN,
  gap = TOUR_POPOVER_GAP,
}: {
  spotlight: Rect;
  size: Size;
  bounds: Size;
  insets: Insets;
  margin?: number;
  gap?: number;
}): PopoverPosition {
  const width = Math.min(size.width, popoverWidth(bounds, insets, margin));
  const minX = insets.left + margin;
  const maxX = bounds.width - insets.right - margin - width;
  const centre = spotlight.x + spotlight.width / 2;
  const left = clamp(centre - width / 2, minX, maxX);
  const minY = insets.top + margin;
  const maxY = bounds.height - insets.bottom - margin;
  const spaceBelow = maxY - (spotlight.y + spotlight.height + gap);
  const spaceAbove = spotlight.y - gap - minY;
  let placement: PopoverPlacement;
  if (spaceBelow >= size.height) placement = "below";
  else if (spaceAbove >= size.height) placement = "above";
  else placement = "over";
  let top: number;
  if (placement === "below") top = spotlight.y + spotlight.height + gap;
  else if (placement === "above") top = spotlight.y - gap - size.height;
  else top = spaceBelow >= spaceAbove ? maxY - size.height : minY;
  top = clamp(top, minY, maxY - size.height);
  const pointerX = clamp(
    centre - left,
    TOUR_POINTER_INSET,
    width - TOUR_POINTER_INSET,
  );
  return { left, top, width, placement, pointerX };
}
