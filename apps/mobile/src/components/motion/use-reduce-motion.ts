import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

// react-native-web answers isReduceMotionEnabled from this media query, but
// asynchronously. Reading it up front means a screen never paints its
// animated start state first, and tests that emulate it see the end state.
function webPreference() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Until the system answers (the first moments after a native launch) motion
// stays off, so the setting is never ignored; later screens read the answer.
let known: boolean | null = null;

function initial() {
  if (Platform.OS === "web") return webPreference();
  return known ?? true;
}

/** True when the user asked the system for less motion. */
export function useReduceMotion() {
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let active = true;
    const apply = (value: boolean) => {
      known = value;
      if (active) setReduced(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      apply,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
