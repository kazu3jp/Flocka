import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../store";

/**
 * Pull-to-refresh for a single screen. A failed sync is not reported as
 * success: the store keeps its sync error banner, this only stops the spinner.
 */
export function usePullRefresh() {
  const { refresh } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refresh()
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setRefreshing(false);
      });
  }, [refresh]);
  return { refreshing, onRefresh };
}
