import React, { forwardRef, type ComponentRef } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { usePressMotion } from "./use-press-motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type SquishPressableProps = Omit<PressableProps, "style"> & {
  /** Like Pressable's, the function form receives the pressed state. */
  style?:
    | StyleProp<ViewStyle>
    | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Scale at full press, 1 for none. */
  pressScale?: number;
  /** Shift in points toward the bottom right at full press (the offset shadow's direction). */
  pressShift?: number;
};

/**
 * A Pressable that eases a small scale and shift on press. Only transform is
 * animated, so it runs on the native driver and never changes layout.
 */
export const SquishPressable = forwardRef<
  ComponentRef<typeof Pressable>,
  SquishPressableProps
>(function SquishPressable(
  { style, pressScale = 0.97, pressShift = 0, onPressIn, onPressOut, ...props },
  ref,
) {
  const { progress, pressed, pressIn, pressOut } = usePressMotion();
  const transform: Record<string, Animated.AnimatedInterpolation<number>>[] =
    [];
  if (pressShift) {
    const shift = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, pressShift],
    });
    transform.push({ translateX: shift }, { translateY: shift });
  }
  if (pressScale !== 1)
    transform.push({
      scale: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, pressScale],
      }),
    });
  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      onPressIn={(event: GestureResponderEvent) => {
        pressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressOut();
        onPressOut?.(event);
      }}
      style={[
        typeof style === "function" ? style({ pressed }) : style,
        { transform } as unknown as ViewStyle,
      ]}
    />
  );
});
