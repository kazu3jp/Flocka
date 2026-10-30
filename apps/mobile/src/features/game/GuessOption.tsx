import React, { useEffect, useState } from "react";
import { Animated, View, ActivityIndicator } from "react-native";
import { bareCard } from "@flocka/domain";
import { C, StrengthCard } from "../../components/ui";
import { MOTION_EASE, MOTION_MS, NATIVE_DRIVER } from "../../components/motion";

export function GuessOption({
  cardKey,
  self,
  chosen,
  hasChoice,
  busy,
  locked,
  height,
  reduced,
  onPress,
}: {
  cardKey: string;
  self: boolean;
  chosen: boolean;
  hasChoice: boolean;
  busy: boolean;
  locked: boolean;
  height: number;
  reduced: boolean;
  onPress: () => void;
}) {
  const [selection] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const value = chosen ? 1 : 0,
      alpha = hasChoice && !chosen ? 0.35 : 1;
    if (reduced) {
      selection.setValue(value);
      opacity.setValue(alpha);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(selection, {
        toValue: value,
        duration: MOTION_MS.select,
        easing: MOTION_EASE,
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(opacity, {
        toValue: alpha,
        duration: MOTION_MS.select,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [chosen, hasChoice, opacity, reduced, selection]);
  return (
    <Animated.View
      accessibilityState={{
        selected: chosen,
        disabled: locked,
        busy: chosen && busy,
      }}
      style={{
        flex: 1,
        height,
        opacity,
        transform: [
          {
            translateY: selection.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -8],
            }),
          },
          {
            rotate: selection.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "-2deg"],
            }),
          },
        ],
      }}
    >
      <StrengthCard
        card={bareCard(cardKey, self)}
        style={{ flex: 1 }}
        onPress={locked ? undefined : onPress}
      />
      {chosen && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -4,
            right: -4,
            top: -4,
            bottom: -4,
            borderWidth: 3,
            borderColor: C.yellow,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy && <ActivityIndicator color={C.yellow} />}
        </View>
      )}
    </Animated.View>
  );
}
