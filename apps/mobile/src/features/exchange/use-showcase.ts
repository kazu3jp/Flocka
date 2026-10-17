import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

/** Keep selection editing separate from the server-confirmed completion. */
export function useShowcase() {
  const { s, d, update, toast, savePreferences } = useApp();
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  const visit = useRef<object | null>(null);
  useFocusEffect(
    useCallback(() => {
      visit.current = {};
      return () => {
        visit.current = null;
      };
    }, []),
  );
  const available = d.deck.map((card) => card.key);
  const selected = s.showcase.filter((key) => available.includes(key));
  const chosen = selected.length ? selected : available.slice(0, 3);
  const toggle = (key: string) => {
    if (busy || !available.includes(key)) return;
    let limitReached = false;
    update((state) => {
      const saved = state.showcase.filter((item) => available.includes(item));
      const current = saved.length ? saved : available.slice(0, 3);
      if (current.includes(key)) {
        state.showcase = current.filter((item) => item !== key);
      } else if (current.length >= 3) {
        limitReached = true;
      } else {
        state.showcase = [...current, key];
      }
    });
    if (limitReached) toast("3枚まで選べます");
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
