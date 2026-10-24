import { useEffect, useState } from "react";

/**
 * True once `active` has stayed true for `ms`. The timer is dropped as soon as
 * `active` turns false (screen hidden, scanning paused) and starts over later.
 */
export function useSearchedFor(active: boolean, ms: number) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setElapsed(true), ms);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, ms]);
  return elapsed;
}
