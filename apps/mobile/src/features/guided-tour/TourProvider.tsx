import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Entry, NavState, Tab } from "@flocka/domain";
import { useApp } from "../../store";
import { TourContext, type TourApi } from "./tour-context";
import { TourTargetRegistry } from "./tour-registry";

type StartLocation = { tab: Tab; stack: Entry[] };

/**
 * Owns whether the tour runs and where the person was when it started.
 * `autoStart` (the first-launch decision) begins a run; Settings begins one
 * through useTour().start. Ending a run, by any route, puts the person back on
 * the screen they started from and calls `onEnd`.
 */
export function TourProvider({
  autoStart,
  onEnd,
  children,
}: {
  autoStart: boolean;
  onEnd: () => void;
  children: React.ReactNode;
}) {
  const { nav, n } = useApp();
  const [registry] = useState(() => new TourTargetRegistry());
  // A replay from Settings; the first-launch run is `autoStart` itself.
  const [replaying, setReplaying] = useState(false);
  const running = replaying || autoStart;
  const navState = useRef<NavState>(n);
  const origin = useRef<StartLocation | null>(null);
  const latest = useRef({ nav, onEnd });
  useEffect(() => {
    navState.current = n;
    latest.current = { nav, onEnd };
  });

  // Layout effects run before the overlay's own effects, so where the person
  // was is known before the first step moves them anywhere.
  useLayoutEffect(() => {
    if (!running || origin.current) return;
    const current = navState.current;
    origin.current = { tab: current.tab, stack: current.stacks[current.tab] };
  }, [running]);

  const start = useCallback(() => setReplaying(true), []);

  const showTab = useCallback((tab: Tab) => {
    const current = navState.current;
    // A tab already at its root is left alone, so its screen is not rebuilt.
    if (current.tab !== tab || current.stacks[tab].length > 1)
      latest.current.nav.goTab(tab, undefined, true);
  }, []);

  const finish = useCallback(() => {
    const from = origin.current;
    origin.current = null;
    setReplaying(false);
    if (from) {
      const current = navState.current;
      const same =
        current.tab === from.tab &&
        JSON.stringify(current.stacks[from.tab]) === JSON.stringify(from.stack);
      if (!same) {
        const { nav: navigation } = latest.current;
        navigation.goTab(from.tab, undefined, true);
        for (const entry of from.stack.slice(1))
          navigation.push(entry.id, entry.params);
      }
    }
    latest.current.onEnd();
  }, []);

  const value = useMemo<TourApi>(
    () => ({ registry, running, start, finish, showTab }),
    [registry, running, start, finish, showTab],
  );
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
