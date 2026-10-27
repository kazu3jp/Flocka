import { useCallback } from "react";
import { useApp } from "../../store";

/**
 * Starts an exchange from a peer's invite code and opens its confirm screen
 * once the synced state holds it. Returns whether the screen was opened.
 */
export function useStartExchange() {
  const { api, refresh, nav } = useApp();
  return useCallback(
    async (code: string, stillHere: () => boolean) => {
      const exchange = await api.startExchange(code);
      await refresh();
      // A late response must not replace a later visit or another screen.
      if (!stillHere()) return false;
      nav.replace("confirm", { cid: exchange.id });
      return true;
    },
    [api, refresh, nav],
  );
}
