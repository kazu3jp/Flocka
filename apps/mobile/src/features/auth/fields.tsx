import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, Field, S, T } from "../../components/ui";
const MARKS = {
  apple:
    "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701",
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
  return (
    <View style={{ gap: 6 }}>
      <View style={S.row}>
        <T size={13} style={S.fill}>
          パスワード
        </T>
        {signup && (
          <T size={12} color={C.pale}>
            8文字以上・英字と数字
          </T>
        )}
      </View>
      <View style={{ position: "relative" }}>
        <Field
          label="パスワード"
          hideLabel
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={signup ? "new-password" : "current-password"}
          maxLength={128}
          style={{ paddingRight: 64 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={show ? "パスワードを隠す" : "パスワードを表示"}
          accessibilityState={{ selected: show }}
          onPress={() => setShow(!show)}
          style={{
            position: "absolute",
            right: 6,
            bottom: 4,
            minHeight: 44,
            padding: 8,
            justifyContent: "center",
          }}
        >
          <T color={C.blue} size={12}>
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
  onPress: (provider: "apple" | "google") => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {(["apple", "google"] as const).map((provider) => {
        const enabled = available.includes(provider) && !busy;
        return (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={`${provider === "apple" ? "Apple" : "Google"}で続ける${enabled ? "" : "（未設定）"}`}
            accessibilityState={{ disabled: !enabled }}
            disabled={!enabled}
            onPress={() => onPress(provider)}
            style={[
              S.row,
              {
                minHeight: 52,
                justifyContent: "center",
                borderWidth: 2.5,
                borderColor: C.ink,
                borderRadius: 14,
                backgroundColor: C.paper,
                boxShadow: `2px 2px 0 ${C.ink}`,
                opacity: enabled ? 1 : 0.55,
              },
            ]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d={MARKS[provider]} fill={C.ink} />
            </Svg>
            <T color={C.ink} size={16}>
              {provider === "apple" ? "Apple" : "Google"}で続ける
            </T>
          </Pressable>
        );
      })}
      <View style={S.row}>
        <View style={{ height: 2, backgroundColor: C.dark, flex: 1 }} />
        <T size={12} color={C.pale}>
          または
        </T>
        <View style={{ height: 2, backgroundColor: C.dark, flex: 1 }} />
      </View>
    </View>
  );
}
