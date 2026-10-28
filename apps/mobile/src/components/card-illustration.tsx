import { selfClaimColor } from "./card-colors";
import React, { memo, useEffect, useState, useMemo } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { DropShadowSvg } from "./drop-shadow-svg";
import vectors from "../vectors.json";

// The source's drop-shadow(2px 3px 0 ink / .35) on card artwork.
const ART_SHADOW = { dx: 2, dy: 3, opacity: 0.35 };

/**
 * `artHeight` is the art box the card already measures; `size` is the square
 * the card leaves the illustration, centered in that box.
 */
export const CardIllustration = memo(function CardIllustration({
  cardKey,
  confirmed,
  selfOnly = false,
  artHeight,
  size,
}: {
  cardKey: string;
  confirmed: boolean;
  selfOnly?: boolean;
  artHeight: number;
  size: number;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const floatDistance = artHeight * 0.84 * 0.05;
  const xml = useMemo(() => {
    const source = (vectors.cards as Record<string, string>)[cardKey];
    return selfOnly ? source.replace(/#[0-9a-f]{6}/gi, selfClaimColor) : source;
  }, [cardKey, selfOnly]);
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
        width: size,
        height: size,
        alignSelf: "center",
        top: (artHeight - size) / 2,
        transform,
      }}
    >
      <DropShadowSvg xml={xml} shadow={ART_SHADOW} />
    </Animated.View>
  );
});
