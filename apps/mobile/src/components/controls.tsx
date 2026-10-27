import React, { useContext } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type AccessibilityRole,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";

import { C, F, LAYOUT, S, SP, OUTLINE } from "./theme";
import { T, Icon, ForegroundColor } from "./text";
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
          borderWidth: OUTLINE.width,
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
