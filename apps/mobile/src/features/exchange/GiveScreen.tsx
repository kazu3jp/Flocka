import { useTestimonySend } from "./use-testimony-send";
import { DeliveryFeedback } from "./delivery-feedback";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Board,
  Btn,
  C,
  F,
  Header,
  LinkButton,
  Panel,
  S,
  T,
  InlineError,
} from "../../components/ui";
import { CachedSvgXml } from "../../components/cached-svg-xml";
import { CARDS, summarize } from "@flocka/domain";
import { PopIn } from "../../components/motion";
import { useApp } from "../../store";
import { useConfirmation } from "../../components/pickers";
import { useBackStep } from "../navigation/use-back-step";
import { hapticSuccess } from "../haptics/haptics";
import vectors from "../../vectors.json";
import { GiveReason } from "./give-content";
import { GiveStep } from "./give-controls";
import { ExchangeMemoSheet } from "./exchange-memo-sheet";
import { TestimonyCardPicker } from "./testimony-card-picker";
import { useCardSuggestion } from "./use-card-suggestion";
import { PeerAvatar } from "./player-card";
import {
  TESTIMONY_TEXT_MIN,
  testimonyKind,
  testimonyTextMax,
  type TestimonyKind,
} from "./testimony-kind";

const CARD_ART = vectors.cards as Record<string, string>;

type Receipt = { id: string; kind: TestimonyKind; card: string; text: string };

/**
 * One way to give a testimony: write what you saw or felt, then pick the
 * strength it shows (AI can suggest one). The first one to a person is the
 * first impression, which each person gets once; after that, the same form
 * sends episodes, as many as the server allows.
 */
export function Give({ cid }: { cid: string }) {
  const { s, nav } = useApp(),
    // A new round starts a fresh form after sending, for the next episode.
    [round, setRound] = useState(0),
    c = s.connections.find((c) => c.id === cid);
  if (!c)
    return (
      <Board>
        <Header title="証言を贈る" onBack={nav.pop} />
        <T>交換が見つかりませんでした。</T>
      </Board>
    );
  return (
    <GiveForm
      key={round}
      cid={cid}
      onAnother={() => setRound((current) => current + 1)}
    />
  );
}

