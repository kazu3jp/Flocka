import { selfClaimColor } from "./card-colors";
import { CardIllustration } from "./card-illustration";
import React, { useId, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  Pattern,
  Rect,
  RadialGradient,
  Stop,
  SvgXml,
} from "react-native-svg";
import { ART_COLORS, type Card } from "@flocka/domain";
import vectors from "../vectors.json";
import { C, F, S } from "./theme";
import { T } from "./text";

function CardPattern({
  card,
  selfOnly,
  width,
  height,
}: {
  card: Card;
  selfOnly: boolean;
  width: number;
  height: number;
}) {
  const pattern = card.deco?.pattern || "burst",
    id = "pattern" + useId().replace(/:/g, "");
  const palette =
    ART_COLORS["deco-" + card.deco?.color] || ART_COLORS[card.key];
  const { base, shade, shade2, light } = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [
      key,
      selfOnly ? selfClaimColor(value) : value,
    ]),
  );
  const tile: Record<string, [number, number]> = {
    dots: [14, 14],
    grid: [12, 12],
    stripes: [28, 28],
    check: [20, 20],
    diamonds: [24, 24],
    rings: [22, 22],
    zigzag: [20, 20],
    confetti: [24, 28],
    lines: [12, 12],
    cross: [18, 18],
  };
  const [tileWidth, tileHeight] = tile[pattern] || [20, 20];
  let motif: React.ReactNode;
  if (pattern === "dots")
    motif = <Circle cx={7} cy={7} r={3.2} fill={shade2} />;
  else if (pattern === "grid")
    motif = (
      <Path d="M12 0H0V12" stroke={shade2} fill="none" strokeWidth={1.5} />
    );
  else if (pattern === "stripes")
    motif = (
      <Path
        d="M-7 7L7-7 M0 28L28 0 M21 35L35 21"
        stroke={shade}
        strokeWidth={7}
      />
    );
  else if (pattern === "check")
    motif = (
      <>
        <Rect width={10} height={10} fill={shade2} />
        <Rect x={10} y={10} width={10} height={10} fill={shade2} />
      </>
    );
  else if (pattern === "diamonds")
    motif = <Path d="M12 0L24 12L12 24L0 12Z" fill={shade2} />;
  else if (pattern === "rings")
    motif = (
      <Circle
        cx={11}
        cy={11}
        r={5.6}
        stroke={shade2}
        strokeWidth={2}
        fill="none"
      />
    );
  else if (pattern === "zigzag")
    motif = <Path d="M0 0L10 10L20 0Z" fill={shade2} />;
  else if (pattern === "confetti")
    motif = (
      <>
        <Circle cx={6} cy={8} r={3} fill={shade2} />
        <Circle cx={18} cy={20} r={3} fill={light} />
      </>
    );
  else if (pattern === "lines")
    motif = (
      <Line x1={0} y1={2} x2={12} y2={2} stroke={shade2} strokeWidth={3} />
    );
  else if (pattern === "cross")
    motif = <Path d="M0 0L18 18M18 0L0 18" stroke={shade2} strokeWidth={2} />;
  const cx = width * 0.5,
    cy = height * 0.62;
  const radius = Math.hypot(width * 0.5, height * 0.62);
  const rays = Array.from({ length: 20 }, (_, i) => {
    const a = (i * 18 * Math.PI) / 180,
      b = ((i * 18 + 9) * Math.PI) / 180;
    return (
      <Path
        key={i}
        d={`M${cx} ${cy} L${cx + radius * 2 * Math.sin(a)} ${cy - radius * 2 * Math.cos(a)} L${cx + radius * 2 * Math.sin(b)} ${cy - radius * 2 * Math.cos(b)} Z`}
        fill={shade}
      />
    );
  });
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={pattern === "burst" ? `0 0 ${width} ${height}` : undefined}
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      <Rect width="100%" height="100%" fill={base} />
      {pattern === "burst" ? (
        <>
          <Circle cx={cx} cy={cy} r={radius * 0.28} fill={light} />
          {rays}
        </>
      ) : pattern !== "plain" ? (
        <>
          <Defs>
            <Pattern
              id={id}
              width={tileWidth}
              height={tileHeight}
              patternUnits="userSpaceOnUse"
            >
              {motif}
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      ) : null}
    </Svg>
  );
}

