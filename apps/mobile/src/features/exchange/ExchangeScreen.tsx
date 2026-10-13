import React, { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Board,
  Btn,
  Choice,
  Header,
  Icon,
  S,
  Sheet,
  T,
} from "../../components/ui";

import { useApp } from "../../store";
import { Player } from "./player-card";

export function Exchange() {
  const { s, d, nav, update, toast } = useApp(),
    [pick, setPick] = useState(false);
  const chosen = s.showcase.length
    ? s.showcase
    : d.deck.slice(0, 3).map((c) => c.key);
  const toggle = (k: string) => {
    if (chosen.includes(k))
      update((x) => {
        x.showcase = chosen.filter((v) => v !== k);
      });
    else if (chosen.length >= 3) toast("3枚まで選べます");
    else
      update((x) => {
        x.showcase = [...chosen, k];
      });
  };
  return (
    <Board>
      <Header
        title="交換"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="つながった人"
            onPress={() => nav.push("connections")}
            style={{ padding: 12 }}
          >
            <Icon name="users" />
          </Pressable>
        }
      />
      <Player onPick={() => setPick(true)} />
      <Btn
        label="近くの人と交換"
        icon="swap"
        onPress={() => nav.push("nearby")}
      />
      <Btn plain label="QRで交換" icon="qr" onPress={() => nav.push("scan")} />
      {s.connections.some(
        (c) =>
          c.status === "accepted" && !c.vibe && !s.blocked.includes(c.peerId),
      ) && (
        <Btn
          plain
          small
          label="交換した人に印象を贈る"
          onPress={() => nav.push("connections")}
        />
      )}
      <T size={11} style={{ textAlign: "center" }}>
        ローカルデモ · 相手への通信は未接続
      </T>
      {pick && (
        <Sheet
          title="相手に見せる強み（3枚まで）"
          onClose={() => setPick(false)}
        >
          <View style={S.wrap}>
            {d.deck.map((c) => (
              <Choice
                key={c.key}
                label={c.name}
                selected={chosen.includes(c.key)}
                onPress={() => toggle(c.key)}
              />
            ))}
          </View>
          <Btn label="決定" onPress={() => setPick(false)} />
        </Sheet>
      )}
    </Board>
  );
}
