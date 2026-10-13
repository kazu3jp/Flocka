import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  C,
  LinkButton,
  Panel,
  S,
  StrengthCard,
  T,
  Sheet,
} from "../../components/ui";
import { bareCard, type Card, type RemoteTestimony } from "@flocka/domain";
import { useApp } from "../../store";

export function PeerAvatar({ id, size = 44 }: { id: string; size?: number }) {
  const { peers } = useApp();
  return (
    <Avatar
      name={peers[id]?.profile.name}
      size={size}
      avatar={peers[id]?.profile.avatar}
    />
  );
}

export function Player({
  peerId,
  onPick,
}: {
  peerId?: string;
  onPick?: () => void;
}) {
  const { s, d, peers, api } = useApp(),
    [publicData, setPublicData] = useState<{
      id: string;
      items: RemoteTestimony[];
      error?: string;
    } | null>(null),
    [showPublic, setShowPublic] = useState(false),
    peer = peerId ? peers[peerId] : null;
  const accepted =
    !!peerId &&
    s.connections.some(
      (connection) =>
        connection.peerId === peerId && connection.status === "accepted",
    ) &&
    !s.blocked.includes(peerId);
  useEffect(() => {
    if (!peerId || !accepted) return;
    let active = true;
    void api
      .publicTestimonies(peerId)
      .then(({ items }) => {
        if (active) setPublicData({ id: peerId, items });
      })
      .catch(() => {
        if (active)
          setPublicData({
            id: peerId,
            items: [],
            error: "公開された証言を取得できませんでした",
          });
      });
    return () => {
      active = false;
    };
  }, [api, peerId, accepted]);
  const published = publicData?.id === peerId ? publicData : null;
  const chosen = s.showcase
    .map((k) => d.deck.find((c) => c.key === k))
    .filter((c): c is Card => !!c);
  const cards = peer
    ? peer.self.map((key) => {
        const testimonies = (published?.items ?? [])
          .filter((piece) => piece.card === key)
          .map((piece) => ({
            ...piece,
            label: piece.label ?? undefined,
            text: piece.text ?? undefined,
            story: piece.story ?? undefined,
          }));
        const givers = [...new Set(testimonies.map((piece) => piece.fromId))];
        return {
          ...bareCard(key),
          testimonies,
          givers,
          confirmed: givers.length >= 2,
        };
      })
    : chosen.length
      ? chosen
      : d.deck.slice(0, 3);
  const interests = peer ? peer.profile.interests : s.profile.interests;
  return (
    <Panel style={{ flex: 1, padding: 0, overflow: "hidden", minHeight: 330 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: C.ink,
        }}
      >
        <T size={12}>プレイヤーカード</T>
      </View>
      <View style={[S.row, { padding: 16, paddingBottom: 4 }]}>
        {peerId ? (
          <PeerAvatar id={peerId} size={60} />
        ) : (
          <Avatar name={s.profile.name} avatar={s.profile.avatar} size={64} />
        )}
        <T display size={26} color={C.ink} style={S.fill}>
          {peerId ? peer?.profile.name : s.profile.name}
        </T>
      </View>
      <T size={13} color={C.muted} style={{ paddingHorizontal: 16 }}>
        {peerId ? peer?.profile.role : s.profile.role}
      </T>
      <View style={[S.row, { paddingHorizontal: 16 }]}>
        <T size={12} color={C.ink} style={S.fill}>
          強み
        </T>
        {onPick && <LinkButton label="選ぶ" color={C.ink} onPress={onPick} />}
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        {cards.map((c, i) => (
          <StrengthCard
            key={c.key}
            card={c}
            style={{
              width: cards.length === 3 ? "36%" : "46%",
              height: "95%",
              minHeight: 190,
              marginLeft: i ? -9 : 0,
              transform: [{ rotate: `${(i - (cards.length - 1) / 2) * 8}deg` }],
            }}
          />
        ))}
      </View>
      <View
        style={{
          padding: 14,
          paddingTop: 6,
          borderTopWidth: 1,
          borderColor: C.grey,
        }}
      >
        <T color={C.muted} size={11}>
          関心
        </T>
        {accepted && (
          <LinkButton
            color={C.ink}
            label="公開された証言を見る"
            onPress={() => setShowPublic(true)}
          />
        )}
        <T color={C.ink} size={12}>
          {interests.map((i) => "#" + i).join("　")}
        </T>
      </View>
      {showPublic && (
        <Sheet title="公開された証言" onClose={() => setShowPublic(false)}>
          {!published ? (
            <T>読み込み中…</T>
          ) : published.error ? (
            <T color={C.yellow}>{published.error}</T>
          ) : !published.items.length ? (
            <T>公開された証言はありません。</T>
          ) : (
            published.items.map((piece) => (
              <View key={piece.id} style={S.gap}>
                <T size={12}>
                  {piece.kind === "proof" ? "場面のメモ" : "印象"}
                </T>
                <T selectable>{piece.story || piece.text || piece.label}</T>
              </View>
            ))
          )}
        </Sheet>
      )}
    </Panel>
  );
}