export function StrengthCard({
  card,
  onPress,
  style,
  large = false,
}: {
  card: Card;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  large?: boolean;
}) {
  const color = card.confirmed
    ? C.yellow
    : card.discovered
      ? C.pink
      : card.testimonies.length
        ? C.lime
        : C.grey;
  const status = card.confirmed
    ? "確認済み"
    : card.discovered
      ? "新発見"
      : card.testimonies.length
        ? `証言${card.givers.length}`
        : "自己申告";
  const frame = card.deco?.frame || "none";
  const frameColor = ["mint", "tape"].includes(frame)
    ? C.lime
    : frame === "ribbon"
      ? C.pink
      : C.ink;
  const frameId = "frame" + useId().replace(/:/g, "");
  const selfOnly = status === "自己申告";
  const [cardHeight, setCardHeight] = useState(0);
  const [artSize, setArtSize] = useState({ width: 100, height: 100 });
  const showFlavor = large || cardHeight >= 225;
  const nameSize = large
    ? 18
    : Math.max(13, Math.min(18, (cardHeight - 5) * 0.09));
  const corners = [
    { bottom: 0, right: 0 },
    { bottom: 0, left: 0 },
    { top: 0, right: 0 },
    { top: 0, left: 0 },
  ];
  const inner = (
    <>
      {selfOnly && (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id={frameId + "paper"}
              width={12.7279}
              height={12.7279}
              patternUnits="userSpaceOnUse"
            >
              <Path
                d="M-6.364 6.364L6.364-6.364 M0 12.7279L12.7279 0 M6.364 19.092L19.092 6.364"
                stroke={C.paper2}
                strokeWidth={1}
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${frameId}paper)`} />
        </Svg>
      )}
      {frame === "stars" && (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id={frameId}
              width={12}
              height={12}
              patternUnits="userSpaceOnUse"
            >
              <Path
                d="M3 0 3.9 2.1 6 3 3.9 3.9 3 6 2.1 3.9 0 3 2.1 2.1Z"
                fill={C.yellow}
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${frameId})`} />
        </Svg>
      )}
      <View
        style={{
          backgroundColor: color,
          paddingHorizontal: 8,
          minHeight: 26,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 2.5,
          borderColor: C.ink,
          justifyContent: "space-between",
        }}
      >
        <T size={11.5} color={C.ink} style={{ fontFamily: F.bold }}>
          {status}
        </T>
        {card.self && !selfOnly && (
          <T size={11.5} color={C.ink} style={{ fontFamily: F.bold }}>
            自分も選んだ
          </T>
        )}
      </View>
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          const next = {
            width: Math.max(1, width - 4),
            height: Math.max(1, height - 4),
          };
          if (next.width !== artSize.width || next.height !== artSize.height)
            setArtSize(next);
        }}
        style={{
          flex: 1,
          minHeight: 0,
          margin: 6,
          marginBottom: 0,
          borderWidth: 2,
          borderStyle: "solid",
          borderColor: C.ink,
          borderRadius: 9,
          overflow: "hidden",
        }}
      >
        <CardPattern card={card} selfOnly={selfOnly} {...artSize} />
        <View style={{ position: "absolute", left: 5, top: 4 }}>
          <T
            color={C.ink}
            size={10}
            style={{
              fontFamily: F.bold,
              lineHeight: 13,
              backgroundColor: C.paper,
              borderWidth: 1.5,
              borderColor: C.ink,
              borderRadius: 5,
              paddingHorizontal: 5,
              paddingVertical: 1,
            }}
          >
            No.{String(card.no).padStart(2, "0")}
          </T>
        </View>
        <CardIllustration
          cardKey={card.key}
          confirmed={card.confirmed}
          selfOnly={selfOnly}
        />
        {frame === "tape" &&
          [0, 1].map((i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                ...(i ? { bottom: 6, left: -14 } : { top: 6, right: -14 }),
                width: 54,
                height: 20,
                backgroundColor: C.lime,
                borderWidth: 2,
                borderColor: C.ink,
                transform: [{ rotate: "35deg" }],
              }}
            />
          ))}
        {card.confirmed && card.discovered && (
          <T
            display
            color={C.stampInk}
            size={11}
            style={{
              position: "absolute",
              right: 6,
              top: 6,
              transform: [{ rotate: "10deg" }],
              backgroundColor: "rgba(255,255,255,0.7)",
              borderWidth: 2,
              borderColor: C.stampBorder,
              borderRadius: 6,
              paddingVertical: 3,
              paddingHorizontal: 6,
              lineHeight: 13.2,
            }}
          >
            新発見
          </T>
        )}
        {card.deco?.stickers.map((k, i) => {
          const layout = card.deco?.layout?.[k];
          const ci = layout
            ? ["br", "bl", "tr", "tl"].indexOf(layout.position)
            : i;
          return (
            <View
              key={k}
              style={{
                position: "absolute",
                ...(corners[ci] || corners[i]),
                width: `${layout?.size || 23}%`,
                aspectRatio: 1,
                transform: [
                  { rotate: `${layout?.angle || (i % 2 ? -12 : 12)}deg` },
                ],
              }}
            >
              <SvgXml
                xml={(vectors.stickers as Record<string, string>)[k]}
                width="100%"
                height="100%"
              />
            </View>
          );
        })}
      </View>
      <T
        display
        color={C.ink}
        size={nameSize}
        style={{
          paddingHorizontal: 8,
          paddingTop: 5,
          lineHeight: nameSize * 1.3,
          backgroundColor: frame === "stars" ? C.paper : undefined,
        }}
      >
        {card.name}
      </T>
      {showFlavor && (
        <T
          color={C.muted}
          size={12}
          style={{
            paddingHorizontal: 8,
            paddingTop: 2,
            backgroundColor: frame === "stars" ? C.paper : undefined,
          }}
        >
          {card.flavor}
        </T>
      )}
      <View
        style={{
          flexDirection: "row",
          gap: 4,
          alignItems: "center",
          paddingHorizontal: 8,
          paddingBottom: 7,
          paddingTop: 3,
          backgroundColor: frame === "stars" ? C.paper : undefined,
        }}
      >
        {[0, 1].map((i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: C.ink,
              backgroundColor: i < card.givers.length ? C.ink : "transparent",
            }}
          />
        ))}
        <T
          color={C.muted}
          size={11.5}
          style={{ fontFamily: F.bold, lineHeight: 19 }}
        >
          証言{card.givers.length}/2
        </T>
      </View>
      {frame === "dash" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 3,
            borderWidth: 3,
            borderColor: C.pink,
            borderStyle: "dashed",
            borderRadius: 9,
          }}
        />
      )}
      {frame === "double" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 3,
            borderWidth: 3,
            borderColor: C.ink,
            borderRadius: 9,
          }}
        />
      )}
      {["mint", "ribbon", "tape", "pixel", "ticket"].includes(frame) && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            borderWidth: 2,
            borderColor: ["pixel", "ticket"].includes(frame) ? C.yellow : C.ink,
            borderRadius: frame === "pixel" ? 0 : 5,
          }}
        />
      )}
    </>
  );
  const container: ViewStyle = {
    backgroundColor:
      frame === "stars" ? C.ink : card.confirmed ? C.confirmedPaper : C.paper,
    borderWidth: ["ribbon", "mint", "pixel"].includes(frame)
      ? 5
      : ["tape", "ticket"].includes(frame)
        ? 4
        : 2.5,
    borderColor: frameColor,
    borderStyle:
      frame === "pixel"
        ? "dotted"
        : frame === "ticket" || (selfOnly && frame === "none")
          ? "dashed"
          : "solid",
    borderRadius: frame === "pixel" ? 0 : frame === "ticket" ? 7 : 14,
    padding: ["stars", "dash", "double"].includes(frame)
      ? 6
      : ["ticket", "ribbon", "mint", "pixel", "notebook"].includes(frame)
        ? 3
        : 0,
    ...(frame === "notebook"
      ? { borderLeftWidth: 7, borderLeftColor: C.pink }
      : {}),
    overflow: "hidden",
    boxShadow: selfOnly && frame === "none" ? "none" : `3px 3px 0 ${C.ink}`,
  };
  return onPress ? (
    <Pressable
      testID={`strength-card-${card.key}`}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}・${status}`}
      onPress={onPress}
      onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      style={({ pressed }) => [
        container,
        pressed && { transform: [{ translateY: -2 }, { rotate: "-.6deg" }] },
        style,
      ]}
    >
      {inner}
    </Pressable>
  ) : (
    <View
      testID={`strength-card-${card.key}`}
      onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      style={[container, style]}
    >
      {inner}
    </View>
  );
}

export function LockedCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState({ width: 100, height: 100 });
  const gradientId = "lockedCenter" + useId().replace(/:/g, "");
  const diagonal = Math.hypot(size.width, size.height) / 2;
  const stripeCount = Math.ceil((size.width + size.height) / Math.SQRT2 / 20);
  return (
    <View
      accessibilityLabel="未発見のカード"
      onLayout={({ nativeEvent: { layout } }) => {
        const width = Math.max(1, layout.width - 5);
        const height = Math.max(1, layout.height - 5);
        setSize((previous) =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
      }}
      style={[
        {
          borderWidth: 2.5,
          borderColor: C.ink,
          borderRadius: 14,
          backgroundColor: C.dark,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `3px 3px 0 ${C.ink}`,
        },
        style,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            cx={size.width / 2}
            cy={size.height / 2}
            r={diagonal}
          >
            <Stop offset="38%" stopColor={C.lockedCenter} />
            <Stop offset="39%" stopColor={C.lockedCenter} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        {Array.from({ length: stripeCount }, (_, index) => {
          // CSS repeating-linear-gradient(45deg, color 0 10px, transparent 10px 20px).
          const start = Math.SQRT2 * (index * 20 + 5) - size.height;
          return (
            <Line
              key={index}
              x1={start - 20}
              y1={-20}
              x2={start + size.height + 20}
              y2={size.height + 20}
              stroke={C.lockedStripe}
              strokeWidth={10}
            />
          );
        })}
      </Svg>
      <View
        style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderWidth: 2,
          borderColor: C.ink,
          borderRadius: 12,
          backgroundColor: C.ink,
          alignItems: "center",
        }}
      >
        <T display size={30} color={C.yellow} style={{ lineHeight: 30 }}>
          ?
        </T>
        <T
          size={11.5}
          style={{ fontFamily: F.bold, lineHeight: 18.975, marginTop: 6 }}
        >
          未発見
        </T>
      </View>
    </View>
  );
}

export function ResponsiveCards({
  cards,
  onPress,
}: {
  cards: Card[];
  onPress?: (k: string) => void;
}) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 460);
  return (
    <View style={S.grid}>
      {cards.map((c) => (
        <StrengthCard
          key={c.key}
          card={c}
          onPress={onPress ? () => onPress(c.key) : undefined}
          style={{ width: (w - 38) / 2, height: 220 }}
        />
      ))}
    </View>
  );
}
