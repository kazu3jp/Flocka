import { useState } from "react";
import { TextInput, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { CARDS, SELF_OPTIONS } from "@flocka/domain";
import vectors from "../../vectors.json";
import { C, Choice, F, Panel, S, T } from "../../components/ui";

export function GiveReason({
  mode,
  text,
  onChange,
}: {
  mode: "pick" | "free";
  text: string;
  onChange: (text: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const label = mode === "pick" ? "なぜそう感じましたか？" : "印象と、その理由";
  return (
    <View testID="give-reason">
      <T
        size={13}
        style={{ fontFamily: F.bold, lineHeight: 21.45, marginBottom: 6 }}
      >
        {label}
      </T>
      <TextInput
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        multiline
        maxLength={140}
        value={text}
        onChangeText={onChange}
        placeholder={
          mode === "pick"
            ? "例：発表の準備中、困っている人に声をかけてくれたから"
            : "例：LTの質問が的確で、初対面なのにすごく話しやすかった"
        }
        placeholderTextColor={C.muted}
        style={[
          S.input,
          {
            minHeight: mode === "pick" ? 100 : 130,
            lineHeight: 27.2,
            textAlignVertical: "top",
            // Match the inline textarea baseline spacing in the source field.
            marginBottom: 6.75,
            outlineStyle: "solid",
            outlineWidth: focused ? 3 : 0,
            outlineOffset: 1,
            outlineColor: C.yellow,
          },
        ]}
      />
      {mode === "pick" && (
        <T size={12.5} color={C.pale} style={{ lineHeight: 24.75 }}>
          短いひとことでも大丈夫です（必須・140文字まで）
        </T>
      )}
    </View>
  );
}

export function ImpressionLabel({
  label,
  title = "印象",
}: {
  label: string;
  title?: string;
}) {
  return (
    <View style={[S.row, { alignItems: "baseline", gap: 8 }]}>
      <T
        size={11}
        color={C.yellow}
        style={{
          fontFamily: F.bold,
          lineHeight: 11,
          borderRadius: 6,
          backgroundColor: C.ink,
          paddingVertical: 4,
          paddingHorizontal: 7,
        }}
      >
        {title}
      </T>
      <T display size={18} color={C.ink} style={{ lineHeight: 25.2 }}>
        {label}
      </T>
    </View>
  );
}

export function ImpressionSummary({
  summary,
  onChange,
}: {
  summary: { card: string; label: string };
  onChange: (card: string) => void;
}) {
  return (
    <Panel style={{ padding: 12 }}>
      <ImpressionLabel label={summary.label} title="要約" />
      <T
        size={12.5}
        color={C.muted}
        style={{ lineHeight: 19.375, marginTop: 8, marginBottom: 6 }}
      >
        近い強みカード（変更できます）
      </T>
      <View style={S.wrap}>
        {SELF_OPTIONS.map((key) => (
          <Choice
            key={key}
            label={CARDS[key].name}
            selected={summary.card === key}
            onPress={() => onChange(key)}
            style={{
              minHeight: 36,
              paddingVertical: 0,
              paddingHorizontal: 10,
              borderWidth: 2.5,
              boxShadow: `3px 3px 0 ${C.ink}`,
            }}
          >
            <View style={[S.row, { gap: 6 }]}>
              <SvgXml
                xml={(vectors.cards as Record<string, string>)[key]}
                width={26}
                height={26}
              />
              <T size={13} color={C.ink} style={{ fontFamily: F.bold }}>
                {CARDS[key].name}
              </T>
            </View>
          </Choice>
        ))}
      </View>
      <T
        size={12.5}
        color={C.muted}
        style={{ lineHeight: 19.375, marginTop: 8 }}
      >
        キーワードをもとに短い印象にまとめます。原文と要約を一緒に表示します。
      </T>
    </Panel>
  );
}
