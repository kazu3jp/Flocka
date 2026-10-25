import { View } from "react-native";
import {
  SNS_PLATFORM_LABELS,
  snsLinkDisplay,
  snsLinkUrl,
  type SnsLink,
} from "@flocka/domain";
import { C, LinkButton, T } from "../../components/ui";
import { useApp } from "../../store";
import { openSnsLink } from "./open-sns-link";

/**
 * The SNS links on a player card. Always labelled as self-declared: Flocka does
 * not verify that the handle belongs to the person on the card.
 */
export function SnsLinkList({ links }: { links: SnsLink[] }) {
  const { toast } = useApp();
  const openable = links.filter((link) => snsLinkUrl(link) !== null);
  if (!openable.length) return null;
  return (
    <View
      testID="sns-links"
      accessibilityLabel="SNS（自己申告）"
      style={{ gap: 4 }}
    >
      <T size={11} color={C.muted}>
        SNS（自己申告・未確認）
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {openable.map((link) => (
          <LinkButton
            key={link.platform}
            color={C.ink}
            label={`${SNS_PLATFORM_LABELS[link.platform]} ${snsLinkDisplay(link)}`}
            onPress={() => {
              openSnsLink(link).catch((error: unknown) =>
                toast(
                  error instanceof Error
                    ? error.message
                    : "リンクを開けませんでした",
                ),
              );
            }}
          />
        ))}
      </View>
    </View>
  );
}
