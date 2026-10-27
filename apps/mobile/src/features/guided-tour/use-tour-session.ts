import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { isUsableRect, sameRect, type Rect, type Size } from "./tour-geometry";
import { measureRelativeTo } from "./tour-measure";
import type { TourNode, TourTargetRegistry } from "./tour-registry";
import {
  TOUR_STEPS,
  stepAfter,
  stepAfterMissing,
  type TourTab,
} from "./tour-steps";

/** A target that has not shown up after this long is skipped, not waited for. */
const TOUR_TARGET_TIMEOUT_MS = 1500;
/**
 * The target is measured again this often, so scrolling, rotation, the
 * keyboard and a screen still sliding in all move the cut-out with them.
 */
const TOUR_MEASURE_INTERVAL_MS = 100;

/**
 * One run of the tour: the current step, the measured box of its target, and
 * the moves between steps. It shows the tab each step needs, waits for the
 * target to register, and skips a step whose target never appears. The box is
 * stored with its step index, so the previous step's position is never shown
 * for the next one.
 */
export function useTourSession({
  registry,
  overlayRef,
  bounds,
  showTab,
  finish,
}: {
  registry: TourTargetRegistry;
  overlayRef: RefObject<TourNode | null>;
  bounds: Size;
  showTab: (tab: TourTab) => void;
  finish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<{
    index: number;
    rect: Rect | null;
  }>({ index: 0, rect: null });
  const direction = useRef<1 | -1>(1);
  const latest = useRef({ bounds, showTab, finish });
  useEffect(() => {
    latest.current = { bounds, showTab, finish };
  });

  useEffect(() => {
    const step = TOUR_STEPS[index];
    latest.current.showTab(step.tab);
    let cancelled = false;
    let measuring = false;
    let lastSeen = Date.now();
    const tick = async () => {
      if (measuring) return;
      measuring = true;
      const target = registry.node(step.target);
      const overlay = overlayRef.current;
      const rect =
        target && overlay ? await measureRelativeTo(target, overlay) : null;
      measuring = false;
      if (cancelled) return;
      if (isUsableRect(rect, latest.current.bounds)) {
        lastSeen = Date.now();
        setMeasured((previous) =>
          previous.index === index && sameRect(previous.rect, rect)
            ? previous
            : { index, rect },
        );
        return;
      }
      setMeasured((previous) =>
        previous.index === index && previous.rect === null
          ? previous
          : { index, rect: null },
      );
      if (Date.now() - lastSeen < TOUR_TARGET_TIMEOUT_MS) return;
      cancelled = true;
      const after = stepAfterMissing(index, direction.current);
      if (after === "finish") {
        latest.current.finish();
        return;
      }
      direction.current = after.direction;
      setIndex(after.index);
    };
    const timer = setInterval(() => void tick(), TOUR_MEASURE_INTERVAL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [index, registry, overlayRef]);

  const move = useCallback(
    (by: 1 | -1) => {
      const next = stepAfter(index, by);
      if (next === null) {
        if (by === 1) finish();
        return;
      }
      direction.current = by;
      setIndex(next);
    },
    [finish, index],
  );
  return {
    index,
    step: TOUR_STEPS[index],
    total: TOUR_STEPS.length,
    target: measured.index === index ? measured.rect : null,
    next: useCallback(() => move(1), [move]),
    previous: useCallback(() => move(-1), [move]),
  };
}
