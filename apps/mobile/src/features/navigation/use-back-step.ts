import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Android hardware back steps back inside a multi-step screen before it pops
 * the screen. React Native calls the most recently added listener first, so
 * the listener is re-added whenever the step changes to stay ahead of the
 * app-wide navigation listener.
 */
export function useBackStep(step: number, previous: () => void) {
  useEffect(() => {
    if (Platform.OS !== "android" || step <= 0) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        previous();
        return true;
      },
    );
    return () => subscription.remove();
  }, [step, previous]);
}
