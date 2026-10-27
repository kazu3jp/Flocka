import { useCallback, useMemo } from "react";
import type { Piece } from "@flocka/domain";
import { useApp } from "../../store";
import { refreshAfterWrite } from "../sync/refresh-after-write";
import { UserFacingError } from "../sync/user-facing-error";

type Visibility = "private" | "public" | "hidden";

/**
 * The server calls behind a received testimony's visibility, report, block
 * and deletion buttons. Each offers an undo where the server allows one.
 */
export function useTestimonyActions() {
  const { api, refresh, toast, offerUndo } = useApp();
  const changeVisibility = useCallback(
    async (piece: Piece, visibility: Visibility) => {
      if (piece.visibility === visibility) return;
      if (piece.visibilityRevision === undefined)
        throw new UserFacingError("最新の証言を読み込み直してください");
      const previous = piece.visibility;
      const saved = await api.changeVisibility(
        piece.id,
        visibility,
        piece.visibilityRevision,
      );
      offerUndo(
        "公開範囲を変更しました",
        () =>
          api.changeVisibility(piece.id, previous, saved.visibilityRevision),
        "公開範囲を元に戻しました",
      );
      await refreshAfterWrite(refresh, "公開範囲の変更は完了しました");
    },
    [api, refresh, offerUndo],
  );
  const report = useCallback(
    async (pieceId: string, reason: string) => {
      await api.requestModeration(pieceId, "report", reason);
      await refreshAfterWrite(refresh, "通報は完了しました");
      toast("通報を受け付けました");
    },
    [api, refresh, toast],
  );
  const block = useCallback(
    async (personId: string) => {
      const saved = await api.block(personId);
      if (saved.undoToken) {
        const token = saved.undoToken;
        offerUndo(
          "ブロックしました",
          () => api.unblock(personId, token),
          "ブロックを取り消しました",
        );
      } else toast("すでにブロック中です");
      await refreshAfterWrite(refresh, "ブロックは完了しました");
    },
    [api, refresh, toast, offerUndo],
  );
  const requestDeletion = useCallback(
    async (pieceId: string) => {
      const request = await api.requestModeration(pieceId, "deletion");
      offerUndo(
        "削除依頼を受け付けました",
        () => api.withdrawRequest(request.id),
        "削除依頼を取り消しました",
      );
      await refreshAfterWrite(refresh, "削除依頼は完了しました");
    },
    [api, refresh, offerUndo],
  );
  return useMemo(
    () => ({ changeVisibility, report, block, requestDeletion }),
    [changeVisibility, report, block, requestDeletion],
  );
}
