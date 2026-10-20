import React, { createContext, useContext, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type AccessibilityRole,
  type FlatListProps,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";

import { C, F, S } from "./theme";
import { T, Icon, ForegroundColor } from "./text";
import { useModalFrame } from "./app-frame";
import { useSheetFeedback } from "./feedback";

export function Panel(props: ViewProps) {
  return <View {...props} style={[S.panel, props.style]} />;
}

export function Btn({
  label,
  onPress,
  disabled = false,
  loading = false,
  plain = false,
  danger = false,
  small = false,
  icon,
  iconSize = 22,
  iconStyle,
  textStyle,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows progress while the action runs; the button stays disabled meanwhile. */
  loading?: boolean;
  plain?: boolean;
  danger?: boolean;
  small?: boolean;
  icon?: string;
  iconSize?: number;
  iconStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const { height } = useWindowDimensions();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      aria-disabled={inactive}
      aria-busy={loading}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 44 : height <= 720 ? 50 : 54,
          paddingHorizontal: small ? 10 : 18,
          paddingVertical: 10,
          borderRadius: 14,
          borderWidth: 2.5,
          borderColor: disabled ? C.dark : C.ink,
          backgroundColor: disabled
            ? C.light
            : danger
              ? C.danger
              : plain
                ? C.paper
                : C.yellow,
          boxShadow: disabled
            ? "none"
            : `${pressed ? 1 : 4}px ${pressed ? 1 : 4}px 0 ${C.ink}`,
          transform: [
            { translateX: pressed ? 2 : 0 },
            { translateY: pressed ? 2 : 0 },
          ],
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={disabled ? C.pale : danger ? C.white : C.ink}
        />
      ) : (
        icon && (
          <Icon
            name={icon}
            size={iconSize}
            style={[Platform.OS !== "web" && { flexShrink: 0 }, iconStyle]}
            color={danger ? C.white : C.ink}
          />
        )
      )}
      <T
        display
        size={small ? 13 : 17}
        color={disabled ? C.pale : danger ? C.white : C.ink}
        style={[
          { textAlign: "center" },
          // Native text does not shrink by default; keep long labels inside the button.
          Platform.OS !== "web" && { flexShrink: 1, minWidth: 0 },
          textStyle,
        ]}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  color,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const inheritedColor = useContext(ForegroundColor);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      aria-disabled={disabled}
      style={{
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: 8,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <T
        color={color ?? inheritedColor}
        size={14}
        style={{ textDecorationLine: "underline", fontFamily: F.bold }}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
  disabled = false,
  children,
  style,
  accessibilityRole = "button",
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Segmented controls read as tabs or radios instead of toggle buttons. */
  accessibilityRole?: Extract<AccessibilityRole, "button" | "tab" | "radio">;
}) {
  const toggle = accessibilityRole === "button";
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={{
        selected: !!selected,
        checked: accessibilityRole === "radio" ? !!selected : undefined,
        disabled,
      }}
      aria-pressed={toggle ? !!selected : undefined}
      aria-selected={accessibilityRole === "tab" ? !!selected : undefined}
      aria-checked={accessibilityRole === "radio" ? !!selected : undefined}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[
        S.choice,
        {
          backgroundColor: selected ? C.yellow : C.paper,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {children || (
        <T size={13} color={C.ink}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hideLabel = false,
  style,
  ...props
}: TextInputProps & { label: string; hideLabel?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {!hideLabel && <T size={13}>{label}</T>}
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={C.muted}
        style={[
          S.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
          style,
        ]}
      />
    </View>
  );
}

export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const scroll = useContext(BoardScroll);
  return (
    <View
      style={[
        S.row,
        { minHeight: 48, gap: 8 },
        scroll && {
          marginTop: -4,
          marginHorizontal: -14,
          paddingHorizontal: 14,
          backgroundColor: C.blue,
        },
      ]}
    >
      {onBack && (
        <Pressable
          accessibilityLabel="戻る"
          accessibilityRole="button"
          onPress={onBack}
          style={{
            width: 44,
            height: 44,
            marginLeft: -10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="back" />
        </Pressable>
      )}
      <T
        accessibilityRole="header"
        display
        size={20}
        style={{ flex: 1, lineHeight: 26 }}
      >
        {title}
      </T>
      {right}
    </View>
  );
}

/** Pull-to-refresh state is owned by the screen; the board only renders it. */
type BoardRefresh = { refreshing?: boolean; onRefresh?: () => void };

function boardRefreshControl({ refreshing, onRefresh }: BoardRefresh) {
  if (!onRefresh) return undefined;
  return (
    <RefreshControl
      refreshing={!!refreshing}
      onRefresh={onRefresh}
      tintColor={C.yellow}
      colors={[C.ink]}
      progressBackgroundColor={C.yellow}
    />
  );
}

/**
 * A virtualized list laid out like a scrolling board. Render it as a direct
 * child of a non-scrolling Board so it never nests inside a ScrollView.
 */
export function BoardList<Item>({
  refreshing,
  onRefresh,
  contentContainerStyle,
  ...props
}: Omit<FlatListProps<Item>, "refreshControl" | "refreshing" | "onRefresh"> &
  BoardRefresh) {
  return (
    <FlatList
      {...props}
      keyboardShouldPersistTaps="handled"
      refreshControl={boardRefreshControl({ refreshing, onRefresh })}
      style={[{ flex: 1, marginHorizontal: -14 }, props.style]}
      contentContainerStyle={[
        { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 14, gap: 12 },
        contentContainerStyle,
      ]}
    />
  );
}

export const BoardInsets = createContext({ top: true, bottom: true });
const BoardScroll = createContext(false);

export function Board({
  children,
  scroll = false,
  form = false,
  footer,
  safeTop,
  safeBottom,
  contentStyle,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  form?: boolean;
  footer?: React.ReactNode;
  safeTop?: boolean;
  safeBottom?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
} & BoardRefresh) {
  const insets = useContext(BoardInsets);
  const firstChild = React.Children.toArray(children)[0];
  const stickyHeader =
    React.isValidElement(firstChild) && firstChild.type === Header;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: C.blue }}
      edges={[
        "left",
        "right",
        ...((safeTop ?? insets.top) ? ["top" as const] : []),
        ...((safeBottom ?? insets.bottom) ? ["bottom" as const] : []),
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <Pattern
            id="boardGrid"
            width={22}
            height={22}
            patternUnits="userSpaceOnUse"
          >
            <Rect width={22} height={1} fill="#ffffff" fillOpacity={0.05} />
            <Rect width={1} height={22} fill="#ffffff" fillOpacity={0.05} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#boardGrid)" />
      </Svg>
      <BoardScroll.Provider value={scroll && !form}>
        <KeyboardAvoidingView
          style={S.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {scroll ? (
            <ScrollView
              stickyHeaderIndices={stickyHeader && !form ? [0] : undefined}
              keyboardShouldPersistTaps="handled"
              refreshControl={boardRefreshControl({ refreshing, onRefresh })}
              contentContainerStyle={[
                {
                  paddingHorizontal: 14,
                  paddingTop: 4,
                  paddingBottom: form ? 12 : 24,
                  gap: form ? 10 : 12,
                  flexGrow: 1,
                },
                contentStyle,
              ]}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={[
                {
                  flex: 1,
                  paddingHorizontal: 14,
                  paddingTop: 4,
                  paddingBottom: 12,
                  gap: 10,
                },
                contentStyle,
              ]}
            >
              {children}
            </View>
          )}
          {footer}
        </KeyboardAvoidingView>
      </BoardScroll.Provider>
    </SafeAreaView>
  );
}

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
  useEffect(() => register?.(), [register]);
  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityLabel={title}
      accessibilityViewIsModal
    >
      <ForegroundColor.Provider value={C.ink}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
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
                borderTopWidth: 2.5,
                borderColor: C.ink,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 22),
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 5,
                  backgroundColor: C.grey,
                  borderRadius: 9,
                  alignSelf: "center",
                  marginBottom: 8,
                }}
              />
              <View
                testID="sheet-heading"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
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
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    marginRight: -10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="x" />
                </Pressable>
              </View>
              <View style={{ gap: 14 }}>{children}</View>
            </ScrollView>
            {feedback}
          </View>
        </KeyboardAvoidingView>
      </ForegroundColor.Provider>
    </Modal>
  );
}

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
