import { Easing, Platform } from "react-native";

/**
 * Timings and easings come from the original design's CSS: `--ease` and
 * `--pop` in flocka-v2-game.css, the 0.1s press transition, `slideUp`,
 * `toastIn` (.22s) and `flash` (.5s). Interactions stay under 250ms.
 */
export const MOTION_MS = {
  press: 100,
  release: 160,
  select: 140,
  enter: 180,
  toast: 220,
  toastExit: 160,
  pop: 360,
} as const;

export const MOTION_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
export const MOTION_POP = Easing.bezier(0.3, 1.6, 0.5, 1);

/** The web keeps the JS driver; native runs transform and opacity natively. */
export const NATIVE_DRIVER = Platform.OS !== "web";

/** Stagger limits: at most 30ms per item and 300ms in total with the fade. */
export const STAGGER = {
  stepMs: 30,
  maxDelayMs: 120,
  durationMs: 180,
} as const;

/** Distance a screen or list item rises while it fades in. */
export const ENTER_RISE = { screen: 10, item: 8 } as const;
