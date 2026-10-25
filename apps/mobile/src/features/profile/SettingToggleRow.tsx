import { Switch, View } from "react-native";
import { C, F, LAYOUT, SP, T } from "../../components/ui";

/**
 * A switch with its label and a one-line explanation. The text column takes
 * the free width and the switch keeps its own, so toggling moves nothing.
 */
export function SettingToggleRow({
  label,
  hint,
  value,
  first,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  first: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: LAYOUT.blockGap,
        minHeight: LAYOUT.touchTarget,
        paddingVertical: SP.md,
        borderTopWidth: first ? 0 : 1.5,
        borderTopColor: C.grey,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T color={C.ink} style={{ fontFamily: F.bold }}>
          {label}
        </T>
        <T size={12} color={C.muted}>
          {hint}
        </T>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: C.blue, false: C.grey }}
      />
    </View>
  );
}
