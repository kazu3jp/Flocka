import React from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { CachedSvgXml } from "../../components/cached-svg-xml";
import { bareCard, type DecoData } from "@flocka/domain";
import { C, T } from "../../components/ui";
import { CardPattern } from "../../components/cards";
import vectors from "../../vectors.json";
import type { DecorationTab } from "./use-decoration";

function FrameSwatch({ frame }: { frame: string }) {
  const style: ViewStyle = {
    width: 44,
    height: 44,
    borderRadius: frame === "pixel" ? 0 : frame === "ticket" ? 7 : 10,
    borderWidth:
      frame === "stars" || frame === "ticket"
        ? 4
        : ["ribbon", "mint", "pixel"].includes(frame)
          ? 5
          : frame === "tape"
            ? 3
            : 2,
    borderColor:
      frame === "tape" || frame === "mint"
        ? C.lime
        : frame === "ribbon"
          ? C.pink
          : C.ink,
    borderStyle:
      frame === "ticket" ? "dashed" : frame === "pixel" ? "dotted" : "solid",
    backgroundColor: frame === "stars" ? C.yellow : C.paper,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };
  if (frame === "notebook")
    Object.assign(style, {
      borderLeftWidth: 7,
      borderLeftColor: C.pink,
      borderRightWidth: 4,
      borderTopLeftRadius: 3,
      borderBottomLeftRadius: 3,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 12,
    });
  return (
    <View style={style}>
      {frame === "tape" && (
        <Svg width="100%" height="100%" viewBox="0 0 38 38">
          <Path d="M0 20.675L38 -5.93V17.325L0 43.93Z" fill={C.lime} />
        </Svg>
      )}
      {frame === "stars" && (
        <T size={25} color={C.ink} style={{ lineHeight: 25 }}>
          ★
        </T>
      )}
      {[
        "stars",
        "dash",
        "double",
        "ticket",
        "ribbon",
        "mint",
        "pixel",
      ].includes(frame) && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: frame === "dash" ? 1 : frame === "double" ? 3 : 0,
            borderWidth:
              frame === "ribbon" || frame === "mint" || frame === "pixel"
                ? 2
                : 3,
            borderColor:
              frame === "dash"
                ? C.pink
                : frame === "double" || frame === "ribbon" || frame === "mint"
                  ? C.ink
                  : frame === "pixel" || frame === "ticket"
                    ? C.yellow
                    : C.paper,
            borderStyle: frame === "dash" ? "dashed" : "solid",
            borderRadius: frame === "pixel" ? 0 : frame === "ticket" ? 3 : 6,
          }}
        />
      )}
    </View>
  );
}

export function DecorationSwatch({
  tab,
  option,
  cardKey,
  decoration,
}: {
  tab: DecorationTab;
  option: string;
  cardKey: string;
  decoration: DecoData;
}) {
  if (tab === "frame") return <FrameSwatch frame={option} />;
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: C.ink,
        backgroundColor: C.paper,
        overflow: "hidden",
      }}
    >
      {tab === "stickers" ? (
        <CachedSvgXml
          xml={(vectors.stickers as Record<string, string>)[option]}
          width="100%"
          height="100%"
        />
      ) : (
        <CardPattern
          card={{
            ...bareCard(cardKey),
            deco: {
              ...decoration,
              [tab]: option,
              ...(tab === "color" ? { pattern: "plain" } : {}),
              stickers: [],
            },
          }}
          selfOnly={false}
          width={40}
          height={40}
          swatch
        />
      )}
    </View>
  );
}
