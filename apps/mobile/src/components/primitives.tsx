import React, { createContext, useContext } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";

import { C, F, S } from "./theme";
import { T, Icon } from "./text";

export function Panel(props: ViewProps) {
  return <View {...props} style={[S.panel, props.style]} />;
}

export function Btn({
  label,
  onPress,
  disabled = false,
  plain = false,
  danger = false,
  small = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  plain?: boolean;
  danger?: boolean;
  small?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 44 : 54,
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
      {icon && <Icon name={icon} color={danger ? C.white : C.ink} />}
      <T
        display
        size={small ? 13 : 17}
        color={disabled ? C.pale : danger ? C.white : C.ink}
        style={{ textAlign: "center" }}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  color = C.white,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
    >
      <T
        color={color}
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
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      aria-pressed={!!selected}
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
      <T display size={20} style={{ flex: 1, lineHeight: 26 }}>
        {title}
      </T>
      {right}
    </View>
  );
}

export const BoardInsets = createContext({ top: true, bottom: true });
const BoardScroll = createContext(false);

export function Board({
  children,
  scroll = false,
  footer,
  safeTop,
  safeBottom,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  safeTop?: boolean;
  safeBottom?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
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
      <BoardScroll.Provider value={scroll}>
        <KeyboardAvoidingView
          style={S.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {scroll ? (
            <ScrollView
              stickyHeaderIndices={stickyHeader ? [0] : undefined}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                {
                  paddingHorizontal: 14,
                  paddingTop: 4,
                  paddingBottom: 24,
                  gap: 12,
                  flexGrow: 1,
                },
                contentStyle,
              ]}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={{
                flex: 1,
                paddingHorizontal: 14,
                paddingTop: 4,
                paddingBottom: 12,
                gap: 10,
              }}
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
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#11182788",
        }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityLabel="シートを閉じる"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            maxHeight: "90%",
            backgroundColor: C.blue,
            borderTopWidth: 2.5,
            borderColor: C.ink,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 18,
          }}
        >
          <View style={S.row}>
            <T display size={20} style={S.fill}>
              {title}
            </T>
            <Pressable
              accessibilityLabel="閉じる"
              accessibilityRole="button"
              onPress={onClose}
              style={{ padding: 12 }}
            >
              <Icon name="x" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
