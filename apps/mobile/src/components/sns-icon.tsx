import { memo } from "react";
import type { SnsPlatform } from "@flocka/domain";
import { CachedSvgXml } from "./cached-svg-xml";
import { Icon } from "./text";
import vectors from "../vectors.json";

/**
 * The service's own mark (design/sns-icons), or the app's globe icon for the
 * person's website, in one color so it sits with the app's ink outlines.
 */
export const SnsIcon = memo(function SnsIcon({
  platform,
  size = 18,
  color,
}: {
  platform: SnsPlatform;
  size?: number;
  color: string;
}) {
  if (platform === "website")
    return <Icon name="globe" size={size} color={color} />;
  const path = (vectors.sns as Record<string, string>)[platform];
  return (
    <CachedSvgXml
      xml={`<svg viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`}
      width={size}
      height={size}
    />
  );
});
