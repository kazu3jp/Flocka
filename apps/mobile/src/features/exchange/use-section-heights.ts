import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

/**
 * Adds up the laid-out heights of a few named sections, so a container that
 * shares out spare room can still tell how much its fixed parts need.
 */
export function useSectionHeights() {
  const heights = useRef(new Map<string, number>());
  const [total, setTotal] = useState(0);
  const measure = useCallback(
    (section: string) =>
      ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
        if (heights.current.get(section) === layout.height) return;
        heights.current.set(section, layout.height);
        let sum = 0;
        for (const height of heights.current.values()) sum += height;
        setTotal(sum);
      },
    [],
  );
  return { total, measure };
}
