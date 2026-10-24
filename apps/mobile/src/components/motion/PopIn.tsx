import React, { useEffect, useState } from "react";
import { Animated, type ViewProps } from "react-native";
import { MOTION_MS, MOTION_POP, NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/**
 * The original `flash` keyframes (.5s with the pop easing, here a little
 * shorter): the content lands slightly small and tilted, overshoots, settles.
 * Plays once when it mounts. Use it for success moments.
 */
export function PopIn({ style, ...props }: ViewProps) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: MOTION_MS.pop,
      easing: MOTION_POP,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 0.3],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["-4deg", "0deg"],
              }),
            },
          ],
        },
      ]}
    />
  );
}
