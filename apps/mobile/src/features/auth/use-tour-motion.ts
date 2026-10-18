import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const pop = Easing.bezier(0.3, 1.6, 0.5, 1);
const motions = {
  players: { duration: 3400, stops: [0, 0.25, 0.55, 0.75, 1], easing: ease },
  swap: {
    duration: 3400,
    stops: [0, 0.22, 0.35, 0.45, 0.6, 0.8, 1],
    easing: pop,
  },
  envelope: {
    duration: 1600,
    stops: [0, 1, 0],
    easing: Easing.bezier(0.42, 0, 0.58, 1),
    loop: true,
  },
  option: { duration: 500, stops: [0, 1], easing: pop },
  pick: { duration: 3400, stops: [0, 0.55, 0.7, 1], easing: pop },
  flip: { duration: 800, stops: [0, 1], easing: pop },
  line: { duration: 500, stops: [0, 1], easing: ease },
  copy: { duration: 450, stops: [0, 1], easing: ease },
  bar: { duration: 3600, stops: [0, 1], easing: Easing.linear },
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
    const steps = spec.stops.slice(1).map((stop, index) =>
      Animated.timing(value, {
        toValue: stop,
        duration: spec.duration * Math.abs(stop - spec.stops[index]),
        easing: spec.easing,
        // Percentage translations and shadow changes share the JS timeline.
        useNativeDriver: false,
        isInteraction: false,
      }),
    );
    const sequence = Animated.sequence(steps);
    const animation = Animated.sequence([
      Animated.delay(delay),
      "loop" in spec ? Animated.loop(sequence) : sequence,
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, name, paused, reduced, restart, value]);
  return value;
}
