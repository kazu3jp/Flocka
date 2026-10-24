import React, { memo, useId, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { CachedSvgXml } from "./cached-svg-xml";
import { C } from "./theme";

type Shadow = { dx: number; dy: number; opacity: number };

function withFilter(xml: string, id: string, { dx, dy, opacity }: Shadow) {
  return xml
    .replace(
      /<svg[^>]*>/,
      (tag) =>
        `${tag}<defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="${dx}" dy="${dy}" stdDeviation="0" flood-color="${C.ink}" flood-opacity="${opacity}" /></filter></defs><g filter="url(#${id})">`,
    )
    .replace("</svg>", "</g></svg>");
}

/** The artwork painted in ink and moved by the shadow offset, in SVG units. */
function silhouette(xml: string, { dx, dy }: Shadow) {
  return xml
    .replace(/(fill|stroke)="#[0-9a-f]{6}"/gi, `$1="${C.ink}"`)
    .replace(
      /<svg[^>]*>/,
      (tag) => `${tag}<g transform="translate(${dx} ${dy})" fill="${C.ink}">`,
    )
    .replace("</svg>", "</g></svg>");
}

/**
 * The source's hard drop shadow (no blur). The web keeps the SVG filter. On
 * native, react-native-svg renders filters and group opacity into software
 * bitmaps, so the shadow is an ink copy under the artwork instead, faded by the
 * view layer. Offscreen compositing keeps overlapping shapes one even tone.
 */
export const DropShadowSvg = memo(function DropShadowSvg({
  xml,
  shadow,
}: {
  xml: string;
  shadow: Shadow;
}) {
  const filterId = "dropShadow" + useId().replace(/:/g, "");
  const { dx, dy, opacity } = shadow;
  const filtered = useMemo(
    () =>
      Platform.OS === "web"
        ? withFilter(xml, filterId, { dx, dy, opacity })
        : null,
    [xml, filterId, dx, dy, opacity],
  );
  const shadowXml = useMemo(
    () => (Platform.OS === "web" ? null : silhouette(xml, { dx, dy, opacity })),
    [xml, dx, dy, opacity],
  );
  if (filtered)
    return <CachedSvgXml xml={filtered} width="100%" height="100%" />;
  return (
    <>
      <View
        pointerEvents="none"
        needsOffscreenAlphaCompositing
        style={[StyleSheet.absoluteFill, { opacity }]}
      >
        <CachedSvgXml xml={shadowXml!} width="100%" height="100%" />
      </View>
      <CachedSvgXml xml={xml} width="100%" height="100%" />
    </>
  );
});
