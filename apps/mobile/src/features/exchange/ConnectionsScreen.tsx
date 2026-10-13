import React from "react";
import { View } from "react-native";
import {
  Board,
  Btn,
  C,
  Header,
  LinkButton,
  Panel,
  S,
  T,
} from "../../components/ui";
import { useConfirmation } from "../../components/pickers";
import { PEOPLE } from "@flocka/domain";
import { useApp } from "../../store";
import { PeerAvatar } from "./player-card";

export function Connections() {
  const { s, nav, update, toast } = useApp(),
    { ask, dialog } = useConfirmation(),
    connections = s.connections.filter(
      (c) => c.status !== "cancelled" && !s.blocked.includes(c.peerId),
    );
  return (
    <Board scroll>
      <Header title="つながった人" onBack={nav.pop} />
      {!connections.length && (
        <Panel>
          <T color={C.ink}>
            まだ交換した人はいません。交換画面から、近くの人やQRで交換できます。
          </T>
        </Panel>
      )}
      {connections.map((c) => (
        <Panel key={c.id} style={S.gap}>
          <View style={S.row}>
            <PeerAvatar id={c.peerId} />
            <View style={S.fill}>
              <T display color={C.ink} size={17}>
                {PEOPLE[c.peerId].name}
              </T>
              <T color={C.muted} size={12}>
                {c.status === "pending"
                  ? "承認待ち"
                  : c.vibe
                    ? "印象を贈りました"
                    : "印象はまだ贈っていません"}
              </T>
            </View>
          </View>
          <T color={C.muted} size={13}>
            {c.context.place} · {c.context.trigger}
          </T>
          <View style={S.row}>
            <Btn
              style={S.fill}
              small
              label={
                c.status === "pending" ? "確認" : c.vibe ? "詳細" : "印象を贈る"
              }
              onPress={() =>
                nav.push(
                  c.status === "pending" || c.vibe ? "confirm" : "give",
                  { cid: c.id },
                )
              }
            />
            <LinkButton
              color={C.ink}
              label="交換を解除"
              onPress={() =>
                ask(
                  "交換を解除する？",
                  "届いた証言は残ります。",
                  () => {
                    update((x) => {
                      const cc = x.connections.find((v) => v.id === c.id);
                      if (cc) cc.status = "cancelled";
                    });
                    toast("交換を解除しました");
                  },
                  "解除する",
                )
              }
            />
          </View>
        </Panel>
      ))}
      <Btn
        plain
        label="見た場面をメモで贈る"
        icon="doc"
        onPress={() => nav.push("memo")}
      />
      {dialog}
    </Board>
  );
}
