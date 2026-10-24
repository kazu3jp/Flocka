import React from "react";
import { Pressable, View } from "react-native";
import {
  Board,
  Btn,
  C,
  Choice,
  F,
  Header,
  LAYOUT,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import { wordsOf } from "@flocka/domain";
import { useApp } from "../../store";

export function CardDetail({ cardKey }: { cardKey: string }) {
  const { s, d, nav, update, peers } = useApp();
  const card = d.cards[cardKey];
  if (!card)
    return (
      <Board>
        <Header title="カード" onBack={nav.pop} />
        <T>カードが見つかりませんでした。</T>
      </Board>
    );
  const response = s.resp[cardKey];
  const explanation = card.confirmed
    ? response === "disagree"
      ? "2人以上が別々に同じ強みを挙げています。"
      : "2人以上が別々に同じ強みを挙げています。自己PRに使えます。"
    : card.discovered
      ? "自分では選ばなかった強みです。あと1人の証言で確認済みになります。"
      : card.testimonies.length
        ? "あと1人の証言で確認済みになります。"
        : card.self
          ? "あなたが選んだ強みです。仲間の証言が届くのを待とう。"
          : "表示中の証言はありません。非表示にした証言は「届いた証言」から戻せます。";
  // Once answered, the reaction stays changeable even if the card is no longer
  // a discovery, so "違うかも" can always be undone.
  const showResponse = card.discovered || response !== undefined;
  return (
    <Board scroll>
      <Header title={card.name} onBack={nav.pop} />
      <StrengthCard
        card={card}
        style={{ height: 230, width: "62%", alignSelf: "center" }}
        height={230}
      />
      <Btn
        plain
        icon="spark"
        label="このカードをデコる"
        onPress={() => nav.push("deco", { key: cardKey })}
      />
      <T
        size={14}
        // The confirmed wording changes length with the reaction below, so
        // that case keeps two lines and the reaction panel stays put.
        style={{
          textAlign: "center",
          lineHeight: 22.4,
          minHeight: card.confirmed ? 44.8 : undefined,
        }}
      >
        {explanation}
      </T>
      {showResponse && (
        <Panel style={{ padding: LAYOUT.panelPaddingCompact, gap: 8 }}>
          <T
            size={16}
            color={C.ink}
            style={{ fontFamily: F.bold, lineHeight: 24 }}
          >
            {card.discovered
              ? "この新発見、どう思う？"
              : "このカード、どう思う？"}
          </T>
          <View style={[S.row, { gap: 8 }]}>
            {(
              [
                ["agree", "納得"],
                ["hold", "保留"],
                ["disagree", "違うかも"],
              ] as const
            ).map(([response, label]) => (
              <Choice
                key={response}
                selected={s.resp[cardKey] === response}
                label={label}
                selectedColor={C.pink}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderWidth: 2.5,
                  alignItems: "center",
                }}
                onPress={() =>
                  update((state) => {
                    state.resp[cardKey] = response;
                  })
                }
              >
                <T size={14} color={C.ink} style={{ fontFamily: F.bold }}>
                  {label}
                </T>
              </Choice>
            ))}
          </View>
          {/* Always laid out; it only shows after "違うかも", so the panel keeps its height. */}
          <T
            size={12.5}
            color={C.muted}
            accessibilityElementsHidden={s.resp[cardKey] !== "disagree"}
            importantForAccessibility={
              s.resp[cardKey] === "disagree" ? "auto" : "no-hide-descendants"
            }
            style={{
              fontFamily: F.bold,
              lineHeight: 19.375,
              opacity: s.resp[cardKey] === "disagree" ? 1 : 0,
            }}
          >
            自己PRには使いません。証言は残ります。
          </T>
        </Panel>
      )}
      <T size={16} style={{ fontFamily: F.bold, lineHeight: 24 }}>
        証言（{card.testimonies.length}件）
      </T>
      {!card.testimonies.length && (
        <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
          まだ届いていません
        </T>
      )}
      {card.testimonies.map((piece) => {
        const connection = s.connections.find(
          (item) => item.peerId === piece.fromId && item.status === "accepted",
        );
        const name =
          peers[piece.fromId]?.profile.name ?? "プロフィールを取得中";
        const guess =
          piece.guess === "skip"
            ? "なし"
            : piece.guess === piece.card
              ? "的中"
              : "外れ";
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name}の証言を開く`}
            key={piece.id}
            onPress={() => nav.push("piece", { id: piece.id })}
          >
            <Panel
              style={{ padding: LAYOUT.panelPaddingCompact, borderRadius: 14 }}
            >
              <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
                {name}
                {connection?.context.place
                  ? `・${connection.context.place}`
                  : ""}
                　予想：{guess}
              </T>
              <T
                color={C.ink}
                size={16}
                style={{ fontFamily: F.bold, lineHeight: 27.2 }}
              >
                {piece.kind === "proof" && piece.title
                  ? `${piece.title}\n`
                  : ""}
                「{wordsOf(piece)}」
              </T>
              {piece.kind === "vibe" && piece.text ? (
                <View
                  style={[
                    S.row,
                    { alignItems: "baseline", gap: 8, marginTop: 10 },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: C.ink,
                      paddingVertical: 4,
                      paddingHorizontal: 7,
                      borderRadius: 6,
                    }}
                  >
                    <T
                      color={C.yellow}
                      size={11}
                      style={{ fontFamily: F.bold, lineHeight: 11 }}
                    >
                      要約
                    </T>
                  </View>
                  <T
                    display
                    color={C.ink}
                    size={18}
                    style={{ flex: 1, lineHeight: 25.2 }}
                  >
                    {piece.label}
                  </T>
                </View>
              ) : null}
            </Panel>
          </Pressable>
        );
      })}
    </Board>
  );
}
