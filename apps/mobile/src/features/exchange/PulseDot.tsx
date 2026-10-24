import React, { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { C } from "../../components/theme";
import { NATIVE_DRIVER, useReduceMotion } from "../../components/motion";

const DOT = 10;

/** A small dot that breathes while scanning is live, and stays still otherwise. */
export function PulseDot({ active }: { active: boolean }) {
  const reduced = useReduceMotion();
  const [level] = useState(() => new Animated.Value(1));
  const animate = active && !reduced;
  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence(
        [0.3, 1].map((toValue) =>
          Animated.timing(level, {
            toValue,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: NATIVE_DRIVER,
            isInteraction: false,
          }),
        ),
      ),
    );
    loop.start();
    return () => {
      loop.stop();
      level.setValue(1);
    };
  }, [animate, level]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        backgroundColor: active ? C.yellow : C.pale,
        opacity: level,
        transform: [
          {
            scale: level.interpolate({
              inputRange: [0.3, 1],
              outputRange: [0.75, 1],
            }),
          },
        ],
      }}
    />
  );
}
