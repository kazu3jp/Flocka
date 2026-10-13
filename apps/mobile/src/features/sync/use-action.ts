import { useEffect, useRef, useState } from "react";
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    running = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : "通信に失敗しました");
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, error, run };
}
