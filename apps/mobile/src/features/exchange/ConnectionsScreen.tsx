import React, { useState } from "react";
import { Pressable, View } from "react-native";
import type { Connection } from "@flocka/domain";
import {
  Board,
  Btn,
  C,
  Choice,
  F,
  Header,
  Icon,
  LinkButton,
  S,
  Sheet,
  T,
} from "../../components/ui";
import { StaggerItem } from "../../components/motion";
import { useApp } from "../../store";
import { PeerAvatar } from "./player-card";
import { useConnectionRemoval } from "./use-connection-removal";
import { usePullRefresh } from "../refresh/use-pull-refresh";

type ConnectionFilter = "all" | "pending" | "unsent";

const FILTERS: [ConnectionFilter, string][] = [
  ["all", "すべて"],
  ["pending", "承認待ち"],
  ["unsent", "未送信"],
];

const matchesFilter = (connection: Connection, filter: ConnectionFilter) =>
  filter === "all" ||
  (filter === "pending"
    ? connection.status === "pending"
    : connection.status === "accepted" && !connection.vibe);

// Exchanges still waiting for approval may not have a time yet; they are the newest.
const exchangedTime = (connection: Connection) =>
  connection.exchangedAt ?? "\uffff";

function PendingBadge() {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        borderRadius: 99,
        borderWidth: 2,
        borderColor: C.ink,
        backgroundColor: C.pink,
      }}
    >
      <T color={C.ink} size={11} style={{ fontFamily: F.bold, lineHeight: 18 }}>
        承認待ち
      </T>
    </View>
  );
}

export function Connections() {
  const { s, nav, peers } = useApp();
  const removal = useConnectionRemoval();
  const pull = usePullRefresh();
  const [filter, setFilter] = useState<ConnectionFilter>("all");
  const active = s.connections.filter(
    (connection) =>
      connection.status !== "cancelled" &&
      !s.blocked.includes(connection.peerId),
  );
  // Newest exchanges first.
  const connections = active
    .filter((connection) => matchesFilter(connection, filter))
    .sort((a, b) => exchangedTime(b).localeCompare(exchangedTime(a)));
  return (
    <Board scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Header title="つながった人" onBack={nav.pop} />
      {!!active.length && (
        <View
          testID="connections-filter"
          accessibilityRole="tablist"
          style={[S.row, { gap: 6 }]}
        >
          {FILTERS.map(([value, label]) => (
            <View key={value} style={S.fill}>
              <Choice
                accessibilityRole="tab"
                label={`${label}（${active.filter((connection) => matchesFilter(connection, value)).length}）`}
                selected={filter === value}
                onPress={() => setFilter(value)}
                style={{ alignItems: "center" }}
              />
            </View>
          ))}
        </View>
      )}
      {!active.length ? (
        <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
          まだ交換した人はいません。交換画面から、近くの人やQRで交換できます。
        </T>
      ) : !connections.length ? (
        <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
          {filter === "pending"
            ? "承認待ちの交換はありません。"
            : "印象をまだ贈っていない人はいません。"}
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
            const pending = connection.status === "pending";
            const description = pending
              ? connection.myApproved
                ? "相手の承認を待っています"
                : "交換の確認が必要です"
              : sent?.label
                ? `「${sent.label}」を贈った`
                : connection.vibe
                  ? "印象を贈りました"
                  : connection.context.place || "交換済み";
            return (
              <StaggerItem
                key={connection.id}
                itemKey={`connection:${connection.id}`}
                index={index}
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
                  <View style={[S.row, { gap: 6 }]}>
                    <T
                      color={C.ink}
                      size={14}
                      style={{
                        fontFamily: F.bold,
                        lineHeight: 22.4,
                        flexShrink: 1,
                      }}
                    >
                      {name}
                    </T>
                    {pending && <PendingBadge />}
                  </View>
                  <T color={C.muted} size={12.5} style={{ lineHeight: 24.75 }}>
                    {description}
                  </T>
                </View>
                <LinkButton
                  color={C.ink}
                  disabled={removal.busy}
                  label={
                    pending ? "確認" : connection.vibe ? "詳細" : "印象を贈る"
                  }
                  onPress={() =>
                    nav.push(pending ? "confirm" : "give", {
                      cid: connection.id,
                    })
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
              </StaggerItem>
            );
          })}
        </View>
      )}
      {active.some((connection) => connection.status === "accepted") && (
        <Btn
          plain
          label="見た場面をメモで贈る"
          onPress={() => nav.push("memo")}
        />
      )}
      {removal.selectedId ? (
        <Sheet title="交換を解除しますか？" onClose={removal.close}>
          <T size={14} color={C.muted} style={{ lineHeight: 22.4 }}>
            届いた証言は消えません。
          </T>
          {removal.error ? (
            <T color={C.danger} accessibilityRole="alert">
              {removal.acknowledged
                ? "解除は完了しました。最新データの取得に失敗しました。"
                : ""}
              {removal.error}
            </T>
          ) : null}
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
      ) : null}
    </Board>
  );
}
