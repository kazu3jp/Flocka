import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { MOTION_MS, NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/**
 * A ring with one bright arc that turns while something loads. Only a rotate
 * transform animates, on the native driver, so it costs no JS work per frame
 * and never changes layout. With reduced motion the arc stays still.
 */
export function Spinner({
  size = 28,
  color,
  trackColor,
  accessibilityLabel,
}: {
  size?: number;
  color: string;
  trackColor: string;
  accessibilityLabel?: string;
}) {
  const reduced = useReduceMotion();
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: MOTION_MS.spinnerTurn,
        easing: Easing.linear,
        useNativeDriver: NATIVE_DRIVER,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      turn.setValue(0);
    };
  }, [reduced, turn]);
  const stroke = Math.max(2, Math.round(size / 9));
  return (
    <View
      testID="spinner"
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: trackColor,
          borderTopColor: color,
          transform: [
            {
              rotate: turn.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        }}
      />
    </View>
  );
}
