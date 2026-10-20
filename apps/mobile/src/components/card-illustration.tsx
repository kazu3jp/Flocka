import { C } from "./theme";
import { selfClaimColor } from "./card-colors";
import React, { memo, useEffect, useState, useId, useMemo } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import { CachedSvgXml } from "./cached-svg-xml";
import vectors from "../vectors.json";

/** `artHeight` is the art box the card already measures; this view is 84% of it. */
export const CardIllustration = memo(function CardIllustration({
  cardKey,
  confirmed,
  selfOnly = false,
  artHeight,
}: {
  cardKey: string;
  confirmed: boolean;
  selfOnly?: boolean;
  artHeight: number;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const floatDistance = artHeight * 0.84 * 0.05;
  const instanceId = useId().replace(/:/g, "");
  // Native SVG roots scope their own filters, so identical artwork can share one parse.
  const filterId = "artShadow" + (Platform.OS === "web" ? instanceId : "");
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
        isInteraction: false,
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
  const transform = useMemo(
    () =>
      confirmed
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
                outputRange: [0, -floatDistance],
              }),
            },
          ]
        : [{ rotate: "-3deg" }],
    [confirmed, progress, floatDistance],
  );
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: "74%",
        height: "84%",
        maxWidth: 150,
        alignSelf: "center",
        top: "8%",
        transform,
      }}
    >
      <CachedSvgXml xml={xml} width="100%" height="100%" />
    </Animated.View>
  );
});
