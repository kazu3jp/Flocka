import React from "react";
import { Animated, type ViewProps } from "react-native";
import { useScreenFocused } from "../screen-focus";
import { ENTER_RISE, STAGGER } from "./motion-tokens";
import { useRevealedItems } from "./ScreenEntrance";
import { useEnterMotion } from "./use-enter-motion";

/**
 * A list or grid item that fades in and rises when its screen first shows it,
 * a few milliseconds after the item before it. `itemKey` marks the item as
 * shown, so scrolling it back into view or refreshing the list stays still.
 */
export function StaggerItem({
  itemKey,
  index,
  style,
  ...props
}: ViewProps & { itemKey: string; index: number }) {
  const revealed = useRevealedItems();
  const focused = useScreenFocused();
  const [alreadyShown] = React.useState(() => revealed.has(itemKey));
  const { progress, settled } = useEnterMotion({
    active: focused && !alreadyShown,
    duration: STAGGER.durationMs,
    delay: Math.min(index * STAGGER.stepMs, STAGGER.maxDelayMs),
  });
  React.useEffect(() => {
    if (focused) revealed.add(itemKey);
  }, [focused, itemKey, revealed]);
  if (alreadyShown || settled)
    return <Animated.View {...props} style={style} />;
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [ENTER_RISE.item, 0],
              }),
            },
          ],
        },
      ]}
    />
  );
}
