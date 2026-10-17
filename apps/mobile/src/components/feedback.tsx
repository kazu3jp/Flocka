import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F } from "./theme";
import { T } from "./text";

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

export function ToastBanner({
  notification,
  dismiss,
  focused,
}: {
  notification: {
    text: string;
    action?: { label: string; fn: () => void };
  } | null;
  dismiss: () => void;
  focused: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (!notification) return null;
  return (
    <View
      testID="toast"
      role="status"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        bottom: (focused ? 96 : 80) + insets.bottom,
        left: 12,
        right: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: C.yellow,
        borderWidth: 2.5,
        borderColor: C.ink,
        borderRadius: 14,
        paddingVertical: 11,
        paddingLeft: 14,
        paddingRight: 10,
        boxShadow: `4px 4px 0 ${C.ink}`,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={notification.text}
        onPress={dismiss}
        style={{ flex: 1 }}
      >
        <T
          color={C.ink}
          size={14}
          style={{ fontFamily: F.bold, lineHeight: 23.1 }}
        >
          {notification.text}
        </T>
      </Pressable>
      {notification.action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notification.action.label}
          onPress={() => {
            notification.action?.fn();
            dismiss();
          }}
          style={{
            minHeight: 44,
            paddingHorizontal: 8,
            justifyContent: "center",
          }}
        >
          <T
            size={14}
            color={C.ink}
            style={{ fontFamily: F.bold, textDecorationLine: "underline" }}
          >
            {notification.action.label}
          </T>
        </Pressable>
      )}
    </View>
  );
}
