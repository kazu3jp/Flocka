import { Pressable, View } from "react-native";
import { C, F, Icon, OUTLINE, T } from "../../components/ui";
import { RequiredTag } from "../../components/chip";

/**
 * The source's memo row on the confirm screen: where and why the two met,
 * marked 必須 until both are filled, and opening the memo sheet on tap.
 */
export function ExchangeMemoRow({
  place,
  trigger,
  onPress,
}: {
  place: string;
  trigger: string;
  onPress: () => void;
}) {
  const memo = [place, trigger]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("・");
  const done = !!place.trim() && !!trigger.trim();
  return (
    <Pressable
      testID="exchange-context"
      accessibilityRole="button"
      accessibilityLabel={`出会いのメモを編集：${memo || "未入力"}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: pressed ? C.paper2 : C.paper,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        borderRadius: 16,
        boxShadow: OUTLINE.shadow,
      })}
    >
      <Icon name="edit" size={18} color={C.ink} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T color={C.ink} size={14} style={{ fontFamily: F.bold }}>
            出会いのメモ
          </T>
          {!done && <RequiredTag />}
        </View>
        {/* Wraps instead of the source's ellipsis: small screens never cut text off. */}
        <T color={C.muted} size={12.5}>
          {memo || "どこで、何をきっかけに？"}
        </T>
      </View>
      <Icon name="chev" size={18} color={C.ink} />
    </Pressable>
  );
}
