import React, { useEffect, useState } from "react";
import { Animated, Easing, type ViewProps } from "react-native";
import { NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/** The original `nudge` keyframes: a 2.4s cycle starting after 1s. */
const NUDGE_CYCLE_MS = 2400;
const NUDGE_DELAY_MS = 1000;

/**
 * The original `.quest` nudge: a small shake (-1.5deg, 1.5deg, back) in the
 * first 30% of each cycle, then rest. It repeats while mounted, so the next
 * step keeps drawing the eye. Reduced motion keeps it still.
 */
export function Nudge({ style, ...props }: ViewProps) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    progress.setValue(0);
    if (reduced) return;
    const animation = Animated.sequence([
      Animated.delay(NUDGE_DELAY_MS),
      Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: NUDGE_CYCLE_MS,
          easing: Easing.linear,
          useNativeDriver: NATIVE_DRIVER,
          isInteraction: false,
        }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          transform: [
            {
              rotate: progress.interpolate({
                inputRange: [0, 0.1, 0.2, 0.3, 1],
                outputRange: ["0deg", "-1.5deg", "1.5deg", "0deg", "0deg"],
                easing: Easing.inOut(Easing.ease),
              }),
            },
          ],
        },
      ]}
    />
  );
}
