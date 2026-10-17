import React from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import {
  Avatar,
  Board,
  C,
  Envelope,
  F,
  Icon,
  LinkButton,
  LockedCard,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";

import { useApp } from "../../store";

function BannerCaption({ children }: { children: React.ReactNode }) {
  // The source's inline .cap sits on the 15px body text's 24.75px line box.
  return (
    <T size={15} color={C.ink} style={{ lineHeight: 24.75 }}>
      <T size={12.5} color={C.ink} style={{ lineHeight: 19.375 }}>
        {children}
      </T>
    </T>
  );
}

export function Deck() {
  const { s, d, nav, setOpening } = useApp(),
    { height, fontScale } = useWindowDimensions();
  const slots = [
    ...d.deck.slice(0, 6),
    ...Array(Math.max(0, 6 - d.deck.length)).fill(null),
  ];
  const unsent = s.connections.filter(
    (c) => c.status === "accepted" && !c.vibe && !s.blocked.includes(c.peerId),
  );
  const challenge = !!d.unopened.length,
    quest = challenge || !!unsent.length || !d.pieces.length;
  const goQuest = () =>
    challenge
      ? setOpening(d.unopened[0].id)
      : unsent.length
        ? nav.goTab("exchange", { id: "connections" })
        : nav.goTab("exchange");
  const largeText = fontScale > 1.2;
  const compact = height <= 720;
  const grid = (
    <View style={{ flex: largeText ? undefined : 1, gap: 10 }}>
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={{
            flex: largeText ? undefined : 1,
            height: largeText ? 200 : undefined,
            flexDirection: "row",
            gap: 10,
          }}
        >
          {slots
            .slice(row * 2, row * 2 + 2)
            .map((c, i) =>
              c ? (
                <StrengthCard
                  key={c.key}
                  card={c}
                  style={S.fill}
                  onPress={() => nav.push("card", { key: c.key })}
                />
              ) : (
                <LockedCard key={i} style={S.fill} />
              ),
            )}
        </View>
      ))}
    </View>
  );
  return (
    <Board>
      <View
        testID="deck-header"
        style={[S.row, { minHeight: compact ? 44 : 48 }]}
      >
        <Pressable
          accessibilityLabel="自分のページ"
          accessibilityRole="button"
          onPress={() => nav.push("me")}
          style={{
            width: 44,
            height: 44,
            marginLeft: -6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Avatar name={s.profile.name} avatar={s.profile.avatar} size={40} />
        </Pressable>
        <View style={S.fill}>
          <T display size={19} style={{ lineHeight: 22.8 }}>
            {s.profile.name}
          </T>
          <T
            size={12}
            color={C.pale}
            style={{ fontFamily: F.bold, lineHeight: 15.6 }}
          >
            強みカード {d.deck.length}枚
          </T>
        </View>
        <LinkButton
          label="印象を贈る"
          onPress={() =>
            nav.goTab(
              "exchange",
              s.connections.some(
                (c) => c.status === "accepted" && !s.blocked.includes(c.peerId),
              )
                ? { id: "connections" }
                : undefined,
            )
          }
        />
      </View>
      {quest && (
        <Pressable
          testID="deck-challenge"
          accessibilityRole="button"
          accessibilityLabel={
            challenge
              ? "予想チャレンジ！"
              : unsent.length
                ? "交換した人に印象を贈ろう"
                : "まずは交換しよう"
          }
          onPress={goQuest}
        >
          <Panel
            style={[
              S.row,
              {
                paddingVertical: compact ? 8 : 10,
                paddingHorizontal: compact ? 10 : 12,
                gap: 12,
                backgroundColor: C.yellow,
              },
            ]}
          >
            <View style={{ width: 52, height: 40 }}>
              {(challenge ? d.unopened.slice(0, 3) : [null]).map(
                (piece, index) => (
                  <View
                    key={piece?.id ?? "exchange"}
                    style={{
                      position: "absolute",
                      left: challenge ? index * 5 : 4,
                      top: challenge ? index * 3 : 4,
                      transform: [
                        { rotate: `${challenge ? (index - 1) * 8 : 0}deg` },
                      ],
                    }}
                  >
                    <Envelope size={44} />
                  </View>
                ),
              )}
            </View>
            <View style={S.fill}>
              <T display size={17} color={C.ink} style={{ lineHeight: 21.25 }}>
                {challenge
                  ? "予想チャレンジ！"
                  : unsent.length
                    ? "交換した人に印象を贈ろう"
                    : "まずは交換しよう"}
              </T>
              <BannerCaption>
                {challenge
                  ? `封筒${d.unopened.length}通・どのカードか当てよう`
                  : unsent.length
                    ? `まだ印象を贈っていない人が${unsent.length}人います`
                    : "会った人と、カードを交換"}
              </BannerCaption>
            </View>
            <T
              display
              size={14}
              color={C.yellow}
              style={{
                backgroundColor: C.ink,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                lineHeight: 14,
              }}
            >
              {challenge ? "開ける" : unsent.length ? "贈る" : "交換"}
            </T>
          </Panel>
        </Pressable>
      )}
      {largeText ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 4 }} style={S.fill}>
          {grid}
        </ScrollView>
      ) : (
        grid
      )}
      <Pressable
        testID="deck-pr"
        accessibilityRole="button"
        accessibilityLabel={
          d.prCard ? "自己PRが書けます！" : `自己PR あと証言${2 - d.best}人`
        }
        onPress={() => nav.goTab("pr")}
      >
        <Panel
          style={[
            S.row,
            {
              paddingVertical: 10,
              paddingHorizontal: 12,
              gap: 12,
              backgroundColor: d.prCard ? C.paper : C.ink,
              boxShadow: d.prCard ? `4px 4px 0 ${C.ink}` : "none",
            },
          ]}
        >
          <View
            style={{
              width: 40,
              height: 48,
              backgroundColor: d.prCard ? C.yellow : C.paper,
              borderWidth: 2.5,
              borderColor: C.ink,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T display color={C.ink} size={15} style={{ lineHeight: 15 }}>
              PR
            </T>
          </View>
          <View style={S.fill}>
            <T
              display
              size={16}
              color={d.prCard ? C.ink : C.white}
              style={{ lineHeight: 20.8 }}
            >
              {d.prCard
                ? "自己PRが書けます！"
                : `自己PR　あと証言${2 - d.best}人`}
            </T>
            {d.prCard ? (
              <BannerCaption>「{d.prCard.name}」から下書きを生成</BannerCaption>
            ) : (
              <View style={[S.row, { gap: 4, marginTop: 4 }]}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 26,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        i < d.best ? C.yellow : "rgba(255,255,255,0.2)",
                    }}
                  />
                ))}
              </View>
            )}
          </View>
          <Icon name="chev" color={d.prCard ? C.ink : C.white} />
        </Panel>
      </Pressable>
    </Board>
  );
}
