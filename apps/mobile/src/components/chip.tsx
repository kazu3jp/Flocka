import { View } from "react-native";
import { C, F } from "./theme";
import { T } from "./text";

/** The source's .chip: a short status in an ink pill on the blue board. */
export function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        minHeight: 32,
        paddingHorizontal: 10,
        borderRadius: 99,
        backgroundColor: C.ink,
        justifyContent: "center",
      }}
    >
      <T size={12.5} color={C.white} style={{ fontFamily: F.bold }}>
        {label}
      </T>
    </View>
  );
}

/** The source's .req-tag: marks a field that must be filled to go on. */
export function RequiredTag() {
  return (
    <View
      style={{
        minHeight: 20,
        paddingHorizontal: 7,
        borderRadius: 99,
        backgroundColor: C.ink,
        justifyContent: "center",
      }}
    >
      <T
        size={11}
        color={C.yellow}
        style={{ fontFamily: F.bold, letterSpacing: 0.22 }}
      >
        必須
      </T>
    </View>
  );
}
