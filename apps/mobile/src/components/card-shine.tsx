import React, { useEffect, useId, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/** The original .gcard .shine: 115 degrees, 400ms delay, two 1.4s passes. */
export function CardShine() {
  const [{ width, height }, setSize] = useState({ width: 1, height: 1 });
  const [reduced, setReduced] = useState(true);
  const [position] = useState(() => new Animated.Value(-120));
  const gradientId = "card-shine-" + useId().replace(/:/g, "");
  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (reduced) {
      position.setValue(120);
      return;
    }
    position.setValue(-120);
    const animation = Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.timing(position, {
          toValue: 120,
          duration: 1400,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: Platform.OS !== "web",
          isInteraction: false,
        }),
        { iterations: 2 },
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [position, reduced]);
  if (reduced) return null;

  // CSS gradients span the projection of all four corners onto their axis.
  const angle = (115 * Math.PI) / 180;
  const dx = Math.sin(angle),
    dy = -Math.cos(angle);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  return (
    <Animated.View
      testID="card-shine"
      onLayout={({ nativeEvent }) =>
        setSize((current) =>
          current.width === nativeEvent.layout.width &&
          current.height === nativeEvent.layout.height
            ? current
            : {
                width: nativeEvent.layout.width,
                height: nativeEvent.layout.height,
              },
        )
      }
      pointerEvents="none"
      accessible={false}
      style={{
        position: "absolute",
        inset: 0,
        transform: [
          {
            translateX: position.interpolate({
              inputRange: [-120, 120],
              outputRange:
                Platform.OS === "web"
                  ? ["-120%", "120%"]
                  : [-width * 1.2, width * 1.2],
            }),
          },
        ],
      }}
    >
      {width > 0 && height > 0 && (
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={(width - dx * length) / 2}
              y1={(height - dy * length) / 2}
              x2={(width + dx * length) / 2}
              y2={(height + dy * length) / 2}
            >
              <Stop offset="35%" stopColor="#fff" stopOpacity={0} />
              <Stop offset="48%" stopColor="#fff" stopOpacity={0.65} />
              <Stop offset="60%" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${gradientId})`} />
        </Svg>
      )}
    </Animated.View>
  );
}
