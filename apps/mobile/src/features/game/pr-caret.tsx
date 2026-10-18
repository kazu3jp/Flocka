import React, { useEffect, useState } from "react";
import { Animated, Platform } from "react-native";
import { C } from "../../components/ui";

export function PRCaret() {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.delay(450),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 0,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return (
    <Animated.View
      testID="pr-caret"
      accessible={false}
      style={{
        width: 2,
        height: 16.5,
        backgroundColor: C.ink,
        opacity,
        transform: [{ translateY: 3 }],
      }}
    />
  );
}
