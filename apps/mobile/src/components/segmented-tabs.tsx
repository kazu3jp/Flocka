import { Pressable, View } from "react-native";
import { C, F, OUTLINE } from "./theme";
import { T } from "./text";

/**
 * A row of equal tabs, as the source's .seg: the selected one is filled and
 * lifted on its shadow. Drawn 42 tall like the design; the tap area reaches
 * the full touch target.
 */
export function SegmentedTabs<Key extends string>({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
  testID,
}: {
  /** Names the tab list for screen readers. */
  label: string;
  options: readonly (readonly [Key, string])[];
  selected: Key;
  onSelect: (key: Key) => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexDirection: "row", gap: 6 }}
    >
      {options.map(([key, text]) => {
        const active = selected === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={text}
            accessibilityState={{ selected: active, disabled }}
            aria-selected={active}
            disabled={disabled}
            onPress={() => onSelect(key)}
            hitSlop={{ top: 1, bottom: 1 }}
            style={{
              flex: 1,
              minHeight: 42,
              borderWidth: OUTLINE.width,
              borderColor: C.ink,
              borderRadius: 12,
              backgroundColor: active ? C.yellow : C.paper,
              boxShadow: active ? OUTLINE.shadow : "none",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <T
              size={13}
              color={C.ink}
              style={{ fontFamily: F.bold, lineHeight: 21.45 }}
            >
              {text}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
