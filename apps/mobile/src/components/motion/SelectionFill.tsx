import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { MOTION_MS } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/**
 * A background layer that eases between two colours when `selected` changes.
 * Colour cannot run on the native driver, so it lives in its own layer behind
 * the content and never shares an animated node with the press transform.
 */
export function SelectionFill({
  selected,
  from,
  to,
  radius,
}: {
  selected: boolean;
  from: string;
  to: string;
  /** Inner radius of the control the fill sits in. */
  radius: number;
}) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(selected ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(selected ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: MOTION_MS.select,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, selected]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [from, to],
          }),
        },
      ]}
    />
  );
}
