import { useCallback, useEffect, useState } from "react";
import type { ModerationCursor, PendingModeration } from "@flocka/domain";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

type Outcome = "removed" | "rejected" | "reviewed";

/** Open reports and deletion requests, loaded in pages, and their resolution. */
export function useModerationQueue() {
  const { api, toast, isAdmin } = useApp(),
    [items, setItems] = useState<PendingModeration[]>([]),
    [next, setNext] = useState<ModerationCursor | null>(null),
    [loaded, setLoaded] = useState(false),
    { busy, error, run } = useAction();
  const load = useCallback(
    (after: ModerationCursor | null) =>
      run(async () => {
        // The cursor follows the last loaded request, so resolving shown items
        // never skips the requests after them.
        const result = await api.pendingModeration(after);
        setItems((current) =>
          after ? [...current, ...result.items] : result.items,
        );
        setNext(result.next);
        setLoaded(true);
      }),
    // `run` is stable for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  );
  useEffect(() => {
    if (isAdmin) void load(null);
  }, [isAdmin, load]);
  const resolve = (id: string, status: Outcome, note: string) =>
    void run(async () => {
      await api.resolveModeration(id, status, note);
      setItems((current) => current.filter((other) => other.id !== id));
      toast("対応を記録しました");
    });
  return {
    items,
    next,
    loaded,
    busy,
    error,
    loadMore: () => void load(next),
    resolve,
  };
}
