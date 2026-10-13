import React from "react";
import { Pressable, View } from "react-native";
import { Board, C, Header, Icon, Panel, S, T } from "../../components/ui";
import { PEOPLE, startExchange } from "@flocka/domain";
import { useApp } from "../../store";
import { PeerAvatar } from "./player-card";

export function Nearby() {
  const { s, nav, update } = useApp(),
    peers = Object.keys(PEOPLE).filter((id) => !s.blocked.includes(id));
  const start = (peerId: string) => {
    const id = update((x) => startExchange(x, peerId));
    if (id) nav.replace("confirm", { cid: id });
  };
  return (
    <Board scroll>
      <Header title="近くの人と交換" onBack={nav.pop} />
      <View style={{ alignItems: "center", padding: 14 }}>
        <Icon name="radar" size={60} />
      </View>
      <T size={13}>
        元プロトタイプのデモの3人です。近距離通信による検出は未接続です。
      </T>
      {peers.length ? (
        peers.map((id) => (
          <Pressable
            accessibilityRole="button"
            key={id}
            onPress={() => start(id)}
          >
            <Panel style={S.row}>
              <PeerAvatar id={id} />
              <View style={S.fill}>
                <T display color={C.ink} size={17}>
                  {PEOPLE[id].name}
                </T>
                <T color={C.muted} size={12}>
                  {s.connections.some(
                    (c) => c.peerId === id && c.status === "accepted",
                  )
                    ? "交換済み・プロフィールを見る"
                    : PEOPLE[id].role}
                </T>
              </View>
              <Icon name="chev" color={C.ink} />
            </Panel>
          </Pressable>
        ))
      ) : (
        <T>
          近くに交換できる人がいません。ブロックした人は設定から解除できます。
        </T>
      )}
    </Board>
  );
}
