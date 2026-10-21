import { useIsFocused } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  type EffectCallback,
} from "react";

/**
 * Tab screens stay mounted inside the one [page] route, so the route's own
 * focus cannot tell them apart. The screen stack marks the visible entry.
 * Outside the stacks (auth, account routes) a screen is visible by default.
 */
export const ScreenVisible = createContext(true);

/** True while this screen is the one on display and its route is focused. */
export function useScreenFocused() {
  const routeFocused = useIsFocused();
  return useContext(ScreenVisible) && routeFocused;
}

/**
 * Runs `effect` each time the screen comes into view and cleans it up when the
 * screen is hidden. Pass a memoized callback, as with useFocusEffect.
 */
export function useScreenFocusEffect(effect: EffectCallback) {
  const focused = useScreenFocused();
  useEffect(() => (focused ? effect() : undefined), [focused, effect]);
}
