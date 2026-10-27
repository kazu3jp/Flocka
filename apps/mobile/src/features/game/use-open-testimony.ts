import { useCallback } from "react";
import { useApp } from "../../store";
import { refreshAfterWrite } from "../sync/refresh-after-write";

/** Opens an envelope with the guessed card; the server keeps the guess. */
export function useOpenTestimony() {
  const { api, refresh } = useApp();
  return useCallback(
    async (pieceId: string, guess: string) => {
      const saved = await api.openTestimony(pieceId, guess);
      await refreshAfterWrite(refresh, "開封は完了しました");
      return saved;
    },
    [api, refresh],
  );
}
