import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useTypedPR(text: string, manual: boolean, replay: number) {
  const [shown, setShown] = useState(0);
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
        setShown(text.length);
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
        setShown(0);
        let cursor = 0;
        timer.current = setInterval(() => {
          if (!active) return;
          cursor = Math.min(text.length, cursor + 2);
          setShown(cursor);
          if (cursor === text.length) stop();
        }, 22);
      })
      .catch(showAll);
    return () => {
      active = false;
      stop();
      subscription?.remove();
    };
  }, [text, manual, replay, stop]);
  return {
    shown,
    reveal: () => {
      stop();
      setShown(text.length);
    },
  };
}
