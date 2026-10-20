import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AccessibilityInfo } from "react-native";

/** Typing progress lives outside the screen so each tick redraws only the text. */
export type TypedProgress = {
  get: () => number;
  set: (shown: number) => void;
  subscribe: (listener: () => void) => () => void;
};

function createTypedProgress(): TypedProgress {
  let shown = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => shown,
    set: (next) => {
      if (next === shown) return;
      shown = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useTypedShown(progress: TypedProgress) {
  return useSyncExternalStore(progress.subscribe, progress.get);
}

export function useTypedPR(text: string, manual: boolean, replay: number) {
  const [progress] = useState(createTypedProgress);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    let active = true;
    const showAll = () => {
      if (active) {
        stop();
        progress.set(text.length);
      }
    };
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (reduced) => {
        if (reduced) showAll();
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active) return;
        if (reduced || manual || !text.length) {
          showAll();
          return;
        }
        progress.set(0);
        let cursor = 0;
        timer.current = setInterval(() => {
          if (!active) return;
          cursor = Math.min(text.length, cursor + 2);
          progress.set(cursor);
          if (cursor === text.length) stop();
        }, 22);
      })
      .catch(showAll);
    return () => {
      active = false;
      stop();
      subscription?.remove();
    };
  }, [text, manual, replay, stop, progress]);
  const reveal = useCallback(() => {
    stop();
    progress.set(text.length);
  }, [progress, stop, text.length]);
  return { progress, reveal };
}
