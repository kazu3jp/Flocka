import { useEffect, useRef, useState } from "react";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

export function useConnectionRemoval() {
  const { api, refresh, toast } = useApp();
  const { busy, error, run } = useAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attemptedId, setAttemptedId] = useState<string | null>(null);
  const acknowledged = useRef(new Set<string>());
  const [acknowledgedIds, setAcknowledgedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const confirm = () => {
    if (!selectedId) return;
    const id = selectedId;
    setAttemptedId(id);
    void run(async () => {
      if (!acknowledged.current.has(id)) {
        await api.cancelExchange(id);
        acknowledged.current.add(id);
        if (mounted.current) setAcknowledgedIds(new Set(acknowledged.current));
      }
      await refresh();
      if (mounted.current) {
        setSelectedId(null);
        toast("解除しました");
      }
    });
  };
  return {
    selectedId,
    busy,
    error: attemptedId === selectedId ? error : null,
    acknowledged: selectedId !== null && acknowledgedIds.has(selectedId),
    show: (id: string) => {
      if (busy) return;
      setAttemptedId(null);
      setSelectedId(id);
    },
    close: () => {
      if (!busy) setSelectedId(null);
    },
    confirm,
  };
}
