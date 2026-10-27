import React, { useEffect, useState } from "react";
import { Animated, View, type ViewStyle } from "react-native";
import { C, OUTLINE } from "../../components/theme";
import { useReduceMotion } from "../../components/motion";
import {
  MOTION_EASE,
  NATIVE_DRIVER,
} from "../../components/motion/motion-tokens";

const CORNER = 44;
const CORNER_INSET = 22;
const CORNER_BORDER = 5;
const BEAM_INSET = 30;
const BEAM_MS = 1800;

const CORNERS: ViewStyle[] = [
  {
    top: CORNER_INSET,
    left: CORNER_INSET,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
  },
  {
    top: CORNER_INSET,
    right: CORNER_INSET,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 10,
  },
  {
    bottom: CORNER_INSET,
    left: CORNER_INSET,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
  },
  {
    bottom: CORNER_INSET,
    right: CORNER_INSET,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 10,
  },
];

/**
 * The source's .qr-finder: a square ink frame with yellow corner marks and a
 * beam sweeping between them, laid over the camera. The beam rests at the top
 * when the user asks for less motion.
 */
export function QrFinder({
  size,
  children,
}: {
  size: number;
  children?: React.ReactNode;
}) {
  const reduced = useReduceMotion();
  const [travel] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      travel.setValue(0);
      return;
    }
    // alternate: down and back up, like `animation: qrBeam ... infinite alternate`.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(travel, {
          toValue: 1,
          duration: BEAM_MS,
          easing: MOTION_EASE,
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(travel, {
          toValue: 0,
          duration: BEAM_MS,
          easing: MOTION_EASE,
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, travel]);
  return (
    <View
      testID="qr-finder"
      style={{
        width: size,
        height: size,
        alignSelf: "center",
        borderRadius: 22,
        backgroundColor: C.ink,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        boxShadow: OUTLINE.raisedShadow,
        overflow: "hidden",
      }}
    >
      {children}
      <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
        {CORNERS.map((corner, index) => (
          <View
            key={index}
            style={[
              {
                position: "absolute",
                width: CORNER,
                height: CORNER,
                borderWidth: CORNER_BORDER,
                borderColor: C.yellow,
              },
              corner,
            ]}
          />
        ))}
        <Animated.View
          style={{
            position: "absolute",
            left: BEAM_INSET,
            right: BEAM_INSET,
            top: BEAM_INSET,
            height: 3,
            borderRadius: 3,
            backgroundColor: C.yellow,
            boxShadow: `0 0 12px ${C.yellow}`,
            transform: [
              {
                translateY: travel.interpolate({
                  inputRange: [0, 1],
                  // From top: 30px to top: 100% - 33px, less the frame's border.
                  outputRange: [0, size - 2 * OUTLINE.width - BEAM_INSET - 33],
                }),
              },
            ],
          }}
        />
      </View>
    </View>
  );
}
