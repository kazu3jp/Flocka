import React, { createContext, useContext, useId } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  Pattern,
  Rect,
  SvgXml,
} from "react-native-svg";
import {
  ART_COLORS,
  AV_COLORS,
  COLORS,
  IC,
  type AvatarData,
  type Card,
} from "../model";
import vectors from "../vectors.json";

export const C = {
  blue: COLORS.blue,
  dark: COLORS["blue-d"],
  light: COLORS["blue-l"],
  ink: COLORS.ink,
  paper: COLORS.paper,
  paper2: COLORS["paper-2"],
  muted: COLORS.muted,
  white: COLORS["on-blue"],
  pale: COLORS["on-blue-muted"],
  yellow: COLORS.yellow,
  pink: COLORS.pink,
  lime: COLORS.lime,
  grey: COLORS.grey,
  danger: COLORS.danger,
};
export const F = {
  display: "DelaGothicOne_400Regular",
  body: "ZenKakuGothicNew_500Medium",
  bold: "ZenKakuGothicNew_700Bold",
};
export const S = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gap: { gap: 12 },
  panel: {
    backgroundColor: C.paper,
    borderWidth: 2.5,
    borderColor: C.ink,
    borderRadius: 16,
    padding: 16,
    boxShadow: `4px 4px 0 ${C.ink}`,
  },
  h1: { fontFamily: F.display, fontSize: 26, lineHeight: 38, color: C.white },
  h2: { fontFamily: F.display, fontSize: 20, lineHeight: 29, color: C.white },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 24, color: C.white },
  cap: { fontFamily: F.bold, fontSize: 12, lineHeight: 18, color: C.pale },
  input: {
    fontFamily: F.body,
    color: C.ink,
    fontSize: 16,
    lineHeight: 25,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.paper,
    borderWidth: 2.5,
    borderColor: C.ink,
    borderRadius: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.ink,
    padding: 10,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: C.paper,
  },
});
export function T({
  display = false,
  size = 15,
  color = C.white,
  style,
  ...props
}: TextProps & { display?: boolean; size?: number; color?: string }) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: display ? F.display : F.body,
          fontSize: size,
          lineHeight: size * 1.5,
          color,
        },
        style,
      ]}
    />
  );
}
export function Icon({
  name,
  size = 22,
  color = C.white,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <SvgXml
      xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${IC[name] || IC.spark}</svg>`}
      width={size}
      height={size}
    />
  );
}
export function Brand({ size = 40 }: { size?: number }) {
  return <SvgXml xml={vectors.icon} width={size} height={size} />;
}
export function Avatar({
  name = "",
  avatar,
  size = 44,
}: {
  name?: string;
  avatar?: Partial<AvatarData>;
  size?: number;
}) {
  const motif = (vectors.motifs as Record<string, string>)[
    avatar?.motif || "rocket"
  ];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: C.ink,
        backgroundColor: avatar?.color || AV_COLORS[0],
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {avatar?.type === "photo" && avatar.photo ? (
        <Image
          source={{ uri: avatar.photo }}
          style={{ width: "100%", height: "100%" }}
          accessibilityLabel="プロフィール写真"
        />
      ) : avatar?.type === "motif" ? (
        <SvgXml xml={motif} width="75%" height="75%" />
      ) : (
        <T display size={size * 0.4} color={C.ink}>
          {name.slice(0, 1) || "?"}
        </T>
      )}
    </View>
  );
}
export function Panel(props: ViewProps) {
  return <View {...props} style={[S.panel, props.style]} />;
}
export function Btn({
  label,
  onPress,
  disabled = false,
  plain = false,
  danger = false,
  small = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  plain?: boolean;
  danger?: boolean;
  small?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 44 : 54,
          paddingHorizontal: small ? 10 : 18,
          paddingVertical: 10,
          borderRadius: 14,
          borderWidth: 2.5,
          borderColor: disabled ? C.dark : C.ink,
          backgroundColor: disabled
            ? C.light
            : danger
              ? C.danger
              : plain
                ? C.paper
                : C.yellow,
          boxShadow: disabled
            ? "none"
            : `${pressed ? 1 : 4}px ${pressed ? 1 : 4}px 0 ${C.ink}`,
          transform: [
            { translateX: pressed ? 2 : 0 },
            { translateY: pressed ? 2 : 0 },
          ],
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} color={danger ? C.white : C.ink} />}
      <T
        display
        size={small ? 13 : 17}
        color={disabled ? C.pale : danger ? C.white : C.ink}
        style={{ textAlign: "center" }}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function LinkButton({
  label,
  onPress,
  color = C.white,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
    >
      <T
        color={color}
        size={14}
        style={{ textDecorationLine: "underline", fontFamily: F.bold }}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function Choice({
  label,
  selected,
  onPress,
  disabled = false,
  children,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        S.choice,
        {
          backgroundColor: selected ? C.yellow : C.paper,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {children || (
        <T size={13} color={C.ink}>
          {label}
        </T>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T size={13}>{label}</T>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={C.muted}
        style={[
          S.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
          style,
        ]}
      />
    </View>
  );
}
export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={[S.row, { minHeight: 48 }]}>
      {onBack && (
        <Pressable
          accessibilityLabel="戻る"
          accessibilityRole="button"
          onPress={onBack}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="back" />
        </Pressable>
      )}
      <T display size={20} style={{ flex: 1 }}>
        {title}
      </T>
      {right}
    </View>
  );
}
export const BoardInsets = createContext({ top: true, bottom: true });
export function Board({
  children,
  scroll = false,
  footer,
  safeTop,
  safeBottom,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  safeTop?: boolean;
  safeBottom?: boolean;
}) {
  const insets = useContext(BoardInsets);
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: C.blue }}
      edges={[
        "left",
        "right",
        ...((safeTop ?? insets.top) ? ["top" as const] : []),
        ...((safeBottom ?? insets.bottom) ? ["bottom" as const] : []),
      ]}
    >
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="boardGrid"
            width={22}
            height={22}
            patternUnits="userSpaceOnUse"
          >
            <Path
              d="M22 0 H0 V22"
              stroke="#ffffff"
              strokeOpacity={0.05}
              fill="none"
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#boardGrid)" />
      </Svg>
      <KeyboardAvoidingView
        style={S.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 14, gap: 12, flexGrow: 1 }}
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingTop: 4,
              paddingBottom: 12,
              gap: 10,
            }}
          >
            {children}
          </View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#11182788",
        }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityLabel="シートを閉じる"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            maxHeight: "90%",
            backgroundColor: C.blue,
            borderTopWidth: 2.5,
            borderColor: C.ink,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 18,
          }}
        >
          <View style={S.row}>
            <T display size={20} style={S.fill}>
              {title}
            </T>
            <Pressable
              accessibilityLabel="閉じる"
              accessibilityRole="button"
              onPress={onClose}
              style={{ padding: 12 }}
            >
              <Icon name="x" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Envelope({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.73} viewBox="0 0 44 32">
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
      <Path d="M3 4l19 13L41 4" fill="none" stroke={C.ink} strokeWidth={2.5} />
    </Svg>
  );
}

function CardPattern({ card }: { card: Card }) {
  const pattern = card.deco?.pattern || "burst",
    id = "pattern" + useId().replace(/:/g, "");
  const { base, shade, shade2, light } =
    ART_COLORS["deco-" + card.deco?.color] || ART_COLORS[card.key];
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
  const rays = Array.from({ length: 20 }, (_, i) => {
    const a = (i * 18 * Math.PI) / 180,
      b = ((i * 18 + 9) * Math.PI) / 180;
    return (
      <Path
        key={i}
        d={`M50 62 L${50 + 130 * Math.cos(a)} ${62 + 130 * Math.sin(a)} L${50 + 130 * Math.cos(b)} ${62 + 130 * Math.sin(b)} Z`}
        fill={shade}
      />
    );
  });
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={pattern === "burst" ? "0 0 100 100" : undefined}
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      <Rect width="100%" height="100%" fill={base} />
      {pattern === "burst" ? (
        <>
          {rays}
          <Circle cx={50} cy={62} r={28} fill={light} />
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
  const selfOnly = !card.testimonies.length;
  const corners = [
    { bottom: 0, right: 0 },
    { bottom: 0, left: 0 },
    { top: 0, right: 0 },
    { top: 0, left: 0 },
  ];
  const inner = (
    <>
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
          borderBottomWidth: 2.5,
          borderColor: C.ink,
          justifyContent: "center",
        }}
      >
        <T size={11} color={C.ink} style={{ fontFamily: F.bold }}>
          {status}
          {card.self && status !== "自己申告" ? " · 自分も選んだ" : ""}
        </T>
      </View>
      <View
        style={{
          flex: 1,
          minHeight: 34,
          margin: 6,
          marginBottom: 0,
          borderWidth: 2,
          borderStyle: "solid",
          borderColor: C.ink,
          borderRadius: 9,
          overflow: "hidden",
        }}
      >
        <CardPattern card={card} />
        <View style={{ position: "absolute", left: 5, top: 2 }}>
          <T color={C.ink} size={9}>
            No.{String(card.no).padStart(2, "0")}
          </T>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 10,
          }}
        >
          <SvgXml
            xml={(vectors.cards as Record<string, string>)[card.key]}
            width="100%"
            height="100%"
          />
        </View>
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
            color={C.danger}
            size={10}
            style={{
              position: "absolute",
              right: 4,
              top: 25,
              transform: [{ rotate: "10deg" }],
              backgroundColor: C.paper,
              borderWidth: 2,
              borderColor: C.danger,
              borderRadius: 4,
              padding: 2,
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
        size={large ? 19 : 13}
        style={{
          paddingHorizontal: 8,
          paddingTop: 4,
          backgroundColor: C.paper,
        }}
        numberOfLines={2}
      >
        {card.name}
      </T>
      {large && (
        <T
          color={C.muted}
          size={12}
          style={{ paddingHorizontal: 8, backgroundColor: C.paper }}
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
          paddingBottom: 6,
          backgroundColor: C.paper,
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
        <T color={C.muted} size={11} style={{ fontFamily: F.bold }}>
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
    backgroundColor: frame === "stars" ? C.ink : C.paper,
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
      accessibilityRole="button"
      accessibilityLabel={`${card.name}・${status}`}
      onPress={onPress}
      style={({ pressed }) => [
        container,
        pressed && { transform: [{ translateY: -2 }, { rotate: "-.6deg" }] },
        style,
      ]}
    >
      {inner}
    </Pressable>
  ) : (
    <View style={[container, style]}>{inner}</View>
  );
}
export function LockedCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityLabel="未発見のカード"
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
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="locked"
            width={20}
            height={20}
            patternUnits="userSpaceOnUse"
          >
            <Path
              d="M-5 5L5-5M0 20L20 0M15 25L25 15"
              stroke={C.blue}
              strokeWidth={8}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#locked)" />
      </Svg>
      <View
        style={{
          padding: 10,
          borderRadius: 12,
          backgroundColor: C.ink,
          alignItems: "center",
        }}
      >
        <T display size={30} color={C.yellow}>
          ？
        </T>
        <T size={12}>未発見</T>
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
