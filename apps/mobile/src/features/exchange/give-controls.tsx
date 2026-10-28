import { Pressable, View } from "react-native";
import { VIBES, VIBE_CARD } from "@flocka/domain";
import { CachedSvgXml } from "../../components/cached-svg-xml";
import { SegmentedTabs } from "../../components/segmented-tabs";
import { C, F, T, OUTLINE } from "../../components/ui";
import vectors from "../../vectors.json";

const GIVE_MODES = [
  ["pick", "言葉を選ぶ"],
  ["free", "自由に書く"],
] as const;

export function GiveMode({
  mode,
  onChange,
}: {
  mode: "pick" | "free";
  onChange: (mode: "pick" | "free") => void;
}) {
  return (
    <SegmentedTabs
      label="贈り方"
      options={GIVE_MODES}
      selected={mode}
      onSelect={onChange}
    />
  );
}

/**
 * A numbered step of the form (the source's .give-step): a yellow badge with
 * the number and what to do, so the screen reads as two short steps instead
 * of a paragraph of instructions.
 */
export function GiveStep({
  number,
  title,
  note,
}: {
  number: number;
  title: string;
  note?: string;
}) {
  return (
    <View
      accessibilityRole="header"
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: C.ink,
          backgroundColor: C.yellow,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <T display size={14} color={C.ink} style={{ lineHeight: 16 }}>
          {number}
        </T>
      </View>
      <T
        style={{
          fontFamily: F.bold,
          fontSize: 16,
          lineHeight: 24,
          flexShrink: 1,
        }}
      >
        {title}
      </T>
      {note ? (
        <T size={12.5} color={C.pale} style={{ marginLeft: "auto" }}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

const CARD_ART = vectors.cards as Record<string, string>;

export function VibeOptions({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <View
      testID="give-options"
      accessibilityRole="radiogroup"
      accessibilityLabel="印象"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
    >
      {VIBES.map((value) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityLabel={value}
          accessibilityState={{ checked: selected === value }}
          aria-checked={selected === value}
          onPress={() => onChange(value)}
          style={{
            width: "auto",
            flexBasis: "45%",
            flexGrow: 1,
            minHeight: 58,
            paddingHorizontal: 10,
            borderRadius: 14,
            borderWidth: OUTLINE.width,
            borderColor: C.ink,
            backgroundColor: selected === value ? C.yellow : C.paper,
            boxShadow: `${selected === value ? 4 : 3}px ${selected === value ? 4 : 3}px 0 ${C.ink}`,
            transform: [
              { translateY: selected === value ? -4 : 0 },
              { rotate: selected === value ? "-1.5deg" : "0deg" },
            ],
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {/* The strength this word counts toward, drawn as its card's art. */}
          {CARD_ART[VIBE_CARD[value]] ? (
            <CachedSvgXml
              xml={CARD_ART[VIBE_CARD[value]]}
              width={30}
              height={30}
            />
          ) : null}
          <T
            display
            size={16}
            color={C.ink}
            style={{ lineHeight: 21.6, textAlign: "center", flexShrink: 1 }}
          >
            {value}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
