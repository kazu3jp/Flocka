import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform, Share } from "react-native";
import { copyText } from "../clipboard/copy-text";
import { resolvePRDocument } from "@flocka/domain";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

// Browsers without the Web Share API cannot open a share sheet.
const canShare =
  Platform.OS !== "web" ||
  (typeof navigator !== "undefined" && typeof navigator.share === "function");

export function usePRDocument() {
  const { s, savePreferences, update, toast } = useApp();
  const { document, generated, sourceKnown } = resolvePRDocument(s);
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
        delete state.prDraftSource;
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
  const share = () => {
    const sharingVisit = visit.current;
    // Dismissing the share sheet is not an error; only a failure is reported.
    void Share.share({ message: draft }).catch((reason: unknown) => {
      // The Web Share API rejects with AbortError when the viewer cancels.
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (sharingVisit && sharingVisit === visit.current)
        toast("共有できませんでした");
    });
  };
  return {
    document,
    sourceKnown,
    // A saved draft stays readable after its card stops being confirmed;
    // only a currently confirmed card can replace it.
    canRegenerate: generated !== null,
    regenerationStrength: generated?.card.name,
    generatedCardKey: generated?.card.key,
    draft,
    manual: s.prDraft !== null,
    editing,
    beginEditing: () => {
      if (busy) return;
      if (document)
        update((state) => {
          if (state.prDraft === null) {
            state.prDraft = document.text;
            state.prDraftSource = {
              card: document.card.key,
              pieceIds: document.pieceIds,
            };
          }
        });
      setEditing(true);
    },
    change,
    finish,
    copy,
    share,
    canShare,
    replay,
    busy,
    error,
    confirmReset,
    askReset: () => {
      if (!busy && generated) setConfirmReset(true);
    },
    closeReset: () => {
      if (!busy) setConfirmReset(false);
    },
    regenerate,
  };
}
