import { useEffect, type RefObject } from "react";
import { Platform } from "react-native";

type Actions = { next: () => void; previous: () => void; skip: () => void };

/**
 * Web only. Esc ends the tour and the arrow keys step through it. Tab stays
 * inside the popover, so Enter or Space can never press the app underneath;
 * the highlighted element is not interactive while the tour runs. Native has
 * no keyboard focus to manage (the hardware back button is handled by
 * TourOverlay).
 */
export function useTourKeyboard(
  popover: RefObject<unknown>,
  { next, previous, skip }: Actions,
) {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
      } else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") previous();
      else if (event.key === "Tab") {
        const root = popover.current as HTMLElement | null;
        if (!root) return;
        const focusable = Array.from(
          root.querySelectorAll<HTMLElement>(
            "button, [href], [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((element) => !element.hasAttribute("disabled"));
        if (focusable.length === 0) {
          event.preventDefault();
          root.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const current = document.activeElement as HTMLElement | null;
        const inside = !!current && root.contains(current);
        if (!inside || (event.shiftKey && current === first)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && current === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [popover, next, previous, skip]);
}
