import React, { useEffect, useState } from "react";
import { Animated, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, OUTLINE, T } from "../../components/ui";
import { MOTION_EASE, NATIVE_DRIVER } from "../../components/motion";
import { GUESS_MOTION } from "./guess-motion";

/** The layered .env-back / .env-flap / .env-seal in the original design. */
export function GuessEnvelope({
  size,
  from,
  opening,
  reduced,
  onOpened,
}: {
  size: number;
  from: string;
  opening: boolean;
  reduced: boolean;
  onOpened: () => void;
}) {
  const [idle] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  const [flap] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(0));
  const height = size / 1.5,
    flapHeight = height * 0.58;
  useEffect(() => {
    if (reduced || opening) {
      idle.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, {
          toValue: 1,
          duration: 1400,
          easing: MOTION_EASE,
          useNativeDriver: NATIVE_DRIVER,
          isInteraction: false,
        }),
        Animated.timing(idle, {
          toValue: 0,
          duration: 1400,
          easing: MOTION_EASE,
          useNativeDriver: NATIVE_DRIVER,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [idle, opening, reduced]);
  useEffect(() => {
    if (!opening) return;
    if (reduced) {
      onOpened();
      return;
    }
    let active = true;
    const animation = Animated.sequence([
      Animated.timing(shake, {
        toValue: 1,
        duration: GUESS_MOTION.anticipation,
        useNativeDriver: NATIVE_DRIVER,
        isInteraction: false,
      }),
      Animated.timing(flap, {
        toValue: 1,
        duration: GUESS_MOTION.flap,
        easing: MOTION_EASE,
        useNativeDriver: NATIVE_DRIVER,
        isInteraction: false,
      }),
      Animated.timing(exit, {
        toValue: 1,
        duration: GUESS_MOTION.exit,
        easing: MOTION_EASE,
        useNativeDriver: NATIVE_DRIVER,
        isInteraction: false,
      }),
    ]);
    animation.start(({ finished }) => {
      if (active && finished) onOpened();
    });
    return () => {
      active = false;
      animation.stop();
    };
  }, [opening, reduced, onOpened, shake, flap, exit]);
  return (
    <Animated.View
      testID="guess-envelope"
      style={{
        alignSelf: "center",
        width: size,
        height,
        marginTop: 18,
        marginBottom: 12,
        opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          {
            translateY: Animated.add(
              idle.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
              exit.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }),
            ),
          },
          {
            rotate: shake.interpolate({
              inputRange: [0, 0.15, 0.35, 0.55, 0.75, 1],
              outputRange: ["0deg", "-4deg", "4deg", "-3deg", "2deg", "0deg"],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: C.paper,
          borderWidth: OUTLINE.width,
          borderColor: C.ink,
          borderRadius: 12,
          boxShadow: OUTLINE.shadow,
        }}
      />
      <Animated.View
        testID="guess-envelope-flap"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: flapHeight,
          transform: [
            { translateY: -flapHeight / 2 },
            {
              scaleY: flap.interpolate({
                inputRange: [0, 1],
                outputRange: [1, -1],
              }),
            },
            { translateY: flapHeight / 2 },
          ],
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 58"
          preserveAspectRatio="none"
        >
          <Path
            d="M1 1 L50 56 L99 1"
            fill={C.paper2}
            stroke={C.ink}
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        testID="guess-envelope-seal"
        style={{
          position: "absolute",
          top: height / 2 - 27,
          left: size / 2 - 27,
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: C.pink,
          borderWidth: OUTLINE.width,
          borderColor: C.ink,
          alignItems: "center",
          justifyContent: "center",
          opacity: flap.interpolate({
            inputRange: [0, 0.75],
            outputRange: [1, 0],
            extrapolate: "clamp",
          }),
          transform: [
            {
              scale: flap.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.3],
              }),
            },
            {
              rotate: flap.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "-60deg"],
              }),
            },
          ],
        }}
      >
        <T display size={24} color={C.ink}>
          ?
        </T>
      </Animated.View>
      <T
        display
        size={15}
        color={C.ink}
        numberOfLines={1}
        style={{ position: "absolute", left: 14, right: 14, bottom: 10 }}
      >
        {from}より
      </T>
    </Animated.View>
  );
}
