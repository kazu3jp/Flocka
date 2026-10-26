import { CardShine } from "./card-shine";
import { StickerArtwork } from "./sticker-artwork";
import { selfClaimColor } from "./card-colors";
import { CardIllustration } from "./card-illustration";
import React, { memo, useId, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  Pattern,
  Rect,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { ART_COLORS, type Card } from "@flocka/domain";
import { C, F, S } from "./theme";
import { T } from "./text";
import { SquishPressable } from "./motion";

/** Burst wedges alternate with gaps, so one path with 20 subpaths fills the same area. */
function burstRaysPath(cx: number, cy: number, radius: number) {
  let d = "";
  for (let i = 0; i < 20; i++) {
    const a = (i * 18 * Math.PI) / 180,
      b = ((i * 18 + 9) * Math.PI) / 180;
    d += `M${cx} ${cy} L${cx + radius * 2 * Math.sin(a)} ${cy - radius * 2 * Math.cos(a)} L${cx + radius * 2 * Math.sin(b)} ${cy - radius * 2 * Math.cos(b)} Z`;
  }
  return d;
}

// CSS -45deg stripes repeat every 14px along the gradient, starting at
// the bottom-right of the actual art box rather than at an arbitrary tile.
function stripeBandsPath(width: number, height: number) {
  let d = "";
  const count = Math.ceil((width + height) / (14 * Math.SQRT2)) + 1;
  for (let index = 0; index < count; index++) {
    const high = width + height - index * 14 * Math.SQRT2;
    const low = high - 7 * Math.SQRT2;
    d += `M${low} 0H${high}L${high - height} ${height}H${low - height}Z`;
  }
  return d;
}

export const CardPattern = memo(function CardPattern({
  card,
  selfOnly,
  width,
  height,
  swatch = false,
}: {
  card: Card;
  selfOnly: boolean;
  width: number;
  height: number;
  swatch?: boolean;
}) {
  const pattern = card.deco?.pattern || "burst",
    id = "pattern" + useId().replace(/:/g, "");
  const decoColor = card.deco?.color;
  const { base, shade, shade2, light } = useMemo(() => {
    const palette = ART_COLORS["deco-" + decoColor] || ART_COLORS[card.key];
    return Object.fromEntries(
      Object.entries(palette).map(([key, value]) => [
        key,
        selfOnly ? selfClaimColor(value) : value,
      ]),
    );
  }, [decoColor, card.key, selfOnly]);
  const tile: Record<string, [number, number]> = {
    dots: swatch ? [10, 10] : [14, 14],
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
    motif = (
      <Circle
        cx={swatch ? 5 : 7}
        cy={swatch ? 5 : 7}
        r={(swatch ? 10 : 14) * Math.SQRT2 * 0.115}
        fill={shade2}
      />
    );
  else if (pattern === "grid")
    motif = (
      <>
        <Rect width={12} height={1.5} fill={shade2} />
        <Rect width={1.5} height={12} fill={shade2} />
      </>
    );
  else if (pattern === "check")
    motif = (
      <>
        <Rect x={10} width={10} height={10} fill={shade2} />
        <Rect y={10} width={10} height={10} fill={shade2} />
      </>
    );
  else if (pattern === "diamonds")
    motif = <Path d="M0 0H24L12 12Z M0 24H24L12 12Z" fill={shade2} />;
  else if (pattern === "rings")
    motif = (
      <Circle
        cx={11}
        cy={11}
        r={5.756}
        stroke={shade2}
        strokeWidth={1.867}
        fill="none"
      />
    );
  else if (pattern === "zigzag")
    motif = <Path d="M0 0H10L0 10Z M10 0H20V10Z" fill={shade2} />;
  else if (pattern === "confetti")
    motif = (
      <>
        <Ellipse cx={6} cy={8.4} rx={3.31} ry={3.6} fill={shade2} />
        <Ellipse cx={18} cy={19.6} rx={3.31} ry={3.6} fill={light} />
      </>
    );
  else if (pattern === "lines")
    motif = <Rect y={9} width={12} height={3} fill={shade2} />;
  else if (pattern === "cross")
    motif = <Path d="M0 0L18 18M18 0L0 18" stroke={shade2} strokeWidth={2} />;
  const cx = width * 0.5,
    cy = height * (swatch ? 0.6 : 0.62);
  const radius = Math.hypot(width * 0.5, height * 0.62);
  const raysPath = useMemo(
    () => (pattern === "burst" ? burstRaysPath(cx, cy, radius) : ""),
    [pattern, cx, cy, radius],
  );
  const stripesPath = useMemo(
    () => (pattern === "stripes" ? stripeBandsPath(width, height) : ""),
    [pattern, width, height],
  );
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={
        pattern === "burst" || pattern === "stripes"
          ? `0 0 ${width} ${height}`
          : undefined
      }
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      <Rect width="100%" height="100%" fill={base} />
      {pattern === "burst" ? (
        <>
          {!swatch && <Circle cx={cx} cy={cy} r={radius * 0.28} fill={light} />}
          <Path d={raysPath} fill={shade} />
        </>
      ) : pattern === "stripes" ? (
        <Path d={stripesPath} fill={shade} />
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
});

// The No. label's right edge inside the art (5px inset plus the label).
const CARD_NUMBER_LABEL_WIDTH = 44;

/**
 * Pass `height` when the caller already sizes the card, so the name and
 * flavor text are final on the first render instead of after a layout pass.
 */
export const StrengthCard = memo(function StrengthCard({
  card,
  onPress,
  style,
  large = false,
  height,
  onArtHeight,
}: {
  card: Card;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  large?: boolean;
  height?: number;
  /** Reports the illustration area's laid-out height, so a grid can tell when text has squeezed it. */
  onArtHeight?: (height: number) => void;
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
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const cardHeight = height ?? measuredHeight;
  const measureCard =
    height === undefined
      ? (event: LayoutChangeEvent) =>
          setMeasuredHeight(event.nativeEvent.layout.height)
      : undefined;
  const [artSize, setArtSize] = useState({ width: 100, height: 100 });
  // The illustration keeps the source's size (74% x 84% of the art, centered);
  // the No. label shows only where it fits beside it instead of covering it.
  const illustrationSize = Math.min(
    artSize.width * 0.74,
    artSize.height * 0.84,
    150,
  );
  const showNumber =
    (artSize.width - illustrationSize) / 2 >= CARD_NUMBER_LABEL_WIDTH;
  const showFlavor = large || cardHeight >= 225;
  const nameSize = large
    ? 18
    : Math.max(13, Math.min(18, (cardHeight - 5) * 0.09));
  const inner = (
    <>
      {selfOnly && (
        <Svg
          width="100%"
          height="100%"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
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
        <Svg
          width="100%"
          height="100%"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
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
          height: 26,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 2.5,
          borderColor: C.ink,
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <T
          size={11.5}
          color={C.ink}
          numberOfLines={1}
          style={{
            flexShrink: 0,
            fontFamily: F.bold,
            lineHeight: 18.975,
            letterSpacing: 0.23,
          }}
        >
          {status}
        </T>
        {card.self && !selfOnly && (
          <T
            size={11.5}
            color={C.ink}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              flexShrink: 1,
              fontFamily: F.bold,
              lineHeight: 18.975,
              letterSpacing: 0.23,
            }}
          >
            自分も選んだ
          </T>
        )}
        {/* In the band rather than stamped on the art, so it never covers the illustration. */}
        {card.confirmed && card.discovered && (
          <T
            display
            color={C.stampInk}
            size={10.5}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              flexShrink: 1,
              backgroundColor: "rgba(255,255,255,0.7)",
              borderWidth: 1.5,
              borderColor: C.stampBorder,
              borderRadius: 5,
              paddingVertical: 1,
              paddingHorizontal: 3,
              lineHeight: 13.2,
            }}
          >
            新発見
          </T>
        )}
      </View>
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          onArtHeight?.(height);
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
          marginHorizontal: frame === "stars" ? 0 : 6,
          marginBottom: 0,
          borderWidth: 2,
          borderStyle: "solid",
          borderColor: C.ink,
          borderRadius: 9,
          overflow: "hidden",
        }}
      >
        <CardPattern card={card} selfOnly={selfOnly} {...artSize} />
        {showNumber && (
          <View style={{ position: "absolute", left: 5, top: 4, zIndex: 4 }}>
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
        )}
        <CardIllustration
          cardKey={card.key}
          confirmed={card.confirmed}
          selfOnly={selfOnly}
          artHeight={artSize.height}
        />
        {card.confirmed && <CardShine {...artSize} />}
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
        {card.deco?.stickers.map((k, i) => {
          const layout = card.deco?.layout?.[k];
          const position = layout?.position ?? ["br", "bl", "tr", "tl"][i % 4];
          const size = Math.min(
            (artSize.width * (layout?.size ?? 23)) / 100,
            artSize.height * 0.28,
            46,
          );
          return (
            <View
              key={k}
              style={{
                position: "absolute",
                left: position.endsWith("r") ? "80%" : "20%",
                top: position.startsWith("b") ? "76%" : "24%",
                width: size,
                height: size,
                transform: [
                  { translateX: -size / 2 },
                  { translateY: -size / 2 },
                  { rotate: `${layout?.angle ?? (i % 2 ? -12 : 12)}deg` },
                ],
              }}
            >
              <StickerArtwork stickerKey={k} shadow />
            </View>
          );
        })}
      </View>
      <T
        display
        color={C.ink}
        size={nameSize}
        numberOfLines={2}
        style={{
          paddingHorizontal: 8,
          paddingTop: 5,
          lineHeight: nameSize * 1.3,
          minHeight: 5 + nameSize * 1.3 * 2,
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
      ? {
          borderLeftWidth: 7,
          borderLeftColor: C.pink,
          borderRightWidth: 4,
          borderTopLeftRadius: 3,
          borderBottomLeftRadius: 3,
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
        }
      : {}),
    overflow: "hidden",
    boxShadow:
      (selfOnly && frame === "none") ||
      ["ticket", "ribbon", "mint", "pixel"].includes(frame)
        ? "none"
        : `3px 3px 0 ${C.ink}`,
  };
  return onPress ? (
    <SquishPressable
      testID={`strength-card-${card.key}`}
      pressScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}・${status}`}
      onPress={onPress}
      onLayout={measureCard}
      style={[container, style]}
    >
      {inner}
    </SquishPressable>
  ) : (
    <View
      testID={`strength-card-${card.key}`}
      onLayout={measureCard}
      style={[container, style]}
    >
      {inner}
    </View>
  );
});

// CSS repeating-linear-gradient(45deg, color 0 10px, transparent 10px 20px).
// The 10px strokes never overlap, so one path draws every stripe.
function lockedStripesPath(width: number, height: number) {
  let d = "";
  const count = Math.ceil((width + height) / Math.SQRT2 / 20);
  for (let index = 0; index < count; index++) {
    const start = Math.SQRT2 * (index * 20 + 5) - height;
    d += `M${start - 20} -20L${start + height + 20} ${height + 20}`;
  }
  return d;
}

export const LockedCard = memo(function LockedCard({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState({ width: 100, height: 100 });
  const gradientId = "lockedCenter" + useId().replace(/:/g, "");
  const diagonal = Math.hypot(size.width, size.height) / 2;
  const stripesPath = useMemo(
    () => lockedStripesPath(size.width, size.height),
    [size.width, size.height],
  );
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
        <Path
          d={stripesPath}
          fill="none"
          stroke={C.lockedStripe}
          strokeWidth={10}
        />
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
          ？
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
});

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
          height={220}
        />
      ))}
    </View>
  );
}
