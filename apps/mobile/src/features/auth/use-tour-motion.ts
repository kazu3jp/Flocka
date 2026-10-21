import { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  type LayoutChangeEvent,
} from "react-native";

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
const pop = Easing.bezier(0.3, 1.6, 0.5, 1);
export const tourEasing = {
  ease,
  pop,
  envelope: Easing.bezier(0.42, 0, 0.58, 1),
};
const EASED_SAMPLES_PER_SEGMENT = 12;

function numberWithUnit(value: number | string) {
  if (typeof value === "number") return { amount: value, unit: "" };
  const match = /^(-?\d*\.?\d+)([a-z%]*)$/.exec(value);
  if (!match) throw new Error(`Cannot ease the interpolation output ${value}`);
  return { amount: Number(match[1]), unit: match[2] };
}

/**
 * The native driver ignores `easing` on interpolations, so native expands
 * each eased keyframe segment into points. The web keeps the easing itself.
 */
export function eased(
  easing: (t: number) => number,
  {
    inputRange,
    outputRange,
  }: { inputRange: number[]; outputRange: number[] | string[] },
) {
  if (Platform.OS === "web") return { easing, inputRange, outputRange };
  const outputs = (outputRange as (number | string)[]).map(numberWithUnit);
  const unit = outputs[0].unit;
  const input = [inputRange[0]],
    output = [outputs[0].amount];
  for (let index = 1; index < inputRange.length; index++) {
    const [fromInput, toInput] = [inputRange[index - 1], inputRange[index]];
    const [from, to] = [outputs[index - 1].amount, outputs[index].amount];
    for (let step = 1; step <= EASED_SAMPLES_PER_SEGMENT; step++) {
      const t = step / EASED_SAMPLES_PER_SEGMENT;
      input.push(fromInput + (toInput - fromInput) * t);
      output.push(from + (to - from) * easing(t));
    }
  }
  return {
    inputRange: input,
    outputRange: unit ? output.map((amount) => `${amount}${unit}`) : output,
  };
}

const motions = {
  players: { duration: 3400 },
  swap: { duration: 3400 },
  envelope: { duration: 1600, loop: true },
  option: { duration: 500 },
  // The picked card's ring is an animated boxShadow, which the native driver
  // cannot run, so this motion stays on the JS driver everywhere.
  pick: { duration: 3400, animatesShadow: true },
  flip: { duration: 800 },
  line: { duration: 500 },
  copy: { duration: 450 },
  bar: { duration: 3600 },
} as const;

/** Timings and easing come from the original tour's CSS keyframes. */
export function useTourMotion(
  name: keyof typeof motions,
  reduced: boolean,
  restart: string | number,
  delay = 0,
  paused = false,
) {
  const [value] = useState(() => new Animated.Value(reduced || paused ? 1 : 0));
  useEffect(() => {
    if (reduced || paused) {
      value.setValue(1);
      return;
    }
    const spec = motions[name];
    // Web keeps the JS driver and the source's percentage translates.
    const useNativeDriver =
      Platform.OS !== "web" && !("animatesShadow" in spec);
    value.setValue(0);
    // Ease each property's keyframe segment, rather than the clock itself.
    // Otherwise a held segment clips the source's overshooting motion.
    const forward = Animated.timing(value, {
      toValue: 1,
      duration: spec.duration,
      easing: Easing.linear,
      useNativeDriver,
      isInteraction: false,
    });
    const animation = Animated.sequence([
      Animated.delay(delay),
      "loop" in spec
        ? Animated.loop(
            Animated.sequence([
              forward,
              Animated.timing(value, {
                toValue: 0,
                duration: spec.duration,
                easing: Easing.linear,
                useNativeDriver,
                isInteraction: false,
              }),
            ]),
          )
        : forward,
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, name, paused, reduced, restart, value]);
  return value;
}

/**
 * The source translates elements by percentages of their own size. Web keeps
 * those; the native driver needs pixels, so native measures the element.
 * `measured` stays false on native until that first layout arrives.
 */
export function useOwnSizeTranslate() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const onLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
      setSize((current) =>
        current?.width === layout.width && current.height === layout.height
          ? current
          : { width: layout.width, height: layout.height },
      ),
    [],
  );
  const percents = (
    axis: "width" | "height",
    values: number[],
  ): string[] | number[] =>
    Platform.OS === "web"
      ? values.map((value) => `${value}%`)
      : values.map((value) => (value / 100) * (size?.[axis] ?? 0));
  return {
    measured: Platform.OS === "web" || size !== null,
    onLayout: Platform.OS === "web" ? undefined : onLayout,
    percents,
  };
}
