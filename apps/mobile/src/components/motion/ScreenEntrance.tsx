import React, { createContext, useContext, useState } from "react";
import { Animated, StyleSheet, type ViewProps } from "react-native";
import { useScreenFocused } from "../screen-focus";
import { ENTER_RISE, MOTION_MS, PUSH_SLIDE } from "./motion-tokens";
import { useEnterMotion } from "./use-enter-motion";

/**
 * Keys of the list items this screen has already shown, so a screen that
 * stays mounted does not replay its lists when it is revealed again.
 */
const RevealedItems = createContext<Set<string> | null>(null);

export function useRevealedItems() {
  const [own] = useState(() => new Set<string>());
  return useContext(RevealedItems) ?? own;
}

/**
 * How a screen arrives: pushed onto a stack (slides in from the right),
 * revealed by going back (slides in from the left, the way the screen above
 * left), or otherwise, as on a tab switch (rises a few points).
 */
export type ScreenEnter = "push" | "back" | "rise";

const ENTER_SLIDE: Record<ScreenEnter, number> = {
  push: PUSH_SLIDE,
  back: -PUSH_SLIDE,
  rise: 0,
};

/**
 * Wraps a screen kept mounted by the screen stacks. Each time the screen
 * becomes the visible one it fades in and moves as `enter` says; screens
 * hidden inside an Activity do not animate.
 */
export function ScreenEntrance({
  style,
  enter = "rise",
  ...props
}: ViewProps & { enter?: ScreenEnter }) {
  const visible = useScreenFocused();
  const [revealed] = useState(() => new Set<string>());
  // The way in is fixed when the screen becomes visible, so a later render
  // with another value cannot turn the motion around halfway.
  const [shown, setShown] = useState(visible),
    [arrival, setArrival] = useState(enter);
  if (visible !== shown) {
    setShown(visible);
    if (visible) setArrival(enter);
  }
  const { progress, settled } = useEnterMotion({
    active: visible,
    duration: MOTION_MS.enter,
  });
  return (
    <RevealedItems.Provider value={revealed}>
      <Animated.View
        {...props}
        style={[
          styles.fill,
          style,
          !settled && {
            opacity: progress,
            transform: [
              arrival !== "rise"
                ? {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [ENTER_SLIDE[arrival], 0],
                    }),
                  }
                : {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [ENTER_RISE.screen, 0],
                    }),
                  },
            ],
          },
        ]}
      />
    </RevealedItems.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
