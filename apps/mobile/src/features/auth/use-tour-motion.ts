import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const pop = Easing.bezier(0.3, 1.6, 0.5, 1);
export const tourEasing = {
  ease,
  pop,
  envelope: Easing.bezier(0.42, 0, 0.58, 1),
};
const motions = {
  players: { duration: 3400 },
  swap: { duration: 3400 },
  envelope: { duration: 1600, loop: true },
  option: { duration: 500 },
  pick: { duration: 3400 },
  flip: { duration: 800 },
  line: { duration: 500 },
  copy: { duration: 450 },
  bar: { duration: 3600 },
} as const;

/** Timings and easing come from the original tour's CSS keyframes. */
export function useTourMotion(
  name: keyof typeof motions,
  reduced: boolean,
  restart: string | number,
  delay = 0,
  paused = false,
) {
  const [value] = useState(() => new Animated.Value(reduced || paused ? 1 : 0));
  useEffect(() => {
    if (reduced || paused) {
      value.setValue(1);
      return;
    }
    const spec = motions[name];
    value.setValue(0);
    // Ease each property's keyframe segment, rather than the clock itself.
    // Otherwise a held segment clips the source's overshooting motion.
    const forward = Animated.timing(value, {
      toValue: 1,
      duration: spec.duration,
      easing: Easing.linear,
      useNativeDriver: false,
      isInteraction: false,
    });
    const animation = Animated.sequence([
      Animated.delay(delay),
      "loop" in spec
        ? Animated.loop(
            Animated.sequence([
              forward,
              Animated.timing(value, {
                toValue: 0,
                duration: spec.duration,
                easing: Easing.linear,
                useNativeDriver: false,
                isInteraction: false,
              }),
            ]),
          )
        : forward,
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, name, paused, reduced, restart, value]);
  return value;
}
