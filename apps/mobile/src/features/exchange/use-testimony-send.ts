import { useEffect, useRef, useState } from "react";
import { useAction } from "../sync/use-action";

/** A confirmed delivery must never be sent again just to refresh the deck. */
export function useTestimonySend<T>(
  refresh: () => Promise<void>,
  onSynchronized: () => void,
) {
  const { busy, error, run } = useAction();
  const [receipt, setReceipt] = useState<T | null>(null);
  const delivered = useRef<T | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const synchronize = async () => {
    await refresh();
    if (mounted.current) onSynchronized();
  };
  const send = (deliver: () => Promise<T>) =>
    run(async () => {
      if (delivered.current === null) {
        const result = await deliver();
        delivered.current = result;
        if (mounted.current) setReceipt(result);
      }
      await synchronize();
    });
  const retrySync = () =>
    run(async () => {
      if (delivered.current !== null) await synchronize();
    });
  return { receipt, busy, error, send, retrySync };
}
