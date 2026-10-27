import { Pressable, View } from "react-native";
import {
  SNS_PLATFORM_LABELS,
  snsLinkDisplay,
  snsLinkUrl,
  type SnsLink,
} from "@flocka/domain";
import { C, F, T } from "../../components/ui";
import { SnsIcon } from "../../components/sns-icon";
import { useApp } from "../../store";
import { openSnsLink } from "./open-sns-link";

/**
 * The SNS links on a player card, laid out like the interests row above it.
 * Always labelled as self-declared: Flocka does not verify that the handle
 * belongs to the person on the card.
 */
export function SnsLinkList({ links }: { links: SnsLink[] }) {
  const { toast } = useApp();
  const openable = links.filter((link) => snsLinkUrl(link) !== null);
  if (!openable.length) return null;
  return (
    <View
      testID="sns-links"
      accessibilityLabel="SNS（自己申告・未確認）"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
      }}
    >
      <T
        display
        size={12}
        color={C.paper}
        style={{
          lineHeight: 12,
          backgroundColor: C.ink,
          paddingVertical: 6,
          paddingHorizontal: 8,
          borderRadius: 8,
        }}
      >
        SNS
      </T>
      {openable.map((link) => {
        const label = `${SNS_PLATFORM_LABELS[link.platform]} ${snsLinkDisplay(link)}`;
        return (
          <Pressable
            key={link.platform}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => {
              openSnsLink(link).catch((error: unknown) =>
                toast(
                  error instanceof Error
                    ? error.message
                    : "リンクを開けませんでした",
                ),
              );
            }}
            style={({ pressed }) => ({
              minHeight: 28,
              maxWidth: "100%",
              paddingHorizontal: 10,
              borderRadius: 99,
              borderWidth: 2,
              borderColor: C.ink,
              backgroundColor: pressed ? C.yellow : C.paper,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            })}
          >
            <SnsIcon platform={link.platform} size={14} color={C.ink} />
            <T
              size={12.5}
              color={C.ink}
              numberOfLines={1}
              style={{ flexShrink: 1, fontFamily: F.bold, lineHeight: 20.625 }}
            >
              {snsLinkDisplay(link)}
            </T>
          </Pressable>
        );
      })}
      <T size={11} color={C.muted}>
        自己申告・未確認
      </T>
    </View>
  );
}
