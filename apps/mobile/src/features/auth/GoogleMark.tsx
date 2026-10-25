import React from "react";
import Svg, { Path } from "react-native-svg";
import { GOOGLE_MARK_PATHS, GOOGLE_MARK_VIEW_BOX } from "./google-mark-paths";

/** The official four-colour Google "G", at the size of the old single-colour mark. */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg
      testID="google-mark"
      width={size}
      height={size}
      viewBox={GOOGLE_MARK_VIEW_BOX}
    >
      {GOOGLE_MARK_PATHS.map((part) => (
        <Path key={part.fill} d={part.d} fill={part.fill} />
      ))}
    </Svg>
  );
}
