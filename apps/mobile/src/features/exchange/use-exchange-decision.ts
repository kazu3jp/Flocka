import { useCallback, useMemo } from "react";
import { useApp } from "../../store";
import { refreshAfterWrite } from "../sync/refresh-after-write";

/** The server calls behind the confirm screen's approve and cancel buttons. */
export function useExchangeDecision(cid: string) {
  const { api, refresh } = useApp();
  // After this account approved, the same request only updates the memo.
  const approve = useCallback(
    async (
      context: { place: string; trigger: string },
      editingMemo: boolean,
    ) => {
      const exchange = await api.approveExchange(
        cid,
        context.place,
        context.trigger,
      );
      await refreshAfterWrite(
        refresh,
        editingMemo ? "メモの保存は完了しました" : "承認は完了しました",
      );
      return exchange;
    },
    [api, refresh, cid],
  );
  const cancel = useCallback(async () => {
    await api.cancelExchange(cid);
    await refreshAfterWrite(refresh, "キャンセルは完了しました");
  }, [api, refresh, cid]);
  return useMemo(() => ({ approve, cancel }), [approve, cancel]);
}
