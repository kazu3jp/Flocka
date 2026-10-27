import { useCallback, useMemo } from "react";
import type { State } from "@flocka/domain";
import { useApp } from "../../store";
import { refreshAfterWrite } from "../sync/refresh-after-write";
import { UserFacingError } from "../sync/user-facing-error";

/** The server calls behind the settings screen's save, unblock and withdraw. */
export function useSettingsActions() {
  const { api, refresh } = useApp();
  const saveSettings = useCallback(
    async (settings: State["settings"]) => {
      await api.saveSettings(settings);
      await refreshAfterWrite(refresh, "設定の保存は完了しました");
    },
    [api, refresh],
  );
  const unblock = useCallback(
    async (id: string) => {
      await api.unblock(id);
      await refreshAfterWrite(refresh, "ブロックの解除は完了しました");
    },
    [api, refresh],
  );
  const withdraw = useCallback(
    async (id: string | undefined) => {
      if (!id) throw new UserFacingError("依頼が見つかりません");
      await api.withdrawRequest(id);
      await refreshAfterWrite(refresh, "取り下げは完了しました");
    },
    [api, refresh],
  );
  return useMemo(
    () => ({ saveSettings, unblock, withdraw }),
    [saveSettings, unblock, withdraw],
  );
}
