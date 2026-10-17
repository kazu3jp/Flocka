import React, { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { DECO, DECO_COLORS } from "@flocka/domain";
import {
  Board,
  Btn,
  C,
  F,
  Header,
  LinkButton,
  StrengthCard,
  T,
} from "../../components/ui";
import { DecorationSwatch } from "./DecorationSwatch";
import { useDecoration } from "./use-decoration";

export function Deco({ cardKey }: { cardKey: string }) {
  const {
    card,
    decoration,
    tab,
    setTab,
    select,
    reset,
    finish,
    busy,
    error,
    back,
  } = useDecoration(cardKey);
  const { height } = useWindowDimensions();
  const [optionsWidth, setOptionsWidth] = useState(0);
  const previewHeight =
    height <= 650 ? 150 : Math.max(170, Math.min(260, height * 0.3));
  if (!card)
    return (
      <Board>
        <Header title="カードをデコる" onBack={back} />
      </Board>
    );
  return (
    <Board contentStyle={{ gap: 8 }}>
      <Header
        title="カードをデコる"
        onBack={back}
        right={<LinkButton label="元に戻す" onPress={reset} disabled={busy} />}
      />
      <View
        testID="decoration-preview"
        style={{
          height: previewHeight,
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
        }}
      >
        <StrengthCard
          card={{ ...card, deco: decoration }}
          style={{
            height: previewHeight - 8,
            width: (previewHeight - 8) * 0.78,
          }}
        />
      </View>
      <View
        testID="decoration-tabs"
        accessibilityLabel="デコの種類"
        style={{ flexDirection: "row", gap: 6 }}
      >
        {(
          [
            ["pattern", "模様"],
            ["frame", "フレーム"],
            ["stickers", "シール"],
            ["color", "色"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            aria-pressed={tab === key}
            accessibilityState={{ selected: tab === key }}
            disabled={busy}
            onPress={() => setTab(key)}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 12,
              borderWidth: 2.5,
              borderColor: C.ink,
              backgroundColor: tab === key ? C.yellow : C.paper,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: tab === key ? `3px 3px 0 ${C.ink}` : "none",
            }}
          >
            <T
              color={C.ink}
              size={13}
              style={{ fontFamily: F.bold, lineHeight: 21.45 }}
            >
              {label}
            </T>
          </Pressable>
        ))}
      </View>
      <ScrollView
        testID="decoration-workspace"
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          paddingTop: 2,
          paddingHorizontal: 4,
          paddingBottom: 10,
        }}
      >
        <T
          size={12.5}
          color={C.pale}
          style={{ lineHeight: 19.375, marginBottom: 10 }}
        >
          {tab === "stickers"
            ? `4枚まで貼れます · 現在${decoration.stickers.length}枚。貼ったシールをもう一度タップすると外せます。`
            : tab === "color"
              ? "イラスト背景の色を選んで、模様と組み合わせよう。"
              : "自由に組み合わせて、自分らしい1枚に。"}
        </T>
        <View
          testID="decoration-options"
          onLayout={({ nativeEvent: { layout } }) =>
            setOptionsWidth(layout.width)
          }
          accessibilityLabel="選ぶ"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
        >
          {(tab === "color" ? DECO_COLORS : DECO[tab]).map(([key, label]) => {
            const selected =
              tab === "stickers"
                ? decoration.stickers.includes(key)
                : decoration[tab] === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                aria-pressed={selected}
                accessibilityState={{ selected }}
                disabled={busy}
                onPress={() => select(key)}
                style={{
                  width: optionsWidth ? (optionsWidth - 16) / 3 : "31%",
                  minHeight: tab === "stickers" ? 116 : 86,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  borderRadius: 14,
                  borderWidth: 2.5,
                  borderColor: C.ink,
                  backgroundColor: selected ? C.yellow : C.paper,
                  boxShadow: `2px 2px 0 ${C.ink}`,
                  transform:
                    selected && tab !== "stickers"
                      ? [{ translateX: -1 }, { translateY: -2 }]
                      : [],
                }}
              >
                <DecorationSwatch
                  tab={tab}
                  option={key}
                  cardKey={cardKey}
                  decoration={decoration}
                />
                <T
                  color={C.ink}
                  size={12.5}
                  style={{ fontFamily: F.bold, lineHeight: 20.625 }}
                >
                  {label}
                </T>
                {tab === "stickers" && (
                  <T
                    color={C.ink}
                    size={12.5}
                    style={{ lineHeight: 19.375, opacity: selected ? 1 : 0 }}
                  >
                    貼付済み
                  </T>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {error && (
        <T accessibilityRole="alert" color={C.yellow}>
          {error}
        </T>
      )}
      <Btn
        label={busy ? "保存中…" : "完了"}
        disabled={busy}
        onPress={() => void finish()}
      />
    </Board>
  );
}
