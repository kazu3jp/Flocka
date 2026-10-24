import React, { useEffect, useState } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";
import { MOTION_EASE, MOTION_MS, NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/**
 * A progress segment whose fill eases in with the original `tourBar` scaleX
 * motion when `filled` changes. The track and fill share one rounded box.
 */
export function ProgressFill({
  filled,
  trackColor,
  fillColor,
  style,
}: {
  filled: boolean;
  trackColor: string;
  fillColor: string;
  style: StyleProp<ViewStyle>;
}) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(filled ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(filled ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: filled ? 1 : 0,
      duration: MOTION_MS.toast,
      easing: MOTION_EASE,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [filled, progress, reduced]);
  return (
    <View style={[{ backgroundColor: trackColor, overflow: "hidden" }, style]}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: fillColor,
          transformOrigin: "left center",
          transform: [{ scaleX: progress }],
        }}
      />
    </View>
  );
}
