import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TUTORIAL_SEEN_KEY,
  TUTORIAL_SEEN_VALUE,
  parseTutorialSeen,
  shouldShowFirstLaunchTutorial,
  type TutorialSeenState,
} from "./tutorial-steps";

/**
 * Opens the tutorial once per install when the signed-in account is on its
 * first real screen. The flag is written when the tutorial opens, so quitting
 * halfway never brings it back; Settings can replay it. A storage read or
 * write failure never shows it again and never reaches the account's data.
 */
export function useFirstLaunchTutorial(conditions: {
  signedIn: boolean;
  accountReady: boolean;
  onboarded: boolean;
  onboardingScreen: boolean;
}) {
  const [seen, setSeen] = useState<TutorialSeenState>("unknown");
  const [phase, setPhase] = useState<"waiting" | "open" | "closed">("waiting");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    AsyncStorage.getItem(TUTORIAL_SEEN_KEY).then(
      (raw) => {
        if (active.current) setSeen(parseTutorialSeen(raw) ? "seen" : "unseen");
      },
      // Unknown stays unknown: it is better to miss the tutorial than repeat it.
      () => undefined,
    );
    return () => {
      active.current = false;
    };
  }, []);
  const show = shouldShowFirstLaunchTutorial({ seen, ...conditions });
  // Latched while rendering: it opens once and stays until it is closed, even if the write below fails.
  if (show && phase === "waiting") setPhase("open");
  const open = phase === "open";
  useEffect(() => {
    if (!open) return;
    AsyncStorage.setItem(TUTORIAL_SEEN_KEY, TUTORIAL_SEEN_VALUE).catch(
      () => undefined,
    );
  }, [open]);
  const close = useCallback(() => setPhase("closed"), []);
  return { open, close };
}
