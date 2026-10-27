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

import { C, F, LAYOUT, S, SP } from "./theme";
import { T, Icon, ForegroundColor } from "./text";
import { useModalFrame } from "./app-frame";
import { useSheetFeedback } from "./feedback";
import { ScreenVisible } from "./screen-focus";
import { SelectionFill, SquishPressable } from "./motion";

export function Panel(props: ViewProps) {
  return <View {...props} style={[S.panel, props.style]} />;
}

export function Btn({
  label,
  onPress,
  disabled = false,
  loading = false,
  selected,
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
  /** Marks the current option when buttons act as a choice group. */
  selected?: boolean;
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
    <SquishPressable
      // Presses sink toward the shadow, as .btn:active does in the source.
      pressScale={1}
      pressShift={2}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading, selected }}
      aria-disabled={inactive}
      aria-busy={loading}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? LAYOUT.touchTarget : height <= 720 ? 50 : 54,
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
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: SP.sm,
        },
        style,
      ]}
    >
      {/* The spinner takes the icon's slot, or floats at the left edge when
          there is no icon, so loading never changes the button's size. */}
      {icon ? (
        <View
          style={{
            width: iconSize,
            height: iconSize,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {loading ? (
            <ActivityIndicator
              size="small"
              color={disabled ? C.pale : danger ? C.white : C.ink}
            />
          ) : (
            <Icon
              name={icon}
              size={iconSize}
              style={iconStyle}
              color={danger ? C.white : C.ink}
            />
          )}
        </View>
      ) : (
        loading && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: small ? SP.sm : SP.lg,
              top: 0,
              bottom: 0,
              justifyContent: "center",
            }}
          >
            <ActivityIndicator
              size="small"
              color={disabled ? C.pale : danger ? C.white : C.ink}
            />
          </View>
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
    </SquishPressable>
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
    <SquishPressable
      pressScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      aria-disabled={disabled}
      // Centred like the source's .link, so a link stretched across a column
      // sits under its neighbours instead of hugging the left edge.
      style={{
        minHeight: LAYOUT.touchTarget,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SP.sm,
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
    </SquishPressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
  disabled = false,
  children,
  style,
  selectedColor = C.yellow,
  accessibilityRole = "button",
}: {
  label: string;
  selected?: boolean;
  /** Fill of the selected state. */
  selectedColor?: string;
  onPress: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Segmented controls read as tabs or radios instead of toggle buttons. */
  accessibilityRole?: Extract<AccessibilityRole, "button" | "tab" | "radio">;
}) {
  const toggle = accessibilityRole === "button";
  const { borderRadius = 12, borderWidth = 2 } = StyleSheet.flatten([
    S.choice,
    style,
  ]) as ViewStyle;
  return (
    <SquishPressable
      pressScale={0.96}
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
        // Centred like the source's .seg buttons; content passed as children lays itself out.
        !children && { alignItems: "center" },
        { opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <SelectionFill
        selected={!!selected}
        from={C.paper}
        to={selectedColor}
        radius={Number(borderRadius) - Number(borderWidth)}
      />
      {children || (
        <T size={13} color={C.ink} style={{ textAlign: "center" }}>
          {label}
        </T>
      )}
    </SquishPressable>
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
        { minHeight: LAYOUT.headerHeight, gap: SP.sm },
        scroll && {
          marginTop: -BOARD_TOP_PADDING,
          marginHorizontal: -LAYOUT.screenPadding,
          paddingHorizontal: LAYOUT.screenPadding,
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
            width: LAYOUT.touchTarget,
            height: LAYOUT.touchTarget,
            // The arrow is centred in its 44pt target; pull the target out so
            // the arrow sits on the screen padding like the title's block.
            marginLeft: -LAYOUT.blockGap,
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
        // A long card or person's name keeps the header at most two lines high.
        numberOfLines={2}
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
  // react-native-web draws RefreshControl as a plain wrapper that repeats the
  // list's style, which doubles its margins. Pulling does nothing there anyway.
  if (!onRefresh || Platform.OS === "web") return undefined;
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
      style={[
        { flex: 1, marginHorizontal: -LAYOUT.screenPadding },
        props.style,
      ]}
      contentContainerStyle={[
        {
          paddingHorizontal: LAYOUT.screenPadding,
          paddingTop: 2,
          paddingBottom: LAYOUT.screenPadding,
          gap: LAYOUT.sectionGap,
        },
        contentContainerStyle,
      ]}
    />
  );
}

/** Space between the safe area and the first block of a board. */
const BOARD_TOP_PADDING = SP.xs;
export const BoardInsets = createContext({ top: true, bottom: true });
const BoardScroll = createContext(false);
// Android apps are edge-to-edge, so the window no longer resizes for the keyboard.
// The view measures its own overlap with the keyboard, so a resized window adds no offset.
const keyboardAvoidance = Platform.OS === "ios" ? "padding" : "height";

/**
 * Content style that makes a scrolling Board lay out like a fixed one (same
 * gap and bottom padding). A screen whose main block fills the free height
 * uses it, so it looks as before when everything fits and scrolls on a short
 * screen or with a large font, instead of clipping.
 */
export const FIXED_LOOKING_BOARD: ViewStyle = {
  // A scrolling Board pulls its header up by the top padding; the fixed one does not.
  paddingTop: 2 * BOARD_TOP_PADDING,
  gap: LAYOUT.blockGap,
  paddingBottom: LAYOUT.sectionGap,
};

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
        <KeyboardAvoidingView style={S.fill} behavior={keyboardAvoidance}>
          {scroll ? (
            <ScrollView
              stickyHeaderIndices={stickyHeader && !form ? [0] : undefined}
              keyboardShouldPersistTaps="handled"
              refreshControl={boardRefreshControl({ refreshing, onRefresh })}
              contentContainerStyle={[
                {
                  paddingHorizontal: LAYOUT.screenPadding,
                  paddingTop: BOARD_TOP_PADDING,
                  paddingBottom: form ? LAYOUT.sectionGap : SP.xl,
                  gap: form ? LAYOUT.blockGap : LAYOUT.sectionGap,
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
                  paddingHorizontal: LAYOUT.screenPadding,
                  paddingTop: BOARD_TOP_PADDING,
                  paddingBottom: LAYOUT.sectionGap,
                  gap: LAYOUT.blockGap,
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
                borderTopWidth: 2.5,
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
