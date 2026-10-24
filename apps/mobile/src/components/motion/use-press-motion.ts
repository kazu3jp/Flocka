import { useCallback, useState } from "react";
import { Animated, Easing } from "react-native";
import { MOTION_EASE, MOTION_MS, NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/**
 * Press progress from 0 (rest) to 1 (fully pressed), eased down quickly and
 * released a little slower so the control settles back.
 */
export function usePressMotion() {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const [pressed, setPressed] = useState(false);
  const move = useCallback(
    (toValue: 0 | 1) => {
      setPressed(toValue === 1);
      if (reduced) {
        progress.setValue(toValue);
        return;
      }
      Animated.timing(progress, {
        toValue,
        duration: toValue ? MOTION_MS.press : MOTION_MS.release,
        easing: toValue ? Easing.out(Easing.quad) : MOTION_EASE,
        useNativeDriver: NATIVE_DRIVER,
        isInteraction: false,
      }).start();
    },
    [progress, reduced],
  );
  const pressIn = useCallback(() => move(1), [move]);
  const pressOut = useCallback(() => move(0), [move]);
  return { progress, pressed, pressIn, pressOut };
}
