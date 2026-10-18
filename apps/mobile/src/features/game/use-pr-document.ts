import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { copyText } from "../clipboard/copy-text";
import { buildPR } from "@flocka/domain";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

export function usePRDocument() {
  const { s, savePreferences, update, toast } = useApp();
  const document = buildPR(s);
  const draft = s.prDraft ?? document?.text ?? "";
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [replay, setReplay] = useState(0);
  const { busy, error, run } = useAction();
  const visit = useRef<object | null>(null);
  useFocusEffect(
    useCallback(() => {
      visit.current = {};
      return () => {
        visit.current = null;
        setConfirmReset(false);
      };
    }, []),
  );
  const change = (prDraft: string) => {
    if (!busy)
      update((state) => {
        state.prDraft = prDraft;
      });
  };
  const finish = () =>
    run(async () => {
      const savingVisit = visit.current;
      await savePreferences();
      if (savingVisit && savingVisit === visit.current) setEditing(false);
    });
  const regenerate = () =>
    run(async () => {
      const savingVisit = visit.current;
      update((state) => {
        state.prDraft = null;
      });
      await savePreferences();
      if (!savingVisit || savingVisit !== visit.current) return;
      setConfirmReset(false);
      setEditing(false);
      setReplay((count) => count + 1);
    });
  const copy = () => {
    const copyingVisit = visit.current;
    void copyText(draft)
      .then(() => {
        if (copyingVisit && copyingVisit === visit.current)
          toast("コピーしました");
      })
      .catch(() => {
        if (copyingVisit && copyingVisit === visit.current)
          toast("コピーできませんでした");
      });
  };
  return {
    document,
    draft,
    manual: s.prDraft !== null,
    editing,
    beginEditing: () => setEditing(true),
    change,
    finish,
    copy,
    replay,
    busy,
    error,
    confirmReset,
    askReset: () => {
      if (!busy) setConfirmReset(true);
    },
    closeReset: () => {
      if (!busy) setConfirmReset(false);
    },
    regenerate,
  };
}
