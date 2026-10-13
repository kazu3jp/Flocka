import { C } from "./theme";
import { selfClaimColor } from "./card-colors";
import React, { useEffect, useState, useId, useMemo } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { SvgXml } from "react-native-svg";
import vectors from "../vectors.json";

export function CardIllustration({
  cardKey,
  confirmed,
  selfOnly = false,
}: {
  cardKey: string;
  confirmed: boolean;
  selfOnly?: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(0)),
    [height, setHeight] = useState(100);
  const filterId = "artShadow" + useId().replace(/:/g, "");
  const xml = useMemo(() => {
    let source = (vectors.cards as Record<string, string>)[cardKey];
    if (selfOnly) source = source.replace(/#[0-9a-f]{6}/gi, selfClaimColor);
    return source
      .replace(
        /<svg[^>]*>/,
        (tag) =>
          `${tag}<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="3" stdDeviation="0" flood-color="${C.ink}" flood-opacity=".35" /></filter></defs><g filter="url(#${filterId})">`,
      )
      .replace("</svg>", "</g></svg>");
  }, [cardKey, selfOnly, filterId]);
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
        position: "absolute",
        width: "74%",
        height: "84%",
        maxWidth: 150,
        alignSelf: "center",
        top: "8%",
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
          : [{ rotate: "-3deg" }],
      }}
    >
      <SvgXml xml={xml} width="100%" height="100%" />
    </Animated.View>
  );
}
