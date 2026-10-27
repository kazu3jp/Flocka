import React, { useState } from "react";
import {
  Pressable,
  View,
  useWindowDimensions,
  type TextInputProps,
} from "react-native";
import { GoogleMark } from "./GoogleMark";
import { useHiddenPasswordCharacters } from "../../components/use-hidden-password-characters";
import {
  C,
  F,
  Field,
  FieldMessage,
  Icon,
  S,
  T,
  inputMinHeight,
  OUTLINE,
} from "../../components/ui";

/** The shared form geometry from the original authentication screens. */
export function AuthHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={[S.row, { minHeight: 56, gap: 12 }]}>
      <View style={{ width: 44 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="戻る"
          onPress={onBack}
          style={{
            width: 44,
            height: 44,
            marginLeft: -6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="back" />
        </Pressable>
      </View>
      <T
        display
        size={18}
        style={{ flex: 1, textAlign: "center", lineHeight: 23.4 }}
      >
        {title}
      </T>
      <View style={{ width: 44 }} />
    </View>
  );
}

export function AuthField({
  label,
  error,
  style,
  ...props
}: TextInputProps & {
  label: string;
  /** Shown in the gap under the input, so it never moves the next field. */
  error?: string | null;
}) {
  return (
    <View style={{ gap: 10 }}>
      <T
        size={13}
        style={{ fontFamily: F.bold, lineHeight: 21.45, letterSpacing: 0.26 }}
      >
        {label}
      </T>
      <View>
        <Field
          {...props}
          label={label}
          hideLabel
          style={[{ minHeight: inputMinHeight(26.4), lineHeight: 26.4 }, style]}
        />
        <FieldMessage text={error} />
      </View>
    </View>
  );
}
export const validEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
export const validPassword = (value: string) =>
  value.length >= 8 &&
  value.length <= 128 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value);
export function PasswordField({
  value,
  onChange,
  signup = false,
}: {
  value: string;
  onChange: (value: string) => void;
  signup?: boolean;
}) {
  const [show, setShow] = useState(false);
  const { container, applyOnFocus } = useHiddenPasswordCharacters(!show);
  return (
    <View style={{ gap: 10 }}>
      <View style={S.row}>
        <T
          size={13}
          style={[
            S.fill,
            { fontFamily: F.bold, lineHeight: 21.45, letterSpacing: 0.26 },
          ]}
        >
          パスワード
        </T>
        {signup && (
          <T size={12} color={C.pale} style={{ lineHeight: 19.8 }}>
            8文字以上・英字と数字
          </T>
        )}
      </View>
      <View
        ref={container}
        collapsable={false}
        style={{ position: "relative" }}
      >
        <Field
          label="パスワード"
          onFocus={applyOnFocus}
          hideLabel
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={signup ? "new-password" : "current-password"}
          maxLength={128}
          style={{
            paddingRight: 72,
            minHeight: inputMinHeight(26.4),
            lineHeight: 26.4,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={show ? "パスワードを隠す" : "パスワードを表示"}
          aria-pressed={show}
          accessibilityState={{ selected: show }}
          onPress={() => setShow(!show)}
          hitSlop={{ top: 2, bottom: 2 }}
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: [{ translateY: "-50%" }],
            minWidth: 56,
            minHeight: 40,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <T color={C.ink} size={13} style={{ fontFamily: F.bold }}>
            {show ? "隠す" : "表示"}
          </T>
        </Pressable>
      </View>
    </View>
  );
}
export function SocialButtons({
  available,
  busy,
  onPress,
}: {
  available: string[];
  busy: boolean;
  onPress: (provider: "google") => void;
}) {
  const { height } = useWindowDimensions();
  return (
    <View style={{ gap: 10 }}>
      {(["google"] as const).map((provider) => {
        const enabled = available.includes(provider) && !busy;
        return (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={`Googleで続ける${enabled ? "" : "（未設定）"}`}
            aria-disabled={!enabled}
            disabled={!enabled}
            onPress={() => onPress(provider)}
            style={[
              S.row,
              {
                minHeight: height <= 720 ? 50 : 54,
                justifyContent: "center",
                borderWidth: OUTLINE.width,
                borderColor: C.ink,
                borderRadius: 14,
                backgroundColor: C.paper,
                boxShadow: OUTLINE.shadow,
                opacity: enabled ? 1 : 0.55,
              },
            ]}
          >
            <GoogleMark />
            {/* A line as tall as the font cuts off the descender of "g" on Android. */}
            <T
              color={C.ink}
              size={16}
              style={{ fontFamily: F.bold, lineHeight: 22 }}
            >
              Googleで続ける
            </T>
          </Pressable>
        );
      })}
      <View style={[S.row, { gap: 12, marginTop: 4 }]}>
        <View style={{ height: 2, backgroundColor: C.dark, flex: 1 }} />
        <T
          size={12}
          color={C.pale}
          style={{ fontFamily: F.bold, lineHeight: 19.8 }}
        >
          または
        </T>
        <View style={{ height: 2, backgroundColor: C.dark, flex: 1 }} />
      </View>
    </View>
  );
}
