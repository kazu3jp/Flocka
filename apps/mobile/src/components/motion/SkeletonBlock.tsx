import React, { useEffect, useState } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { MOTION_MS, NATIVE_DRIVER, SKELETON_OPACITY } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";
import { useScreenFocused } from "../screen-focus";

/**
 * A placeholder shaped like the content that is loading. It pulses in
 * opacity only (native driver, no layout change); reduced motion and hidden
 * kept-mounted screens hold still.
 */
export function SkeletonBlock({
  color,
  style,
}: {
  color: string;
  style: StyleProp<ViewStyle>;
}) {
  const reduced = useReduceMotion();
  const focused = useScreenFocused();
  const animate = focused && !reduced;
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence(
        [1, 0].map((toValue) =>
          Animated.timing(pulse, {
            toValue,
            duration: MOTION_MS.skeletonPulse,
            useNativeDriver: NATIVE_DRIVER,
            isInteraction: false,
          }),
        ),
      ),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [animate, pulse]);
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      style={[
        style,
        { backgroundColor: color },
        {
          opacity: animate
            ? pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [SKELETON_OPACITY.low, SKELETON_OPACITY.high],
              })
            : SKELETON_OPACITY.rest,
        },
      ]}
    />
  );
}
