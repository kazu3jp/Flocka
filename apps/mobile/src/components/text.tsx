import React from "react";
import { Image, Text, View, type TextProps } from "react-native";
import { SvgXml } from "react-native-svg";
import { AV_COLORS, IC, type AvatarData } from "@flocka/domain";
import vectors from "../vectors.json";
import { C, F } from "./theme";

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
        <SvgXml xml={vectors.icon} width={size} height={size} />
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
        <SvgXml xml={motif} width="75%" height="75%" />
      ) : (
        <T display size={size * 0.4} color={C.ink}>
          {name.slice(0, 1) || "?"}
        </T>
      )}
    </View>
  );
}
