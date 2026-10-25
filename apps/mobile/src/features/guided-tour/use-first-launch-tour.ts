import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TOUR_SEEN_KEY,
  TOUR_SEEN_VALUE,
  parseTourSeen,
  shouldShowFirstLaunchTour,
  type TourSeenState,
} from "./tour-steps";

/**
 * Opens the tour once per install when the signed-in account is on its first
 * real screen. The flag is written when the tour opens, so quitting halfway
 * never brings it back; Settings can replay it. A storage read or write
 * failure never shows it again and never reaches the account's data.
 */
export function useFirstLaunchTour(conditions: {
  signedIn: boolean;
  accountReady: boolean;
  onboarded: boolean;
  onboardingScreen: boolean;
}) {
  const [seen, setSeen] = useState<TourSeenState>("unknown");
  const [phase, setPhase] = useState<"waiting" | "open" | "closed">("waiting");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    AsyncStorage.getItem(TOUR_SEEN_KEY).then(
      (raw) => {
        if (active.current) setSeen(parseTourSeen(raw) ? "seen" : "unseen");
      },
      // Unknown stays unknown: it is better to miss the tour than repeat it.
      () => undefined,
    );
    return () => {
      active.current = false;
    };
  }, []);
  const show = shouldShowFirstLaunchTour({ seen, ...conditions });
  // Latched while rendering: it opens once and stays until it is closed, even if the write below fails.
  if (show && phase === "waiting") setPhase("open");
  const open = phase === "open";
  useEffect(() => {
    if (!open) return;
    AsyncStorage.setItem(TOUR_SEEN_KEY, TOUR_SEEN_VALUE).catch(() => undefined);
  }, [open]);
  const close = useCallback(() => setPhase("closed"), []);
  return { open, close };
}
