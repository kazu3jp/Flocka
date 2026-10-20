import React, { memo, useId, useMemo } from "react";
import { Platform } from "react-native";
import { CachedSvgXml } from "./cached-svg-xml";
import vectors from "../vectors.json";
import { C } from "./theme";

/** Original sticker paths, with the source CSS shadow for stickers placed on a card. */
export const StickerArtwork = memo(function StickerArtwork({
  stickerKey,
  shadow = false,
}: {
  stickerKey: string;
  shadow?: boolean;
}) {
  const instanceId = useId().replace(/:/g, "");
  // Native SVG roots scope their own filters, so identical stickers can share one parse.
  const filterId = "stickerShadow" + (Platform.OS === "web" ? instanceId : "");
  const xml = useMemo(() => {
    const source = (vectors.stickers as Record<string, string>)[stickerKey];
    if (!shadow) return source;
    return source
      .replace(
        /<svg[^>]*>/,
        (tag) =>
          `${tag}<defs><filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="0" flood-color="${C.ink}" flood-opacity=".3" /></filter></defs><g filter="url(#${filterId})">`,
      )
      .replace("</svg>", "</g></svg>");
  }, [stickerKey, shadow, filterId]);
  return <CachedSvgXml xml={xml} width="100%" height="100%" />;
});
