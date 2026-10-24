import React, { createContext, memo, useContext } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextProps,
  type TextStyle,
} from "react-native";
import { AV_COLORS, IC, type AvatarData } from "@flocka/domain";
import vectors from "../vectors.json";
import { CachedSvgXml } from "./cached-svg-xml";
import { C, F } from "./theme";

export const ForegroundColor = createContext<string>(C.white);

// Both bundled families use hhea ascent 1.16em and descent 0.288em.
const FONT_ASCENT = 1.16,
  FONT_DESCENT = 0.288;
// Measured extents of the kana, kanji, punctuation and Latin descenders in each font.
const GLYPH_EXTENTS: Record<string, { top: number; bottom: number }> = {
  [F.display]: { top: 0.93, bottom: 0.27 },
  [F.body]: { top: 0.87, bottom: 0.21 },
  [F.bold]: { top: 0.87, bottom: 0.21 },
};

const numeric = (...values: unknown[]) => {
  for (const value of values)
    if (value !== undefined) return typeof value === "number" ? value : null;
  return 0;
};

// How much wider than its measured width a Text box is made, in em. Android can
// lay a line out against a box that is exactly as wide as its content and then
// leave the last character on a second line that the box height hides (seen as
// 「バックアップを復」). A little spare width keeps the whole line on one line.
const END_ROOM_EM = 0.25;

/**
 * Spare width at the end of the line, taken from padding and given back by a
 * negative margin so the layout and the visual centring do not change.
 */
function endRoom(style: TextStyle): TextStyle {
  const { fontSize } = style;
  if (!fontSize) return {};
  if (style.backgroundColor || style.borderWidth || style.borderRightWidth)
    return {};
  const padding = numeric(
    style.paddingRight,
    style.paddingHorizontal,
    style.padding,
  );
  const margin = numeric(
    style.marginRight,
    style.marginHorizontal,
    style.margin,
  );
  if (padding === null || margin === null) return {};
  const room = Math.ceil(fontSize * END_ROOM_EM);
  return { paddingRight: padding + room, marginRight: margin - room };
}

/**
 * Android TextView clips glyphs to its own box. When the source CSS uses a
 * line-height tighter than the font, extend the box with padding and pull the
 * layout back with the same negative margin, so only the drawable area grows.
 */
function androidGlyphRoom(style: TextStyle) {
  const { fontSize, lineHeight, fontFamily } = style;
  const extents = fontFamily && GLYPH_EXTENTS[fontFamily];
  if (!fontSize || !lineHeight || !extents) return null;
  // Padding would visibly grow a painted label or move text inside a fixed box.
  if (
    style.height !== undefined ||
    style.minHeight !== undefined ||
    style.backgroundColor ||
    style.borderWidth ||
    style.borderTopWidth ||
    style.borderBottomWidth
  )
    return null;
  const halfLeading =
    (lineHeight - fontSize * (FONT_ASCENT + FONT_DESCENT)) / 2;
  const sides = {
    Top: fontSize * (extents.top - FONT_ASCENT) - halfLeading,
    Bottom: fontSize * (extents.bottom - FONT_DESCENT) - halfLeading,
  };
  const room: TextStyle = {};
  Object.assign(room, endRoom(style));
  for (const side of ["Top", "Bottom"] as const) {
    const padding = numeric(
      style[`padding${side}`],
      style.paddingVertical,
      style.padding,
    );
    const margin = numeric(
      style[`margin${side}`],
      style.marginVertical,
      style.margin,
    );
    if (padding === null || margin === null) continue;
    const missing = Math.ceil(sides[side] - padding);
    if (missing <= 0) continue;
    room[`padding${side}`] = padding + missing;
    room[`margin${side}`] = margin - missing;
  }
  return Object.keys(room).length ? room : null;
}

// Without a caller style, the room depends only on the font and its size,
// so those labels skip flattening and reuse one computed result.
const PLAIN_GLYPH_ROOM_LIMIT = 200;
const plainGlyphRooms = new Map<string, TextStyle | null>();

function plainGlyphRoom(style: TextStyle) {
  const key = `${style.fontFamily}|${style.fontSize}|${style.lineHeight}`;
  let room = plainGlyphRooms.get(key);
  if (room === undefined) {
    room = androidGlyphRoom(style);
    plainGlyphRooms.set(key, room);
    if (plainGlyphRooms.size > PLAIN_GLYPH_ROOM_LIMIT)
      plainGlyphRooms.delete(plainGlyphRooms.keys().next().value!);
  }
  return room;
}

export function T({
  display = false,
  size = 15,
  color,
  style,
  ...props
}: TextProps & { display?: boolean; size?: number; color?: string }) {
  const inheritedColor = useContext(ForegroundColor);
  const baseStyle: TextStyle = {
    fontFamily: display ? F.display : F.body,
    fontSize: size,
    lineHeight: size * 1.5,
    color: color ?? inheritedColor,
  };
  const textStyle: StyleProp<TextStyle> = [baseStyle, style];
  const glyphRoom =
    Platform.OS === "android"
      ? style
        ? androidGlyphRoom(StyleSheet.flatten(textStyle))
        : plainGlyphRoom(baseStyle)
      : null;
  return (
    <Text {...props} style={glyphRoom ? [textStyle, glyphRoom] : textStyle} />
  );
}

export const Icon = memo(function Icon({
  name,
  size = 22,
  style,
  color,
}: {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const inheritedColor = useContext(ForegroundColor);
  return (
    <CachedSvgXml
      xml={`<svg viewBox="0 0 24 24" fill="none" stroke="${color ?? inheritedColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${IC[name] || IC.spark}</svg>`}
      style={style}
      width={size}
      height={size}
    />
  );
});

export function Brand({ size = 40 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.224,
        boxShadow: `0 0 0 2.5px ${C.ink}, 3px 3px 0 ${C.ink}`,
      }}
    >
      <View style={{ borderRadius: size * 0.224, overflow: "hidden" }}>
        <CachedSvgXml xml={vectors.icon} width={size} height={size} />
      </View>
    </View>
  );
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
        <CachedSvgXml xml={motif} width="75%" height="75%" />
      ) : (
        <T display size={size * 0.4} color={C.ink}>
          {Array.from(name)[0] ?? "?"}
        </T>
      )}
    </View>
  );
}
