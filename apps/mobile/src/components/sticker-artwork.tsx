import React, { memo } from "react";
import { CachedSvgXml } from "./cached-svg-xml";
import { DropShadowSvg } from "./drop-shadow-svg";
import vectors from "../vectors.json";

// The source's drop-shadow(1px 2px 0 ink / .3) on stickers placed on a card.
const STICKER_SHADOW = { dx: 1, dy: 2, opacity: 0.3 };

/** Original sticker paths, with the source CSS shadow for stickers placed on a card. */
export const StickerArtwork = memo(function StickerArtwork({
  stickerKey,
  shadow = false,
}: {
  stickerKey: string;
  shadow?: boolean;
}) {
  const xml = (vectors.stickers as Record<string, string>)[stickerKey];
  return shadow ? (
    <DropShadowSvg xml={xml} shadow={STICKER_SHADOW} />
  ) : (
    <CachedSvgXml xml={xml} width="100%" height="100%" />
  );
});
