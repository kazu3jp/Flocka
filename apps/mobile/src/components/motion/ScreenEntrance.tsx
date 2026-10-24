import React, { createContext, useContext, useState } from "react";
import { Animated, StyleSheet, type ViewProps } from "react-native";
import { useScreenFocused } from "../screen-focus";
import { ENTER_RISE, MOTION_MS } from "./motion-tokens";
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
 * Wraps a screen kept mounted by the screen stacks. Each time the screen
 * becomes the visible one it fades in and rises a few points; screens hidden
 * inside an Activity do not animate.
 */
export function ScreenEntrance({ style, ...props }: ViewProps) {
  const visible = useScreenFocused();
  const [revealed] = useState(() => new Set<string>());
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
              {
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
