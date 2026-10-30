import { useState } from "react";
import type { PRAiDraft, State } from "@flocka/domain";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";

/**
 * AI-written self-PR draft. The server builds it from the caller's own
 * testimonies; here it is only previewed, and it replaces the saved draft only
 * after the user adopts it. Every failure leaves the saved draft untouched.
 */
export function useAiPRDraft(cardKey: string | undefined) {
  const { api, update, savePreferences, syncError, ready } = useApp();
  const [preview, setPreview] = useState<PRAiDraft | null>(null);
  const generating = useAction();
  const adopting = useAction();
  const startVisit = useScreenVisit("pr-ai");

  const generate = () =>
    generating.run(async () => {
      if (!cardKey) return;
      const stillHere = startVisit();
      const draft = await api.generatePRDraftWithAI(cardKey);
      // Leaving the screen discards the result instead of opening a sheet later.
      if (stillHere()) setPreview(draft);
    });

  const adopt = () =>
    adopting.run(async () => {
      if (!preview) return;
      const stillHere = startVisit();
      let previous:
        Pick<State, "prDraft" | "prDraftSource" | "prDraftOrigin"> | undefined;
      update((state) => {
        previous = {
          prDraft: state.prDraft,
          prDraftSource: state.prDraftSource,
          prDraftOrigin: state.prDraftOrigin,
        };
        state.prDraft = preview.text;
        state.prDraftSource = preview.source;
        // The saved text stays marked as AI-written, even after later edits.
        state.prDraftOrigin = {
          kind: "ai",
          model: preview.model,
          generatedAt: preview.generatedAt,
        };
      });
      try {
        await savePreferences();
      } catch (error) {
        // A refused save must not leave the AI text as the unsaved draft.
        const restore = previous;
        if (restore)
          update((state) => {
            state.prDraft = restore.prDraft;
            if (restore.prDraftSource === undefined) delete state.prDraftSource;
            else state.prDraftSource = restore.prDraftSource;
            if (restore.prDraftOrigin === undefined) delete state.prDraftOrigin;
            else state.prDraftOrigin = restore.prDraftOrigin;
          });
        throw error;
      }
      if (stillHere()) setPreview(null);
    });

  return {
    preview,
    generating: generating.busy,
    adopting: adopting.busy,
    generateError: generating.error,
    adoptError: adopting.error,
    // The action needs a confirmed card and a server that answered the last sync.
    available: Boolean(cardKey) && ready && syncError === null,
    generate,
    adopt,
    discard: () => {
      if (!adopting.busy) setPreview(null);
    },
  };
}
