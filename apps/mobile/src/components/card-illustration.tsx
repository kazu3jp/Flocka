import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { SvgXml } from "react-native-svg";
import vectors from "../vectors.json";

export function CardIllustration({
  cardKey,
  confirmed,
}: {
  cardKey: string;
  confirmed: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(0)),
    [height, setHeight] = useState(100);
  useEffect(() => {
    let active = true,
      loop: Animated.CompositeAnimation | undefined;
    const configure = (reduced: boolean) => {
      loop?.stop();
      progress.setValue(0);
      if (!active || !confirmed || reduced) return;
      const motion = {
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      };
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, { ...motion, toValue: 1 }),
          Animated.timing(progress, { ...motion, toValue: 0 }),
        ]),
      );
      loop.start();
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(configure);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      configure,
    );
    return () => {
      active = false;
      loop?.stop();
      listener.remove();
    };
  }, [confirmed, progress]);
  return (
    <Animated.View
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={{
        flex: 1,
        padding: 10,
        transform: confirmed
          ? [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-3deg", "2deg"],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -height * 0.05],
                }),
              },
            ]
          : [],
      }}
    >
      <SvgXml
        xml={(vectors.cards as Record<string, string>)[cardKey]}
        width="100%"
        height="100%"
      />
    </Animated.View>
  );
}
