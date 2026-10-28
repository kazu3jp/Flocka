import { Pressable, View } from "react-native";
import { CARDS, SELF_OPTIONS } from "@flocka/domain";
import { CachedSvgXml } from "../../components/cached-svg-xml";
import { C, F, OUTLINE, S, T } from "../../components/ui";
import vectors from "../../vectors.json";

const CARD_ART = vectors.cards as Record<string, string>;

function CardChoice({
  cardKey,
  selected,
  suggested,
  onPress,
}: {
  cardKey: string;
  selected: boolean;
  suggested: boolean;
  onPress: () => void;
}) {
  const name = CARDS[cardKey].name;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={suggested ? `${name}（AIの提案）` : name}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        backgroundColor: selected ? C.yellow : C.paper,
        boxShadow: OUTLINE.shadow,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {CARD_ART[cardKey] ? (
        <CachedSvgXml xml={CARD_ART[cardKey]} width={26} height={26} />
      ) : null}
      <T size={14.5} color={C.ink} style={{ fontFamily: F.bold }}>
        {name}
      </T>
      {suggested ? (
        <T
          size={10.5}
          color={C.yellow}
          style={{
            fontFamily: F.bold,
            backgroundColor: C.ink,
            borderRadius: 5,
            paddingHorizontal: 5,
            paddingVertical: 1,
          }}
        >
          AI
        </T>
      ) : null}
    </Pressable>
  );
}

/**
 * The strength a testimony is for. The recipient's own picks come first,
 * since a testimony that backs one of them confirms that card; every other
 * strength follows.
 */
export function TestimonyCardPicker({
  selected,
  suggested,
  peerSelf,
  onChange,
}: {
  selected: string;
  suggested: string | null;
  peerSelf: string[];
  onChange: (key: string) => void;
}) {
  const own = SELF_OPTIONS.filter((key) => peerSelf.includes(key)),
    others = SELF_OPTIONS.filter((key) => !peerSelf.includes(key));
  const group = (keys: string[]) => (
    <View style={S.wrap}>
      {keys.map((key) => (
        <CardChoice
          key={key}
          cardKey={key}
          selected={selected === key}
          suggested={suggested === key}
          onPress={() => onChange(key)}
        />
      ))}
    </View>
  );
  return (
    <View
      testID="give-options"
      accessibilityRole="radiogroup"
      accessibilityLabel="強み"
      style={{ gap: 10 }}
    >
      {own.length > 0 && (
        <>
          <T size={12.5} color={C.pale} style={{ lineHeight: 19.375 }}>
            本人が選んだ強み
          </T>
          {group(own)}
          <T size={12.5} color={C.pale} style={{ lineHeight: 19.375 }}>
            ほかの強み
          </T>
        </>
      )}
      {group(others)}
    </View>
  );
}
