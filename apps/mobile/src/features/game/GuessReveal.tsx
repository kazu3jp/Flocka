import React, { useEffect, useState } from "react";
import { Animated, type ViewProps } from "react-native";
import {
  MOTION_EASE,
  MOTION_POP,
  NATIVE_DRIVER,
} from "../../components/motion";
import { GUESS_MOTION } from "./guess-motion";

/** Separate beats let the testimony, card, stamp and gain register in that order. */
export function GuessReveal({
  variant,
  reduced,
  style,
  ...props
}: ViewProps & {
  variant: "note" | "card" | "stamp" | "gain";
  reduced: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const { delay, duration } = GUESS_MOTION[variant];
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: variant === "stamp" ? MOTION_POP : MOTION_EASE,
        useNativeDriver: NATIVE_DRIVER,
        isInteraction: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, variant]);
  const transform =
    variant === "card"
      ? [
          {
            translateY: progress.interpolate({
              inputRange: [0, 0.65, 1],
              outputRange: [40, -6, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.65, 1],
              outputRange: [0.85, 1.06, 1],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 0.65, 1],
              outputRange: ["-4deg", "1deg", "0deg"],
            }),
          },
        ]
      : variant === "stamp"
        ? [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [2.2, 1],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["-18deg", "-8deg"],
              }),
            },
          ]
        : [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [variant === "note" ? 36 : 10, 0],
              }),
            },
          ];
  return (
    <Animated.View
      {...props}
      testID={`guess-reveal-${variant}`}
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 0.2],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
          transform,
        },
      ]}
    />
  );
}
