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
  LAYOUT,
  LinkButton,
  Panel,
  S,
  T,
  InlineError,
} from "../../components/ui";
import { VIBE_CARD, summarize } from "@flocka/domain";
import { PopIn } from "../../components/motion";
import { useApp } from "../../store";
import { useConfirmation } from "../../components/pickers";
import { useBackStep } from "../navigation/use-back-step";
import { hapticSuccess } from "../haptics/haptics";
import { GiveReason, ImpressionLabel, ImpressionSummary } from "./give-content";
import { GiveMode, VibeOptions } from "./give-controls";
import { PeerAvatar } from "./player-card";

export function Give({ cid }: { cid: string }) {
  const { s, update, api, refresh, nav, toast, peers } = useApp(),
    [mode, setMode] = useState<"pick" | "free">("pick"),
    [sel, setSel] = useState(""),
    [text, setText] = useState(""),
    [sum, setSum] = useState<{ card: string; label: string } | null>(null),
    c = s.connections.find((c) => c.id === cid),
    {
      receipt,
      busy,
      error,
      send: deliver,
      retrySync,
    } = useTestimonySend<{ id: string; text: string; label: string }>(
      refresh,
      () =>
        toast(
          `${peers[c?.peerId ?? ""]?.profile.name ?? "相手"}に印象を贈りました`,
        ),
    ),
    { ask, dialog } = useConfirmation();
  // The receipt only exists after the server accepted the impression.
  useEffect(() => {
    if (receipt) hapticSuccess();
  }, [receipt]);
  const drafting = !!c && !c.vibe && !receipt && (!!sel || !!text.trim());
  const peerName = peers[c?.peerId ?? ""]?.profile.name ?? "相手";
  // Leaving with a chosen word or typed reason asks before discarding it.
  // While the impression is being sent, the screen stays until the server answers.
  const leave = (after: () => void) => {
    if (busy) return;
    if (drafting)
      ask(
        "入力した印象を破棄する？",
        "選んだ言葉と書いた理由は保存されません。",
        after,
        "破棄する",
      );
    else after();
  };
  useBackStep(drafting || busy ? 1 : 0, () => leave(nav.pop));
  if (!c)
    return (
      <Board>
        <Header title="印象を贈る" onBack={nav.pop} />
        <T>交換が見つかりませんでした。</T>
      </Board>
    );
  const sent = s.sentVibes.find((v) => v.id === c.vibe) ?? receipt,
    ready = mode === "pick" ? !!sel && !!text.trim() : text.trim().length >= 8;
  const send = () => {
    if (!ready) return;
    const content =
      mode === "pick"
        ? { card: VIBE_CARD[sel], label: sel }
        : sum || summarize(text);
    const submittedText = text.trim();
    void deliver(async () => ({
      ...(await api.sendImpression(
        cid,
        content.card,
        content.label,
        submittedText,
      )),
      text: submittedText,
      label: content.label,
    }));
  };
  if (c.vibe || receipt)
    return (
      <Board scroll>
        <Header title="" onBack={nav.pop} />
        <DeliveryFeedback busy={busy} error={error} retrySync={retrySync} />
        <View style={{ gap: 14, alignItems: "stretch" }}>
          <Panel
            style={{
              borderRadius: 14,
              paddingTop: 18,
              paddingHorizontal: 18,
              paddingBottom: 16,
            }}
          >
            <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
              そう感じた理由
            </T>
            <T
              color={C.ink}
              size={18}
              style={{ fontFamily: F.bold, lineHeight: 30.6 }}
            >
              「{sent?.text}」
            </T>
            <View style={{ marginTop: 10 }}>
              <ImpressionLabel label={sent?.label ?? ""} />
            </View>
          </Panel>
          <Panel style={{ padding: LAYOUT.panelPaddingCompact }}>
            <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
              交換した場所・きっかけ
            </T>
            <T color={C.ink} size={14} style={{ lineHeight: 22.4 }}>
              {c.context.place || "場所は未記入"}
              {"\n"}
              {c.context.trigger || "きっかけは未記入"}
            </T>
          </Panel>
          <PopIn>
            <T
              display
              size={20}
              style={{ textAlign: "center", lineHeight: 28 }}
            >
              {peers[c.peerId]?.profile.name ?? "プロフィールを取得中"}
              に印象を贈りました
            </T>
          </PopIn>
          <T
            size={12.5}
            color={C.pale}
            style={{ textAlign: "center", lineHeight: 19.375 }}
          >
            {peerName}のデッキに、証言として届きます。
          </T>
        </View>
        <Btn plain label="交換へ戻る" onPress={nav.root} />
      </Board>
    );
  return (
    <Board scroll form>
      <Header
        title="印象を贈る"
        onBack={() => leave(nav.pop)}
        right={
          <View style={[S.row, { gap: 8 }]}>
            <PeerAvatar id={c.peerId} size={32} />
            <T style={{ fontFamily: F.bold, lineHeight: 24.75 }}>{peerName}</T>
          </View>
        }
      />
      <View testID="give-instructions">
        <T display size={20} style={{ lineHeight: 28 }}>
          相手のいいなと思ったところは？
        </T>
        <T size={14} color={C.pale} style={{ marginTop: 6, lineHeight: 22.4 }}>
          {mode === "pick"
            ? "言葉を1つ選び、そう感じた理由を添えて贈ってください。"
            : "どんな場面で、なぜそう感じたかを8文字以上で書いてください。要約は任意です。"}
        </T>
      </View>
      <Panel
        testID="give-exchange-context"
        style={{ paddingVertical: 10, paddingHorizontal: 14 }}
      >
        <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
          交換のきっかけ
        </T>
        <T color={C.ink} size={14} style={{ lineHeight: 22.4 }}>
          {[c.context.place, c.context.trigger].filter(Boolean).join(" ／ ") ||
            "まだ記入されていません"}
        </T>
        {/* Always shown: hiding it once a choice is made pulled the options up under the finger. */}
        <LinkButton
          label="出会いのメモを編集"
          color={C.ink}
          onPress={() => nav.push("confirm", { cid })}
        />
      </Panel>
      <GiveMode mode={mode} onChange={setMode} />
      {mode === "pick" && <VibeOptions selected={sel} onChange={setSel} />}
      <GiveReason
        mode={mode}
        text={text}
        onChange={(value) => {
          setText(value);
          setSum(null);
        }}
      />
      {mode === "free" && (
        <>
          <View style={[S.row, { justifyContent: "space-between" }]}>
            <T size={12.5} color={C.pale} style={{ lineHeight: 19.375 }}>
              {text.length}/140
            </T>
            <Btn
              plain
              small
              label={sum ? "もう一度要約" : "要約する"}
              icon="spark"
              iconSize={16}
              style={{ paddingVertical: 0, paddingHorizontal: 14 }}
              textStyle={{ fontSize: 14 }}
              disabled={text.trim().length < 8}
              onPress={() => setSum(summarize(text))}
            />
          </View>
          {sum && (
            <ImpressionSummary
              summary={sum}
              onChange={(card) => setSum({ ...sum, card })}
            />
          )}
        </>
      )}
      <View style={{ flexGrow: 1 }} />
      <Panel
        testID="give-selection-preview"
        style={{ paddingVertical: 10, paddingHorizontal: 14 }}
      >
        <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
          {peers[c.peerId]?.profile.name ?? "プロフィールを取得中"}に贈る印象
        </T>
        <T color={C.ink} size={14} style={{ lineHeight: 22.4, marginTop: 4 }}>
          {mode === "pick"
            ? sel
              ? `「${sel}」`
              : "上から言葉を1つ選んでください"
            : text.trim() || "相手に感じた印象を書いてください"}
        </T>
      </Panel>
      <T
        size={12.5}
        color={C.pale}
        style={{ textAlign: "center", lineHeight: 19.375 }}
      >
        贈った印象は、相手のデッキに証言として届きます。
      </T>
      <Btn
        label="この印象を贈る"
        loading={busy}
        disabled={
          !ready || c.status !== "accepted" || s.blocked.includes(c.peerId)
        }
        onPress={send}
      />
      <InlineError text={error} />
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
      {dialog}
    </Board>
  );
}
