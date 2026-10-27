import React from "react";

import Svg, { Path, Rect } from "react-native-svg";

import { C } from "./theme";

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
