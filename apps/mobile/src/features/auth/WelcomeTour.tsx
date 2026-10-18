import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, View } from "react-native";
import { CARDS, PEER_PROFILE, bareCard } from "@flocka/domain";
import {
  Avatar,
  C,
  F,
  Icon,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import Svg, { Path, Rect, Circle, Defs, Pattern } from "react-native-svg";

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
function TourCard({
  cardKey,
  confirmed = false,
  inPlayerCard = false,
  selected = false,
}: {
  cardKey: string;
  confirmed?: boolean;
  inPlayerCard?: boolean;
  selected?: boolean;
}) {
  return (
    <StrengthCard
      card={{
        ...bareCard(cardKey),
        ...CARDS[cardKey],
        self: !confirmed,
        confirmed,
        givers: confirmed ? ["a", "b"] : [],
      }}
      style={{
        flex: 1,
        width: "100%",
        marginTop: inPlayerCard ? 4 : 0,
        boxShadow: selected
          ? `0 0 0 4px ${C.yellow}, 4px 4px 0 ${C.ink}`
          : `3px 3px 0 ${C.ink}`,
      }}
    />
  );
}
function Scene({ scene, reduced }: { scene: string; reduced: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    progress.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, scene]);
  const enter = {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };
  if (scene === "exchange")
    return (
      <Animated.View
        accessible={false}
        style={[{ position: "absolute", inset: 0 }, enter]}
      >
        {[
          ["ソラ", "impl", "mock-b"],
          ["ミナト", "design", "mock-a"],
        ].map(([name, key, id], i) => (
          <Panel
            key={key}
            style={{
              position: "absolute",
              top: "12%",
              width: "40%",
              height: "76%",
              ...(i ? { right: "6%" } : { left: "6%" }),
              padding: 0,
              paddingHorizontal: 8,
              paddingBottom: 10,
              gap: 6,
              alignItems: "center",
              transform: [
                { translateX: i ? "-6%" : "6%" },
                { rotate: i ? "2deg" : "-2deg" },
              ],
            }}
          >
            <View
              style={{
                height: 18,
                marginHorizontal: -8,
                marginBottom: 4,
                backgroundColor: C.ink,
                alignSelf: "stretch",
              }}
            />
            <Avatar
              name={name}
              avatar={{ type: "motif", ...PEER_PROFILE[id].avatar }}
              size={44}
            />
            <T display color={C.ink} size={15} style={{ lineHeight: 15 }}>
              {name}
            </T>
            <TourCard cardKey={key} inPlayerCard />
          </Panel>
        ))}
        <View
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            marginLeft: -26,
            marginTop: -26,
            width: 52,
            height: 52,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `3px 3px 0 ${C.ink}`,
            borderRadius: 26,
            backgroundColor: C.yellow,
            borderWidth: 2.5,
            borderColor: C.ink,
          }}
        >
          <Icon name="swap" color={C.ink} size={26} />
        </View>
      </Animated.View>
    );
  if (scene === "guess")
    return (
      <Animated.View
        accessible={false}
        style={[{ position: "absolute", inset: 0 }, enter]}
      >
        <View
          style={{
            position: "absolute",
            width: "46%",
            left: "27%",
            top: "10%",
            aspectRatio: 44 / 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 44 32"
            style={{ filter: `drop-shadow(4px 4px 0 ${C.ink})` }}
          >
            <Rect
              x={1.5}
              y={1.5}
              width={41}
              height={29}
              rx={4}
              fill={C.paper}
              stroke={C.ink}
              strokeWidth={2.5}
            />
            <Path
              d="M3 4l19 13L41 4"
              stroke={C.ink}
              strokeWidth={2.5}
              fill="none"
            />
          </Svg>
          <View
            style={{
              position: "absolute",
              left: "50%",
              top: "52%",
              marginLeft: -20,
              marginTop: -20,
              borderRadius: 20,
              borderWidth: 2.5,
              borderColor: C.ink,
              backgroundColor: C.pink,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T display size={22} color={C.ink}>
              ?
            </T>
          </View>
        </View>
        <View
          style={[
            S.row,
            {
              position: "absolute",
              left: "5%",
              right: "5%",
              bottom: "8%",
              height: "46%",
              alignItems: "stretch",
              gap: 8,
            },
          ]}
        >
          {["bridge", "warm", "idea"].map((key, index) => (
            <View
              key={key}
              style={[
                S.fill,
                index === 0 && {
                  transform: [{ translateY: -10 }, { rotate: "-2deg" }],
                },
              ]}
            >
              <TourCard cardKey={key} selected={index === 0} />
            </View>
          ))}
        </View>
      </Animated.View>
    );
  return (
    <Animated.View
      accessible={false}
      style={[{ position: "absolute", inset: 0 }, enter]}
    >
      <View
        style={{
          position: "absolute",
          left: "7%",
          top: "14%",
          width: "46%",
          height: "72%",
        }}
      >
        <TourCard cardKey="bridge" confirmed />
      </View>
      <Panel
        style={{
          position: "absolute",
          right: "6%",
          top: "22%",
          width: "40%",
          height: "58%",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 14,
          gap: 9,
          transform: [{ rotate: "3deg" }],
        }}
      >
        <T display color={C.ink} size={14} style={{ lineHeight: 14 }}>
          自己PR
        </T>
        {[100, 88, 94, 60].map((width, i) => (
          <View
            key={width}
            style={{
              height: 7,
              borderRadius: 4,
              width: `${width}%`,
              backgroundColor: i === 0 ? C.yellow : C.grey,
            }}
          />
        ))}
      </Panel>
    </Animated.View>
  );
}
export function WelcomeTour() {
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
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % TOUR.length),
      3600,
    );
    return () => clearTimeout(timer);
  }, [index, paused, reduced]);
  const item = TOUR[index];
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
        <Scene scene={item.key} reduced={reduced} />
      </Pressable>
      <View
        style={{ gap: 6 }}
        accessibilityLiveRegion={paused ? "polite" : "none"}
      >
        <T
          size={12}
          color={C.yellow}
          style={{ fontFamily: F.bold, lineHeight: 16.8, letterSpacing: 0.96 }}
        >
          {String(index + 1).padStart(2, "0")}
          <T size={12} color={C.pale} style={{ fontFamily: F.bold }}>
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
      </View>
      <View style={[S.row, { gap: 8 }]}>
        {TOUR.map((item, i) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}枚目：${item.title}`}
            accessibilityState={{ selected: index === i }}
            aria-current={index === i ? "true" : undefined}
            onPress={() => {
              setIndex(i);
              setPaused(true);
            }}
            style={{ width: 44, minHeight: 24, justifyContent: "center" }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 9,
                backgroundColor: i === index ? C.yellow : C.dark,
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
