import { useScreenFocusEffect } from "../../components/screen-focus";
import { useCallback, useRef, useState } from "react";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";
import { chosenShowcase, toggleShowcase } from "./showcase-selection";

/** Keep selection editing separate from the server-confirmed completion. */
export function useShowcase() {
  const { s, d, update, toast, savePreferences } = useApp();
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  const visit = useRef<object | null>(null);
  useScreenFocusEffect(
    useCallback(() => {
      visit.current = {};
      return () => {
        visit.current = null;
      };
    }, []),
  );
  const available = d.deck.map((card) => card.key);
  const chosen = chosenShowcase(s.showcase, available);
  const toggle = (key: string) => {
    if (busy || !available.includes(key)) return;
    let refused: string | undefined;
    update((state) => {
      const result = toggleShowcase(
        chosenShowcase(state.showcase, available),
        key,
      );
      if ("refused" in result) refused = result.refused;
      else state.showcase = result.showcase;
    });
    if (refused) toast(refused);
  };
  const finish = () =>
    run(async () => {
      const savingVisit = visit.current;
      await savePreferences();
      if (savingVisit && savingVisit === visit.current) setOpen(false);
    });
  return {
    open,
    chosen,
    toggle,
    busy,
    error,
    finish,
    show: () => setOpen(true),
    close: () => {
      if (!busy) setOpen(false);
    },
  };
}
