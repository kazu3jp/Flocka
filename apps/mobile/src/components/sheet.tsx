import React, { useContext, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, LAYOUT, SP, OUTLINE } from "./theme";
import { T, Icon, ForegroundColor } from "./text";
import { useModalFrame } from "./app-frame";
import { useSheetFeedback } from "./feedback";
import { ScreenVisible } from "./screen-focus";
import { keyboardAvoidance } from "./keyboard-avoidance";

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const frame = useModalFrame();
  const insets = useSafeAreaInsets();
  const { content: feedback, register } = useSheetFeedback();
  const screenVisible = useContext(ScreenVisible);
  useEffect(() => register?.(), [register]);
  // A modal opens its own window; a screen kept mounted out of view must not
  // leave its sheet on top. The sheet comes back when the screen does.
  if (!screenVisible) return null;
  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityLabel={title}
      accessibilityViewIsModal
    >
      <ForegroundColor.Provider value={C.ink}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardAvoidance}>
          <View
            style={[
              { flex: 1, justifyContent: "flex-end", overflow: "hidden" },
              frame && {
                position: "absolute",
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
                borderRadius: frame.borderRadius,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="シートを閉じる"
              accessible={false}
              focusable={false}
              onPress={onClose}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `${C.ink}8c` },
              ]}
            />
            <ScrollView
              testID="sheet"
              keyboardShouldPersistTaps="handled"
              style={{
                flexGrow: 0,
                maxHeight: "86%",
                backgroundColor: C.paper,
                borderTopWidth: OUTLINE.width,
                borderColor: C.ink,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
              contentContainerStyle={{
                paddingHorizontal: LAYOUT.sheetPaddingX,
                paddingTop: LAYOUT.sheetPaddingTop,
                paddingBottom: Math.max(
                  insets.bottom,
                  LAYOUT.sheetPaddingBottom,
                ),
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 5,
                  backgroundColor: C.grey,
                  borderRadius: 9,
                  alignSelf: "center",
                  marginBottom: SP.sm,
                }}
              />
              <View
                testID="sheet-heading"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: LAYOUT.blockGap,
                  marginBottom: SP.sm,
                }}
              >
                <T
                  accessibilityRole="header"
                  display
                  size={20}
                  style={{ flexShrink: 1, minWidth: 0, lineHeight: 28 }}
                >
                  {title}
                </T>
                <Pressable
                  accessibilityLabel="閉じる"
                  accessibilityRole="button"
                  onPress={onClose}
                  style={{
                    width: LAYOUT.touchTarget,
                    height: LAYOUT.touchTarget,
                    flexShrink: 0,
                    marginRight: -LAYOUT.blockGap,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="x" />
                </Pressable>
              </View>
              <View style={{ gap: LAYOUT.sheetGap }}>{children}</View>
            </ScrollView>
            {feedback}
          </View>
        </KeyboardAvoidingView>
      </ForegroundColor.Provider>
    </Modal>
  );
}
