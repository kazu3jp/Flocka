import React, { createContext, useContext, useState } from "react";
import {
  Platform,
  View,
  useWindowDimensions,
  type LayoutRectangle,
  type ViewProps,
} from "react-native";
import { LAYOUT } from "./theme";

type FrameBounds = LayoutRectangle & { borderRadius: number };
const FrameContext = createContext<FrameBounds | null>(null);

/**
 * Modal portals use window coordinates; the web preview and the column of a
 * native tablet live in this frame.
 */
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
  const { width } = useWindowDimensions();
  if (Platform.OS === "web") return frame;
  // On a phone the frame is the whole window; only a tablet's column is narrower.
  return frame && frame.width < width ? frame : null;
}

/**
 * Width of the app's column: the web preview frame, a tablet's column, or the
 * phone's window before the frame is first measured.
 */
export function useAppWidth() {
  const frame = useContext(FrameContext);
  const { width } = useWindowDimensions();
  return (
    frame?.width ??
    Math.min(width, Platform.OS === "web" ? width : LAYOUT.tabletMaxWidth)
  );
}
