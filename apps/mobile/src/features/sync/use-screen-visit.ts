import { useScreenFocusEffect } from "../../components/screen-focus";
import { useCallback, useRef } from "react";

/**
 * Work that navigates after an await must not move a later visit or another
 * screen's history. `startVisit()` captures the focused visit before the await and
 * returns a check that stays true only while that same visit is still focused.
 */
export function useScreenVisit(key = "") {
  const focusedVisit = useRef<{ key: string } | null>(null);
  useScreenFocusEffect(
    useCallback(() => {
      const visit = { key };
      focusedVisit.current = visit;
      return () => {
        if (focusedVisit.current === visit) focusedVisit.current = null;
      };
    }, [key]),
  );
  return useCallback(() => {
    const visit = focusedVisit.current;
    return () => visit !== null && visit === focusedVisit.current;
  }, []);
}
