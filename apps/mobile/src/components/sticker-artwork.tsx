import React, { useId, useMemo } from "react";
import { SvgXml } from "react-native-svg";
import vectors from "../vectors.json";
import { C } from "./theme";

/** Original sticker paths, with the source CSS shadow for stickers placed on a card. */
export function StickerArtwork({
  stickerKey,
  shadow = false,
}: {
  stickerKey: string;
  shadow?: boolean;
}) {
  const filterId = "stickerShadow" + useId().replace(/:/g, "");
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
  return <SvgXml xml={xml} width="100%" height="100%" />;
}
