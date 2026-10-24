import React, { useEffect, useRef, useState } from "react";
import { Animated, type ViewProps } from "react-native";
import { MOTION_MS, MOTION_POP, NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/** Bumps its content once whenever `trigger` changes, but not on first render. */
export function PopOnChange({
  trigger,
  style,
  ...props
}: ViewProps & { trigger: string | number }) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(1));
  const previous = useRef(trigger);
  useEffect(() => {
    if (previous.current === trigger) return;
    previous.current = trigger;
    if (reduced) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: MOTION_MS.pop,
      easing: MOTION_POP,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    }).start();
  }, [trigger, progress, reduced]);
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          transform: [
            {
              // Starts enlarged and settles at 1; the pop easing overshoots
              // below 1 on the way, which reads as a bounce.
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1.35, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}
