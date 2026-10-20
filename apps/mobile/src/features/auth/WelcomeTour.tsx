import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { C, F, S, T } from "../../components/ui";
import { eased, tourEasing, useTourMotion } from "./use-tour-motion";
import { TourScene } from "./tour-scenes";

const TOUR = [
  {
    key: "exchange",
    label: "交換",
    title: "会った人と、カードを交換",
    lead: "近くの人やQRで、プレイヤーカードを見せ合います。",
  },
  {
    key: "guess",
    label: "予想",
    title: "届いた封筒の中身を予想",
    lead: "仲間の印象が、どの強みの証言か当ててから開けます。",
  },
  {
    key: "pr",
    label: "自己PR",
    title: "2人の証言で、確認済みに",
    lead: "確認済みカードから、自己PRの下書きができあがります。",
  },
];
export function WelcomeTour() {
  const manuallyPaused = useRef(false);
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (paused || reduced) return;
    const timer = setTimeout(() => {
      if (!manuallyPaused.current) setIndex((i) => (i + 1) % TOUR.length);
    }, 3600);
    return () => clearTimeout(timer);
  }, [index, paused, reduced]);
  const item = TOUR[index];
  const copy = useTourMotion("copy", reduced, index);
  const bar = useTourMotion("bar", reduced, index, 0, paused);
  return (
    <View
      style={{ flex: 1, gap: 18, minHeight: 0, marginTop: 4, marginBottom: 16 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="次の説明を見る"
        onPress={() => setIndex((i) => (i + 1) % TOUR.length)}
        style={{
          flex: 1,
          minHeight: 260,
          maxHeight: 470,
          backgroundColor: C.dark,
          borderRadius: 22,
          borderWidth: 2.5,
          borderColor: C.ink,
          boxShadow: `4px 4px 0 ${C.ink}`,
          overflow: "hidden",
        }}
      >
        <Svg
          width="100%"
          height="100%"
          pointerEvents="none"
          style={{ position: "absolute", inset: 0 }}
        >
          <Defs>
            <Pattern
              id="tourDots"
              width={16}
              height={16}
              patternUnits="userSpaceOnUse"
            >
              <Circle cx={8} cy={8} r={1.2} fill="#ffffff" fillOpacity={0.08} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#tourDots)" />
        </Svg>
        <TourScene key={item.key} scene={item.key} reduced={reduced} />
      </Pressable>
      <Animated.View
        style={{
          gap: 6,
          opacity: copy.interpolate(
            eased(tourEasing.ease, {
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          ),
          transform: [
            {
              translateY: copy.interpolate(
                eased(tourEasing.ease, {
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              ),
            },
          ],
        }}
        accessibilityLiveRegion={paused ? "polite" : "none"}
      >
        <T
          size={12}
          color={C.yellow}
          style={{ fontFamily: F.bold, lineHeight: 16.8, letterSpacing: 0.96 }}
        >
          {String(index + 1).padStart(2, "0")}
          <T
            size={12}
            color={C.pale}
            style={{ fontFamily: F.bold, lineHeight: 16.8 }}
          >
            {" "}
            ／{" "}
          </T>
          {item.label}
        </T>
        <T display size={22} style={{ lineHeight: 30.8 }}>
          {item.title}
        </T>
        <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
          {item.lead}
        </T>
      </Animated.View>
      <View style={[S.row, { gap: 8 }]}>
        {TOUR.map((item, i) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}枚目：${item.title}`}
            accessibilityState={{ selected: index === i }}
            aria-current={index === i ? "true" : undefined}
            onPress={() => {
              manuallyPaused.current = true;
              setIndex(i);
              setPaused(true);
            }}
            style={{ width: 44, minHeight: 24, justifyContent: "center" }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 9,
                backgroundColor: C.dark,
              }}
            >
              {i === index && (
                <Animated.View
                  testID="tour-progress"
                  style={{
                    height: 6,
                    borderRadius: 9,
                    backgroundColor: C.yellow,
                    transformOrigin: "left",
                    transform: [{ scaleX: bar }],
                  }}
                />
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
