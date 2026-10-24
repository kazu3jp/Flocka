import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";
import { MOTION_MS, MOTION_POP, NATIVE_DRIVER } from "./motion-tokens";
import { useReduceMotion } from "./use-reduce-motion";

/**
 * Keeps a banner mounted while it eases out. `mounted` follows `present`
 * immediately when motion is reduced; `progress` runs 0 to 1 for the entrance
 * with the original `toastIn` pop easing and back to 0 for the exit.
 */
export function usePresenceMotion(present: boolean) {
  const reduced = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(present ? 1 : 0));
  const [exited, setExited] = useState(!present);
  if (present && exited) setExited(false);
  useEffect(() => {
    if (reduced) {
      progress.setValue(present ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: present ? 1 : 0,
      duration: present ? MOTION_MS.toast : MOTION_MS.toastExit,
      easing: present ? MOTION_POP : Easing.in(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start((result) => {
      if (result.finished && !present) setExited(true);
    });
    return () => animation.stop();
  }, [present, progress, reduced]);
  return { mounted: present || (!reduced && !exited), progress };
}
