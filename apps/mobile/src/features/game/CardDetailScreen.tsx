import React from "react";
import { Pressable, View } from "react-native";
import {
  Board,
  Btn,
  C,
  Choice,
  Header,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import { wordsOf } from "@flocka/domain";
import { useApp } from "../../store";

export function CardDetail({ cardKey }: { cardKey: string }) {
  const { s, d, nav, update, peers } = useApp(),
    c = d.cards[cardKey];
  if (!c)
    return (
      <Board>
        <Header title="カード" onBack={nav.pop} />
        <T>カードが見つかりませんでした。</T>
      </Board>
    );
  return (
    <Board scroll>
      <Header title="カード詳細" onBack={nav.pop} />
      <StrengthCard
        card={c}
        large
        style={{ height: 340, width: 265, alignSelf: "center" }}
      />
      <Btn
        plain
        label="このカードをデコる"
        onPress={() => nav.push("deco", { key: cardKey })}
      />
      <Panel>
        <T color={C.ink}>
          {c.confirmed
            ? "異なる2人以上の証言で確認済みになりました。"
            : c.discovered
              ? "仲間の証言から見つかった、あなたの新しい一面です。"
              : c.testimonies.length
                ? "あと1人の証言で確認済みに。"
                : "自分が選んだ「自己申告」のカードです。"}
        </T>
      </Panel>
      {c.discovered && (
        <>
          <T display size={18}>
            この強み、どう感じる？
          </T>
          <View style={S.row}>
            {(
              [
                ["agree", "納得"],
                ["hold", "保留"],
                ["disagree", "違うかも"],
              ] as const
            ).map(([r, l]) => (
              <Choice
                key={r}
                selected={s.resp[cardKey] === r}
                label={l}
                onPress={() =>
                  update((x) => {
                    x.resp[cardKey] = r;
                  })
                }
              />
            ))}
          </View>
          <T size={12}>「違うかも」を選んだカードは自己PRに使いません。</T>
        </>
      )}
      <T display size={18}>
        仲間の証言 · {c.givers.length}人
      </T>
      {c.testimonies.map((p) => (
        <Pressable
          accessibilityRole="button"
          key={p.id}
          onPress={() => nav.push("piece", { id: p.id })}
        >
          <Panel>
            <T color={C.ink}>
              {peers[p.fromId]?.profile.name ?? "プロフィールを取得中"} ·{" "}
              {p.guess === "skip"
                ? "予想なし"
                : p.guess === p.card
                  ? "的中"
                  : "予想外"}
            </T>
            <T color={C.muted} size={13}>
              「{wordsOf(p)}」
            </T>
          </Panel>
        </Pressable>
      ))}
    </Board>
  );
}
