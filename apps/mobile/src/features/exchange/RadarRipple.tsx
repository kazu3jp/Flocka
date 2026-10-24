import React, { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import { C } from "../../components/theme";
import { NATIVE_DRIVER, useReduceMotion } from "../../components/motion";

export const RADAR_SIZE = 220;
const RING_COUNT = 3;
const RING_PERIOD_MS = 2700;
const RING_STAGGER_MS = RING_PERIOD_MS / RING_COUNT;

/**
 * Concentric rings that spread from the centre while scanning is really live
 * (`active`). Only transform and opacity animate, on the native driver. When
 * not active, or with reduced motion, the rings sit still; `dim` greys them.
 * The rings are decorative and hidden from assistive technology.
 */
export function RadarRipple({
  active,
  dim,
  light,
  children,
}: {
  active: boolean;
  dim: boolean;
  /** Smaller, fainter ripples once peers are listed. */
  light: boolean;
  children: ReactNode;
}) {
  const reduced = useReduceMotion();
  const [phases] = useState(() =>
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0)),
  );
  const animate = active && !reduced;
  useEffect(() => {
    if (!animate) return;
    const loops = phases.map((phase, index) =>
      Animated.sequence([
        Animated.delay(index * RING_STAGGER_MS),
        Animated.loop(
          Animated.timing(phase, {
            toValue: 1,
            duration: RING_PERIOD_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: NATIVE_DRIVER,
            isInteraction: false,
          }),
        ),
      ]),
    );
    const all = Animated.parallel(loops);
    all.start();
    return () => {
      all.stop();
      phases.forEach((phase) => phase.setValue(0));
    };
  }, [animate, phases]);
  const color = dim ? C.pale : C.white;
  const peak = light ? 0.3 : 0.55;
  const reach = light ? 0.72 : 1;
  return (
    <View
      style={{
        width: RADAR_SIZE,
        height: RADAR_SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", width: RADAR_SIZE, height: RADAR_SIZE }}
      >
        {phases.map((phase, index) => {
          // Still rings keep three radii visible: 0.5, 0.75 and 1 of the reach.
          const still = {
            opacity: (dim ? 0.35 : peak * 0.7) * (1 - index * 0.25),
            transform: [{ scale: reach * (0.5 + index * 0.25) }],
          };
          return (
            <Animated.View
              key={index}
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: RADAR_SIZE,
                  height: RADAR_SIZE,
                  borderRadius: RADAR_SIZE / 2,
                  borderWidth: 2.5,
                  borderColor: color,
                },
                animate
                  ? {
                      opacity: phase.interpolate({
                        inputRange: [0, 0.12, 1],
                        outputRange: [0, peak, 0],
                      }),
                      transform: [
                        {
                          scale: phase.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, reach],
                          }),
                        },
                      ],
                    }
                  : still,
              ]}
            />
          );
        })}
      </View>
      <View style={{ opacity: dim ? 0.6 : 1 }}>{children}</View>
    </View>
  );
}
