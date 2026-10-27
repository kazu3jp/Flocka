import { Pressable, View } from "react-native";
import { VIBES } from "@flocka/domain";
import { C, F, S, T } from "../../components/ui";

export function GiveMode({
  mode,
  onChange,
}: {
  mode: "pick" | "free";
  onChange: (mode: "pick" | "free") => void;
}) {
  return (
    <View
      style={[S.row, { gap: 6 }]}
      accessibilityRole="tablist"
      accessibilityLabel="贈り方"
    >
      {(["pick", "free"] as const).map((value) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === value }}
          aria-selected={mode === value}
          onPress={() => onChange(value)}
          // 42 tall as in the design; the tap area reaches the full target.
          hitSlop={{ top: 1, bottom: 1 }}
          style={{
            flex: 1,
            minHeight: 42,
            borderWidth: 2.5,
            borderColor: C.ink,
            borderRadius: 12,
            backgroundColor: mode === value ? C.yellow : C.paper,
            boxShadow: mode === value ? `3px 3px 0 ${C.ink}` : "none",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <T
            size={13}
            color={C.ink}
            style={{ fontFamily: F.bold, lineHeight: 21.45 }}
          >
            {value === "pick" ? "言葉を選ぶ" : "自由に書く"}
          </T>
        </Pressable>
      ))}
    </View>
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
            borderWidth: 2.5,
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
