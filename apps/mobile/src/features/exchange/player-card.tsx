import React, { useEffect, useMemo, useState } from "react";
import { ParagraphSkeleton } from "../../components/loading";
import { View } from "react-native";
import { Avatar, C, LinkButton, S, T, Sheet } from "../../components/ui";
import { bareCard, type Card, type PublicTestimony } from "@flocka/domain";
import { useApp } from "../../store";
import { PlayerSurface } from "./player-surface";
import { SnsLinkList } from "./SnsLinkList";

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

/** A peer's self-chosen cards, with only the testimonies they published. */
function peerHand(keys: string[], items: PublicTestimony[]): Card[] {
  return keys.map((key) => {
    const testimonies = items
      .filter((piece) => piece.card === key)
      .map(({ giver, ...piece }) => ({
        ...piece,
        // Public lists group a sender's testimonies without revealing the sender.
        fromId: giver,
        opened: true,
        guess: null,
        visibility: "public" as const,
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
  });
}

/** The cards chosen to show, or the first three of the deck. */
function ownHand(showcase: string[], deck: Card[]): Card[] {
  const chosen = showcase
    .map((k) => deck.find((c) => c.key === k))
    .filter((c): c is Card => !!c);
  return chosen.length ? chosen : deck.slice(0, 3);
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
      items: PublicTestimony[];
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
  const peerSelf = peer?.self,
    publishedItems = published?.items;
  // Keep the hand's card objects stable while the inputs are unchanged.
  const cards = useMemo(
    () =>
      peerSelf
        ? peerHand(peerSelf, publishedItems ?? [])
        : ownHand(s.showcase, d.deck),
    [peerSelf, publishedItems, s.showcase, d.deck],
  );
  const interests = peer ? peer.profile.interests : s.profile.interests;
  // The server sends a peer's links only after an accepted exchange; a pending card shows none.
  const snsLinks = peer
    ? accepted
      ? peer.profile.snsLinks
      : []
    : s.profile.snsLinks;
  return (
    <>
      <PlayerSurface
        compact={!!peerId}
        avatar={
          peerId ? (
            <PeerAvatar id={peerId} size={56} />
          ) : (
            <Avatar name={s.profile.name} avatar={s.profile.avatar} size={64} />
          )
        }
        name={
          peerId
            ? (peer?.profile.name ?? "プロフィールを取得中")
            : s.profile.name
        }
        role={peerId ? (peer?.profile.role ?? "") : s.profile.role}
        cards={cards}
        interests={interests}
        onPick={onPick}
        footer={
          snsLinks.length > 0 || accepted ? (
            <>
              <SnsLinkList links={snsLinks} />
              {accepted && (
                <LinkButton
                  color={C.ink}
                  label="公開された証言を見る"
                  onPress={() => setShowPublic(true)}
                />
              )}
            </>
          ) : undefined
        }
      />
      {showPublic && (
        <Sheet title="公開された証言" onClose={() => setShowPublic(false)}>
          {!published ? (
            <ParagraphSkeleton />
          ) : published.error ? (
            <T color={C.danger}>{published.error}</T>
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
    </>
  );
}
