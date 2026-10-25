import React, { useState } from "react";
import {
  Pressable,
  View,
  useWindowDimensions,
  type TextInputProps,
} from "react-native";
import Svg, { Path } from "react-native-svg";
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
const MARKS = {
  google:
    "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
};
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
                borderWidth: 2.5,
                borderColor: C.ink,
                borderRadius: 14,
                backgroundColor: C.paper,
                boxShadow: `3px 3px 0 ${C.ink}`,
                opacity: enabled ? 1 : 0.55,
              },
            ]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d={MARKS[provider]} fill={C.ink} />
            </Svg>
            <T
              color={C.ink}
              size={16}
              style={{ fontFamily: F.bold, lineHeight: 16 }}
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