function GiveForm({ cid, onAnother }: { cid: string; onAnother: () => void }) {
  const { s, update, api, refresh, nav, toast, peers } = useApp(),
    c = s.connections.find((c) => c.id === cid)!,
    // Fixed for this form: sending the first impression must not turn the
    // form being shown into an episode form underneath the person.
    [kind] = useState<TestimonyKind>(() => testimonyKind(c)),
    [text, setText] = useState(""),
    [card, setCard] = useState(""),
    [memoOpen, setMemoOpen] = useState(false),
    suggestion = useCardSuggestion(),
    peer = peers[c.peerId],
    peerName = peer?.profile.name ?? "相手",
    {
      receipt,
      busy,
      error,
      send: deliver,
      retrySync,
    } = useTestimonySend<Receipt>(refresh, () =>
      toast(`${peerName}に証言を贈りました`),
    ),
    { ask, dialog } = useConfirmation();
  // The receipt only exists after the server accepted the testimony.
  useEffect(() => {
    if (receipt) hapticSuccess();
  }, [receipt]);
  const drafting = !receipt && (!!card || !!text.trim());
  // Leaving with a chosen card or typed text asks before discarding it.
  // While the testimony is being sent, the screen stays until the server answers.
  const leave = (after: () => void) => {
    if (busy) return;
    if (drafting)
      ask(
        "書いた証言を破棄する？",
        "選んだカードと書いた文章は保存されません。",
        after,
        "破棄する",
      );
    else after();
  };
  useBackStep(drafting || busy ? 1 : 0, () => leave(nav.pop));
  const trimmed = text.trim(),
    ready = !!card && trimmed.length >= TESTIMONY_TEXT_MIN;
  const send = () => {
    if (!ready) return;
    void deliver(async () => {
      const result =
        kind === "vibe"
          ? await api.sendImpression(
              cid,
              card,
              summarize(trimmed).label,
              trimmed,
            )
          : await api.sendScene(cid, card, trimmed);
      return { ...result, kind, card, text: trimmed };
    });
  };
  if (receipt)
    return (
      <Board scroll>
        <Header title="" onBack={nav.pop} />
        <DeliveryFeedback busy={busy} error={error} retrySync={retrySync} />
        <View testID="give-done" style={{ gap: 14 }}>
          <Panel style={[S.row, { gap: 12, alignItems: "flex-start" }]}>
            {CARD_ART[receipt.card] ? (
              <CachedSvgXml
                xml={CARD_ART[receipt.card]}
                width={48}
                height={48}
              />
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <T color={C.muted} size={12.5}>
                {receipt.kind === "vibe" ? "第一印象" : "エピソード"}・
                {CARDS[receipt.card]?.name}
              </T>
              <T
                color={C.ink}
                size={17}
                style={{ fontFamily: F.bold, lineHeight: 27 }}
              >
                「{receipt.text}」
              </T>
            </View>
          </Panel>
          <PopIn>
            <T
              display
              size={20}
              style={{ textAlign: "center", lineHeight: 28 }}
            >
              {peerName}に証言を贈りました
            </T>
          </PopIn>
          <T
            size={12.5}
            color={C.pale}
            style={{ textAlign: "center", lineHeight: 19.375 }}
          >
            封筒が届き、{peerName}がどの強みか予想して開けます。
          </T>
        </View>
        <View style={{ flexGrow: 1 }} />
        <Btn
          plain
          icon="edit"
          label="エピソードも贈る"
          disabled={busy}
          onPress={onAnother}
        />
        <Btn plain label="交換へ戻る" onPress={nav.root} />
      </Board>
    );
  const context = [c.context.place, c.context.trigger]
    .filter(Boolean)
    .join(" ／ ");
  const max = testimonyTextMax(kind);
  return (
    <Board scroll form>
      <Header
        title={kind === "vibe" ? "第一印象を贈る" : "エピソードを贈る"}
        onBack={() => leave(nav.pop)}
      />
      {/* Who it goes to, with where you met: the one line of context needed. */}
      <Panel
        testID="give-exchange-context"
        style={[S.row, { paddingVertical: 10, paddingHorizontal: 14, gap: 12 }]}
      >
        <PeerAvatar id={c.peerId} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T display color={C.ink} size={18} style={{ lineHeight: 24 }}>
            {peerName}へ
          </T>
          <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
            {kind === "vibe" ? "第一印象は1人に1回だけ" : "見た場面を何度でも"}
            {context ? `・${context}` : ""}
          </T>
        </View>
        <LinkButton
          label="メモ"
          accessibilityLabel="出会いのメモを編集"
          color={C.ink}
          onPress={() => setMemoOpen(true)}
        />
      </Panel>
      <View testID="give-instructions" style={{ gap: 10 }}>
        <GiveStep
          number={1}
          title={kind === "vibe" ? "感じたこと・その理由" : "見た場面"}
          note={`${TESTIMONY_TEXT_MIN}〜${max}文字`}
        />
        <GiveReason
          kind={kind}
          text={text}
          maxLength={max}
          onChange={(value) => {
            setText(value);
            suggestion.reset();
          }}
        />
      </View>
      <View style={{ gap: 10 }}>
        <GiveStep number={2} title="どの強み？" note="1枚選ぶ" />
        <Btn
          plain
          small
          icon="spark"
          iconSize={16}
          label={
            suggestion.busy ? "AIが考えています…" : "書いた文章からAIが選ぶ"
          }
          loading={suggestion.busy}
          disabled={trimmed.length < TESTIMONY_TEXT_MIN}
          onPress={() =>
            void suggestion.suggest(trimmed).then((key) => {
              if (key) setCard(key);
            })
          }
        />
        <InlineError text={suggestion.error} size={13} />
        <TestimonyCardPicker
          selected={card}
          suggested={suggestion.card}
          peerSelf={peer?.self ?? []}
          onChange={setCard}
        />
      </View>
      <View style={{ flexGrow: 1 }} />
      {/* The envelope as it will arrive: the strength and the words together. */}
      <Panel
        testID="give-selection-preview"
        accessibilityRole="summary"
        style={[S.row, { paddingVertical: 10, paddingHorizontal: 14, gap: 12 }]}
      >
        {card && CARD_ART[card] ? (
          <CachedSvgXml xml={CARD_ART[card]} width={36} height={36} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
            {peerName}に贈る証言
          </T>
          <T
            color={C.ink}
            size={15}
            style={{ fontFamily: F.bold, lineHeight: 22 }}
          >
            {card ? CARDS[card]?.name : "強みをまだ選んでいません"}
          </T>
          <T color={C.muted} size={12.5} numberOfLines={2}>
            {trimmed || "まだ書いていません"}
          </T>
        </View>
      </Panel>
      <Btn
        label="封筒で贈る"
        loading={busy}
        disabled={
          !ready || c.status !== "accepted" || s.blocked.includes(c.peerId)
        }
        onPress={send}
      />
      <InlineError text={error} />
      {kind === "vibe" && (
        <LinkButton
          label="あとで"
          disabled={busy}
          onPress={() =>
            leave(() => {
              // "later" stops the deck from recommending this person again;
              // the unsent filter in つながった人 still lists them.
              update((x) => {
                const cc = x.connections.find((v) => v.id === cid);
                if (cc) cc.later = true;
              });
              toast("あとで「つながった人」から贈れます");
              nav.pop();
            })
          }
        />
      )}
      {memoOpen && (
        <ExchangeMemoSheet cid={cid} onClose={() => setMemoOpen(false)} />
      )}
      {dialog}
    </Board>
  );
}
