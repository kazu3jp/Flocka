import { View } from "react-native";
import { C, LAYOUT, Panel, SP, T } from "../../components/ui";
import type { VisibilityLine } from "./settings-view-model";

/** Who can see or send what right now, one label and one value per line. */
export function VisibilitySummary({ lines }: { lines: VisibilityLine[] }) {
  return (
    <Panel style={{ gap: 0, paddingVertical: SP.sm }}>
      {lines.map((line, index) => (
        <View
          key={line.key}
          accessible
          accessibilityLabel={`${line.label}、${line.value}`}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: SP.md,
            paddingVertical: SP.md,
            borderTopWidth: index === 0 ? 0 : 1.5,
            borderTopColor: C.grey,
            minHeight: LAYOUT.touchTarget,
          }}
        >
          <T size={12} color={C.muted} style={{ width: 96, paddingTop: 2 }}>
            {line.label}
          </T>
          <T size={14} color={C.ink} style={{ flex: 1, minWidth: 0 }}>
            {line.value}
          </T>
        </View>
      ))}
    </Panel>
  );
}
