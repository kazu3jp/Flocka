import { useLayoutEffect, useState } from "react";
import { Animated } from "react-native";
import { MOTION_EASE, NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/**
 * Progress from 0 to 1 each time `active` turns true, resting at 1 while
 * motion is reduced. The start value is set in a layout effect, before the
 * revealed content is first painted. `settled` is true once the motion has
 * finished (or is skipped), so callers can drop the animated style.
 */
export function useEnterMotion({
  active,
  duration,
  delay = 0,
}: {
  active: boolean;
  duration: number;
  delay?: number;
}) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const [finished, setFinished] = useState(false);
  useLayoutEffect(() => {
    if (!active) return;
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: MOTION_EASE,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start((result) => {
      if (result.finished) setFinished(true);
    });
    return () => {
      animation.stop();
      setFinished(false);
    };
  }, [active, delay, duration, progress, reduced]);
  return { progress, settled: reduced || finished };
}
