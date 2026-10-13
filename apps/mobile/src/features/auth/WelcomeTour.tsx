import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, View } from "react-native";
import { CARDS, PEER_PROFILE, bareCard } from "@flocka/domain";
import {
  Avatar,
  C,
  Icon,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import Svg, { Path, Rect } from "react-native-svg";

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
}: {
  cardKey: string;
  confirmed?: boolean;
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
      style={{ flex: 1, width: "100%" }}
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
        style={[S.row, { flex: 1, padding: 18, gap: 16 }, enter]}
      >
        {[
          ["ソラ", "impl", "mock-b"],
          ["ミナト", "design", "mock-a"],
        ].map(([name, key, id], i) => (
          <Panel
            key={key}
            style={{
              flex: 1,
              height: "86%",
              padding: 8,
              gap: 6,
              alignItems: "center",
              transform: [{ rotate: i ? "5deg" : "-5deg" }],
            }}
          >
            <View
              style={{
                height: 14,
                backgroundColor: C.ink,
                alignSelf: "stretch",
                borderRadius: 4,
              }}
            />
            <Avatar
              name={name}
              avatar={{ type: "motif", ...PEER_PROFILE[id].avatar }}
              size={40}
            />
            <T display color={C.ink} size={15}>
              {name}
            </T>
            <TourCard cardKey={key} />
          </Panel>
        ))}
        <View
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: -25,
            borderRadius: 26,
            backgroundColor: C.yellow,
            borderWidth: 2.5,
            borderColor: C.ink,
            padding: 11,
          }}
        >
          <Icon name="swap" color={C.ink} />
        </View>
      </Animated.View>
    );
  if (scene === "guess")
    return (
      <Animated.View
        accessible={false}
        style={[{ flex: 1, padding: 20, gap: 14, alignItems: "center" }, enter]}
      >
        <View
          style={{
            width: "46%",
            height: 110,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 44 32">
            <Rect
              x={1.5}
              y={1.5}
              width={41}
              height={29}
              rx={3}
              fill={C.paper}
              stroke={C.ink}
              strokeWidth={2.5}
            />
            <Path
              d="M2 3L22 19L42 3M2 30L16 16M42 30L28 16"
              stroke={C.ink}
              strokeWidth={2}
              fill="none"
            />
          </Svg>
          <View
            style={{
              position: "absolute",
              borderRadius: 24,
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
        <View style={[S.row, { flex: 1, alignItems: "stretch", gap: 8 }]}>
          {["bridge", "warm", "idea"].map((key) => (
            <View key={key} style={S.fill}>
              <TourCard cardKey={key} />
            </View>
          ))}
        </View>
      </Animated.View>
    );
  return (
    <Animated.View
      accessible={false}
      style={[S.row, { flex: 1, padding: 20, gap: 16 }, enter]}
    >
      <View
        style={{ flex: 1.1, height: "78%", transform: [{ rotate: "-4deg" }] }}
      >
        <TourCard cardKey="bridge" confirmed />
      </View>
      <Panel
        style={{
          flex: 1,
          height: "60%",
          padding: 12,
          gap: 10,
          transform: [{ rotate: "3deg" }],
        }}
      >
        <T display color={C.ink} size={14}>
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
    <View style={{ flex: 1, gap: 14, minHeight: 430 }}>
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
        <Scene scene={item.key} reduced={reduced} />
      </Pressable>
      <View
        style={{ gap: 6 }}
        accessibilityLiveRegion={paused ? "polite" : "none"}
      >
        <T size={12} color={C.pale}>
          {String(index + 1).padStart(2, "0")} ／ {item.label}
        </T>
        <T display size={22}>
          {item.title}
        </T>
        <T size={13} color={C.pale}>
          {item.lead}
        </T>
      </View>
      <View style={S.row}>
        {TOUR.map((item, i) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}枚目：${item.title}`}
            accessibilityState={{ selected: index === i }}
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
