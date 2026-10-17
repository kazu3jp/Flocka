import React from "react";
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
import { useShowcase } from "./use-showcase";

export function Exchange() {
  const { s, d, nav } = useApp();
  const showcase = useShowcase();
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
      <Player onPick={showcase.show} />
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
      {showcase.open && (
        <Sheet title="相手に見せる強み（3枚まで）" onClose={showcase.close}>
          <View style={S.wrap}>
            {d.deck.map((c) => (
              <Choice
                key={c.key}
                label={c.name}
                selected={showcase.chosen.includes(c.key)}
                disabled={showcase.busy}
                onPress={() => showcase.toggle(c.key)}
              />
            ))}
          </View>
          {showcase.error && <T accessibilityRole="alert">{showcase.error}</T>}
          <Btn
            label={showcase.busy ? "保存中…" : "決定"}
            disabled={showcase.busy}
            onPress={showcase.finish}
          />
        </Sheet>
      )}
    </Board>
  );
}
