import React, { createContext, useContext, useState } from "react";
import {
  Platform,
  View,
  type LayoutRectangle,
  type ViewProps,
} from "react-native";

type FrameBounds = LayoutRectangle & { borderRadius: number };
const FrameContext = createContext<FrameBounds | null>(null);

/** Modal portals use window coordinates; the web preview lives in this frame. */
export function AppFrame({
  children,
  borderRadius,
  ...props
}: ViewProps & { borderRadius: number }) {
  const [bounds, setBounds] = useState<FrameBounds | null>(null);
  return (
    <View
      {...props}
      onLayout={({ nativeEvent: { layout } }) =>
        setBounds((current) =>
          current &&
          current.x === layout.x &&
          current.y === layout.y &&
          current.width === layout.width &&
          current.height === layout.height &&
          current.borderRadius === borderRadius
            ? current
            : { ...layout, borderRadius },
        )
      }
    >
      <FrameContext.Provider value={bounds}>{children}</FrameContext.Provider>
    </View>
  );
}

export function useModalFrame() {
  const frame = useContext(FrameContext);
  return Platform.OS === "web" ? frame : null;
}
