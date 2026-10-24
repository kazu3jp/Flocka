import React, { useEffect, useState } from "react";
import { Animated, type ViewProps } from "react-native";
import {
  ENTER_RISE,
  MOTION_EASE,
  MOTION_MS,
  NATIVE_DRIVER,
} from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/** Fades and slides its content in once when it mounts (banners, notices). */
export function EnterOnMount({
  from = "top",
  style,
  ...props
}: ViewProps & { from?: "top" | "bottom" }) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: MOTION_MS.enter,
      easing: MOTION_EASE,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  const rise = from === "top" ? -ENTER_RISE.item : ENTER_RISE.item;
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [rise, 0],
              }),
            },
          ],
        },
      ]}
    />
  );
}
