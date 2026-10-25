import { relativeRect, type Rect } from "./tour-geometry";
import type { TourNode } from "./tour-registry";

function windowRect(node: TourNode): Promise<Rect | null> {
  return new Promise((resolve) => {
    let settled = false;
    // measureInWindow never answers for a node that was just unmounted.
    const timer = setTimeout(() => {
      settled = true;
      resolve(null);
    }, 250);
    try {
      node.measureInWindow((x, y, width, height) => {
        if (settled) return;
        clearTimeout(timer);
        resolve(
          [x, y, width, height].every((value) => typeof value === "number")
            ? { x, y, width, height }
            : null,
        );
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * The target's box in the overlay's coordinates. Both are measured in window
 * coordinates and subtracted, so status bar, the web preview frame and any
 * other offset the overlay has cancel out on every platform.
 */
export async function measureRelativeTo(
  target: TourNode,
  overlay: TourNode,
): Promise<Rect | null> {
  const [box, origin] = await Promise.all([
    windowRect(target),
    windowRect(overlay),
  ]);
  return box && origin ? relativeRect(box, origin) : null;
}
