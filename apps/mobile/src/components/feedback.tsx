import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Animated, Pressable, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F, LAYOUT, SP, OUTLINE } from "./theme";
import { usePresenceMotion } from "./motion";
import { T } from "./text";
import { useKeyboardHeight } from "./use-keyboard-height";

type SheetFeedback = { content: React.ReactNode; register?: () => () => void };
const FeedbackContext = createContext<SheetFeedback>({ content: null });

/** Render feedback in the active native modal instead of behind its window. */
export function ScreenFeedback({
  feedback,
  children,
  ...props
}: ViewProps & { feedback: React.ReactNode }) {
  const [activeSheets, setActiveSheets] = useState(0);
  const register = useCallback(() => {
    setActiveSheets((count) => count + 1);
    return () => setActiveSheets((count) => count - 1);
  }, []);
  const value = useMemo(
    () => ({ content: feedback, register }),
    [feedback, register],
  );
  return (
    <FeedbackContext.Provider value={value}>
      <View {...props}>
        {children}
        {activeSheets === 0 && feedback}
      </View>
    </FeedbackContext.Provider>
  );
}

export function useSheetFeedback() {
  return useContext(FeedbackContext);
}

type Notification = {
  text: string;
  action?: { label: string; fn: () => void };
};

export function ToastBanner({
  notification,
  dismiss,
  focused,
}: {
  notification: Notification | null;
  dismiss: () => void;
  focused: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  // The banner eases out after the notification clears, so it keeps the last text.
  const [last, setLast] = useState<Notification | null>(null);
  if (notification && notification !== last) setLast(notification);
  const { mounted, progress } = usePresenceMotion(!!notification);
  const shown = notification ?? last;
  if (!mounted || !shown) return null;
  return (
    <Animated.View
      testID="toast"
      // Only the live notification takes touches while it eases out.
      pointerEvents={notification ? "auto" : "none"}
      role="status"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        // Above the tab bar, or above the keyboard while one is typing.
        bottom: Math.max(
          (focused ? 96 : 80) + insets.bottom,
          keyboardHeight + LAYOUT.toastInset,
        ),
        left: LAYOUT.toastInset,
        right: LAYOUT.toastInset,
        flexDirection: "row",
        alignItems: "center",
        gap: LAYOUT.blockGap,
        backgroundColor: C.yellow,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        borderRadius: 14,
        paddingVertical: 11,
        paddingLeft: 14,
        paddingRight: 10,
        boxShadow: OUTLINE.raisedShadow,
        // The source's toastIn: rise 10px from 96% scale while fading in.
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={shown.text}
        onPress={dismiss}
        style={{ flex: 1 }}
      >
        <T
          color={C.ink}
          size={14}
          style={{ fontFamily: F.bold, lineHeight: 23.1 }}
        >
          {shown.text}
        </T>
      </Pressable>
      {shown.action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown.action.label}
          onPress={() => {
            shown.action?.fn();
            dismiss();
          }}
          style={{
            minHeight: LAYOUT.touchTarget,
            paddingHorizontal: SP.sm,
            justifyContent: "center",
          }}
        >
          <T
            size={14}
            color={C.ink}
            style={{ fontFamily: F.bold, textDecorationLine: "underline" }}
          >
            {shown.action.label}
          </T>
        </Pressable>
      )}
    </Animated.View>
  );
}
