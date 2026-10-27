import { Pressable, View } from "react-native";
import { VIBES } from "@flocka/domain";
import { SegmentedTabs } from "../../components/segmented-tabs";
import { C, T, OUTLINE } from "../../components/ui";

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
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T
            display
            size={16}
            color={C.ink}
            style={{ lineHeight: 21.6, textAlign: "center" }}
          >
            {value}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
