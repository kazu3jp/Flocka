import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { CachedSvgXml } from "../../components/cached-svg-xml";
import { CARDS, SELF_OPTIONS } from "@flocka/domain";
import vectors from "../../vectors.json";
import { C, F, S, T, OUTLINE } from "../../components/ui";
import { PeerAvatar } from "./player-card";

export function MemoProgress({ step }: { step: number }) {
  return (
    <View
      testID="memo-progress"
      style={[
        S.row,
        {
          gap: 6,
          minHeight: 32,
          paddingHorizontal: 10,
          borderRadius: 99,
          backgroundColor: C.ink,
        },
      ]}
    >
      <T display size={15} color={C.yellow} style={{ lineHeight: 15 }}>
        {step + 1}
      </T>
      <T size={12.5} style={{ fontFamily: F.bold, lineHeight: 20.625 }}>
        / 3
      </T>
    </View>
  );
}

export function MemoRecipient({
  id,
  name,
  context,
  selected,
  onPress,
}: {
  id: string;
  name: string;
  context: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={{
        minHeight: 62,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        backgroundColor: selected ? C.yellow : C.paper,
        boxShadow: OUTLINE.shadow,
      }}
    >
      <PeerAvatar id={id} size={36} />
      <View style={{ flex: 1 }}>
        <T color={C.ink} style={{ fontFamily: F.bold, lineHeight: 24.75 }}>
          {name}
        </T>
        <T size={12.5} color={C.muted} style={{ lineHeight: 24.75 }}>
          {context}
        </T>
      </View>
    </Pressable>
  );
}

export function MemoStrengths({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (key: string) => void;
}) {
  return (
    <View
      testID="memo-strengths"
      style={S.wrap}
      accessibilityRole="radiogroup"
      accessibilityLabel="強み"
    >
      {SELF_OPTIONS.map((key) => (
        <Pressable
          key={key}
          accessibilityRole="radio"
          accessibilityLabel={CARDS[key].name}
          accessibilityState={{ checked: selected === key }}
          aria-checked={selected === key}
          aria-pressed={selected === key}
          onPress={() => onChange(key)}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: OUTLINE.width,
            borderColor: C.ink,
            backgroundColor: selected === key ? C.yellow : C.paper,
            boxShadow: OUTLINE.shadow,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CachedSvgXml
            xml={(vectors.cards as Record<string, string>)[key]}
            width={26}
            height={26}
          />
          <T
            size={14.5}
            color={C.ink}
            style={{ fontFamily: F.bold, lineHeight: 23.925 }}
          >
            {CARDS[key].name}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

export function MemoStory({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View testID="memo-story">
      <TextInput
        accessibilityLabel="場面"
        multiline
        maxLength={80}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="例：登壇後の質問に、図を描いて答えてくれた"
        placeholderTextColor={C.muted}
        style={[
          S.input,
          {
            minHeight: 130,
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
    </View>
  );
}
