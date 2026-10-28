import { useState } from "react";
import { TextInput, View } from "react-native";
import { C, S, T } from "../../components/ui";
import type { TestimonyKind } from "./testimony-kind";

/**
 * What the giver saw or felt. The numbered step above names the field; its
 * label here is for screen readers.
 */
export function GiveReason({
  kind,
  text,
  maxLength,
  onChange,
}: {
  kind: TestimonyKind;
  text: string;
  maxLength: number;
  onChange: (text: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View testID="give-reason">
      <TextInput
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={
          kind === "vibe" ? "感じたこととその理由" : "見た場面"
        }
        multiline
        maxLength={maxLength}
        value={text}
        onChangeText={onChange}
        placeholder={
          kind === "vibe"
            ? "例：初対面でも話しかけてくれて、すぐ打ち解けられた"
            : "例：登壇後の質問に、図を描いて答えてくれた"
        }
        placeholderTextColor={C.muted}
        style={[
          S.input,
          {
            minHeight: 110,
            lineHeight: 27.2,
            textAlignVertical: "top",
            marginBottom: 6.75,
            outlineStyle: "solid",
            outlineWidth: focused ? 3 : 0,
            outlineOffset: 1,
            outlineColor: C.yellow,
          },
        ]}
      />
      <T
        size={12.5}
        color={C.pale}
        style={{ lineHeight: 19.375, textAlign: "right" }}
      >
        {text.length}/{maxLength}
      </T>
    </View>
  );
}
