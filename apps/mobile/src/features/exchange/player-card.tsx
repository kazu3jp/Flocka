import React from "react";
import { View } from "react-native";
import {
  Avatar,
  C,
  LinkButton,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import { bareCard, type Card } from "@flocka/domain";
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
  const { s, d, peers } = useApp(),
    peer = peerId ? peers[peerId] : null;
  const chosen = s.showcase
    .map((k) => d.deck.find((c) => c.key === k))
    .filter((c): c is Card => !!c);
  const cards = peer
    ? peer.self.map((key) => bareCard(key))
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
        <T color={C.ink} size={12}>
          {interests.map((i) => "#" + i).join("　")}
        </T>
      </View>
    </Panel>
  );
}
