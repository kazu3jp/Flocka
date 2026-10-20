import React from "react";
import { Pressable, View } from "react-native";
import {
  Board,
  Btn,
  C,
  F,
  Header,
  Icon,
  LinkButton,
  S,
  Sheet,
  T,
} from "../../components/ui";
import { useApp } from "../../store";
import { PeerAvatar } from "./player-card";
import { useConnectionRemoval } from "./use-connection-removal";

export function Connections() {
  const { s, nav, peers } = useApp();
  const removal = useConnectionRemoval();
  const connections = [...s.connections]
    .filter(
      (connection) =>
        connection.status !== "cancelled" &&
        !s.blocked.includes(connection.peerId),
    )
    .sort((a, b) => (a.exchangedAt ?? "").localeCompare(b.exchangedAt ?? ""));
  return (
    <Board scroll>
      <Header title="つながった人" onBack={nav.pop} />
      {!connections.length ? (
        <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
          まだ交換した人はいません。交換画面から、近くの人やQRで交換できます。
        </T>
      ) : (
        <View
          testID="connections-list"
          style={{
            backgroundColor: C.paper,
            borderWidth: 2.5,
            borderColor: C.ink,
            borderRadius: 16,
            boxShadow: `3px 3px 0 ${C.ink}`,
            overflow: "hidden",
          }}
        >
          {connections.map((connection, index) => {
            const name =
              peers[connection.peerId]?.profile.name ?? "プロフィールを取得中";
            const sent = s.sentVibes.find(
              (piece) => piece.id === connection.vibe,
            );
            const description =
              connection.status === "pending"
                ? "承認待ち"
                : sent?.label
                  ? `「${sent.label}」を贈った`
                  : connection.vibe
                    ? "印象を贈りました"
                    : connection.context.place || "交換済み";
            return (
              <View
                key={connection.id}
                testID={`connection-${connection.id}`}
                style={{
                  minHeight: 56,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderTopWidth: index ? 2 : 0,
                  borderTopColor: C.paper2,
                }}
              >
                <PeerAvatar id={connection.peerId} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T
                    color={C.ink}
                    size={14}
                    style={{ fontFamily: F.bold, lineHeight: 22.4 }}
                  >
                    {name}
                  </T>
                  <T color={C.muted} size={12.5} style={{ lineHeight: 24.75 }}>
                    {description}
                  </T>
                </View>
                <LinkButton
                  color={C.ink}
                  disabled={removal.busy}
                  label={
                    connection.status === "pending"
                      ? "確認"
                      : connection.vibe
                        ? "詳細"
                        : "印象を贈る"
                  }
                  onPress={() =>
                    nav.push(
                      connection.status === "pending" ? "confirm" : "give",
                      { cid: connection.id },
                    )
                  }
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${name}との交換を解除`}
                  disabled={removal.busy}
                  onPress={() => removal.show(connection.id)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="x" size={18} color={C.ink} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
      {connections.some((connection) => connection.status === "accepted") && (
        <Btn
          plain
          label="見た場面をメモで贈る"
          onPress={() => nav.push("memo")}
        />
      )}
      {removal.selectedId && (
        <Sheet title="交換を解除しますか？" onClose={removal.close}>
          <T size={14} color={C.muted} style={{ lineHeight: 22.4 }}>
            届いた証言は消えません。
          </T>
          {removal.error && (
            <T color={C.danger} accessibilityRole="alert">
              {removal.acknowledged
                ? "解除は完了しました。最新データの取得に失敗しました。"
                : ""}
              {removal.error}
            </T>
          )}
          <View style={[S.row, { marginTop: 2 }]}>
            <Btn
              plain
              label="やめる"
              style={S.fill}
              disabled={removal.busy}
              onPress={removal.close}
            />
            <Btn
              danger={!removal.acknowledged}
              plain={removal.acknowledged}
              label={removal.acknowledged ? "最新データを再取得" : "解除"}
              style={S.fill}
              disabled={removal.busy}
              onPress={removal.confirm}
            />
          </View>
        </Sheet>
      )}
    </Board>
  );
}
