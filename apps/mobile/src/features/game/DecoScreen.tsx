import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { SvgXml } from "react-native-svg";
import vectors from "../../vectors.json";
import {
  Board,
  Btn,
  C,
  Choice,
  Header,
  LinkButton,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import {
  DECO,
  DECO_COLORS,
  bareCard,
  defaultDeco,
  type DecoData,
} from "@flocka/domain";
import { useApp } from "../../store";

export function Deco({ cardKey }: { cardKey: string }) {
  const { s, d, nav, update, toast } = useApp(),
    [tab, setTab] = useState<"pattern" | "frame" | "stickers" | "color">(
      "pattern",
    );
  const c = d.cards[cardKey];
  if (!c)
    return (
      <Board>
        <Header title="カードをデコる" onBack={nav.pop} />
      </Board>
    );
  const cur = s.deco[cardKey] || defaultDeco(),
    set = (patch: Partial<DecoData>) =>
      update((x) => {
        x.deco[cardKey] = { ...cur, ...patch };
      });
  const select = (key: string) => {
    if (tab !== "stickers") {
      set({ [tab]: key });
      return;
    }
    if (cur.stickers.includes(key)) {
      set({ stickers: cur.stickers.filter((v) => v !== key) });
      return;
    }
    if (cur.stickers.length >= 4) {
      toast("シールは4枚まで。貼っているシールを外すと追加できます");
      return;
    }
    const used = cur.stickers.map(
      (k, i) => cur.layout?.[k]?.position || ["br", "bl", "tr", "tl"][i],
    );
    set({
      stickers: [...cur.stickers, key],
      layout: {
        ...cur.layout,
        [key]: {
          position:
            ["br", "bl", "tr", "tl"].find((p) => !used.includes(p)) || "br",
          size: 23,
          angle: 12,
        },
      },
    });
  };
  return (
    <Board>
      <Header
        title="カードをデコる"
        onBack={nav.pop}
        right={
          <LinkButton
            label="元に戻す"
            onPress={() =>
              update((x) => {
                delete x.deco[cardKey];
              })
            }
          />
        }
      />
      <StrengthCard
        card={{ ...c, deco: cur }}
        large
        style={{ height: 285, width: 222, alignSelf: "center" }}
      />
      <View style={[S.row, { gap: 5 }]}>
        {(
          [
            ["pattern", "模様"],
            ["frame", "フレーム"],
            ["stickers", "シール"],
            ["color", "色"],
          ] as const
        ).map(([k, l]) => (
          <View key={k} style={S.fill}>
            <Choice label={l} selected={tab === k} onPress={() => setTab(k)} />
          </View>
        ))}
      </View>
      <T size={12}>
        {tab === "stickers"
          ? `4枚まで貼れます · 現在${cur.stickers.length}枚。もう一度タップすると外せます。`
          : "自由に組み合わせて、自分らしい1枚に。"}
      </T>
      <ScrollView style={S.fill} contentContainerStyle={{ paddingBottom: 6 }}>
        <View style={S.wrap}>
          {(tab === "color" ? DECO_COLORS : DECO[tab]).map(([k, l]) => (
            <View key={k} style={{ width: "31%" }}>
              <Choice
                label={l}
                selected={
                  tab === "stickers" ? cur.stickers.includes(k) : cur[tab] === k
                }
                onPress={() => select(k)}
              >
                <View style={{ alignItems: "center", gap: 4 }}>
                  {tab === "stickers" ? (
                    <SvgXml
                      xml={(vectors.stickers as Record<string, string>)[k]}
                      width={38}
                      height={38}
                    />
                  ) : (
                    <StrengthCard
                      card={{
                        ...bareCard(cardKey),
                        deco: { ...cur, [tab]: k, stickers: [] },
                      }}
                      style={{ height: 80, width: 56 }}
                    />
                  )}
                  <T color={C.ink} size={12}>
                    {l}
                  </T>
                </View>
              </Choice>
            </View>
          ))}
        </View>
      </ScrollView>
      <Btn
        label="完了"
        onPress={() => {
          toast("デコを保存しました");
          nav.pop();
        }}
      />
    </Board>
  );
}
