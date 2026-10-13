import React from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import {
  Avatar,
  Board,
  C,
  Envelope,
  Icon,
  LinkButton,
  LockedCard,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";

import { useApp } from "../../store";

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
  const small = height < 740 || fontScale > 1.2;
  const grid = (
    <View style={{ flex: small ? undefined : 1, gap: 10 }}>
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={{
            flex: small ? undefined : 1,
            height: small ? 200 : undefined,
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
      <View style={[S.row, { minHeight: 48 }]}>
        <Pressable
          accessibilityLabel="自分のページ"
          accessibilityRole="button"
          onPress={() => nav.push("me")}
        >
          <Avatar name={s.profile.name} avatar={s.profile.avatar} />
        </Pressable>
        <View style={S.fill}>
          <T display size={19}>
            {s.profile.name}
          </T>
          <T size={12} color={C.pale}>
            強みカード {d.deck.length}枚
          </T>
        </View>
        <LinkButton
          label="印象を贈る"
          onPress={() =>
            nav.goTab(
              "exchange",
              s.connections.some((c) => c.status === "accepted")
                ? { id: "connections" }
                : undefined,
            )
          }
        />
      </View>
      {quest && (
        <Pressable
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
          <Panel style={[S.row, { padding: 10, backgroundColor: C.yellow }]}>
            <Envelope size={44} />
            <View style={S.fill}>
              <T display size={16} color={C.ink}>
                {challenge
                  ? "予想チャレンジ！"
                  : unsent.length
                    ? "交換した人に印象を贈ろう"
                    : "まずは交換しよう"}
              </T>
              <T size={11} color={C.ink}>
                {challenge
                  ? `封筒${d.unopened.length}通・どのカードか当てよう`
                  : unsent.length
                    ? `まだ印象を贈っていない人が${unsent.length}人`
                    : "会った人と、カードを交換"}
              </T>
            </View>
            <T
              display
              size={13}
              color={C.yellow}
              style={{ backgroundColor: C.ink, borderRadius: 10, padding: 8 }}
            >
              {challenge ? "開ける" : unsent.length ? "贈る" : "交換"}
            </T>
          </Panel>
        </Pressable>
      )}
      {small ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 4 }} style={S.fill}>
          {grid}
        </ScrollView>
      ) : (
        grid
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          d.prCard ? "自己PRが書けます！" : `自己PR あと証言${2 - d.best}人`
        }
        onPress={() => nav.goTab("pr")}
      >
        <Panel
          style={[
            S.row,
            { padding: 10, backgroundColor: d.prCard ? C.paper : C.ink },
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
            <T display color={C.ink}>
              PR
            </T>
          </View>
          <View style={S.fill}>
            <T display size={16} color={d.prCard ? C.ink : C.white}>
              {d.prCard
                ? "自己PRが書けます！"
                : `自己PR　あと証言${2 - d.best}人`}
            </T>
            {d.prCard ? (
              <T size={11} color={C.muted}>
                「{d.prCard.name}」から下書きを生成
              </T>
            ) : (
              <View style={[S.row, { gap: 4, marginTop: 4 }]}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 26,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: i < d.best ? C.yellow : C.light,
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
