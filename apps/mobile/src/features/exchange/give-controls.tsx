import { View } from "react-native";
import { C, F, T } from "../../components/ui";

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
