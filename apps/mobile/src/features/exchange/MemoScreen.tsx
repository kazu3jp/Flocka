import { useTestimonySend } from "./use-testimony-send";
import { DeliveryFeedback } from "./delivery-feedback";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Board, Btn, C, Header, Panel, F, T } from "../../components/ui";
import { CARDS } from "@flocka/domain";
import {
  MemoProgress,
  MemoRecipient,
  MemoStory,
  MemoStrengths,
} from "./memo-controls";
import { useApp } from "../../store";
import { useConfirmation } from "../../components/pickers";
import { useBackStep } from "../navigation/use-back-step";
import { hapticSuccess } from "../haptics/haptics";

export function Memo() {
  const { s, api, refresh, nav, toast, peers } = useApp(),
    [step, setStep] = useState(0),
    [to, setTo] = useState(""),
    [card, setCard] = useState(""),
    [story, setStory] = useState(""),
    {
      receipt,
      busy,
      error,
      send: deliver,
      retrySync,
    } = useTestimonySend<{
      id: string;
      to: string;
      card: string;
      story: string;
    }>(refresh, () =>
      toast(`${peers[to]?.profile.name ?? "相手"}に封筒を贈りました`),
    ),
    { ask, dialog } = useConfirmation();
  // The receipt only exists after the server accepted the memo.
  useEffect(() => {
    if (receipt) hapticSuccess();
  }, [receipt]);
  const drafted = !receipt && !!story.trim();
  // Earlier steps keep the typed story; only leaving the screen discards it.
  const back = () => {
    if (step > 0) setStep(step - 1);
    else if (drafted)
      ask(
        "書いた場面を破棄する？",
        "入力した場面のメモは保存されません。",
        nav.pop,
        "破棄する",
      );
    else nav.pop();
  };
  useBackStep(step > 0 || drafted ? 1 : 0, back);
  const members = [
    ...new Set(
      [...s.connections]
        .sort((a, b) =>
          (a.exchangedAt ?? "").localeCompare(b.exchangedAt ?? ""),
        )
        .filter((c) => c.status === "accepted" && !s.blocked.includes(c.peerId))
        .map((c) => c.peerId),
    ),
  ];
  const send = () => {
    void deliver(async () => {
      const exchange = s.connections.find(
        (connection) =>
          connection.peerId === to && connection.status === "accepted",
      );
      if (!exchange) throw new Error("交換が成立した相手を選んでください");
      const submittedStory = story.trim();
      const result = await api.sendScene(exchange.id, card, submittedStory);
      return { ...result, to, card, story: submittedStory };
    });
  };
  if (receipt)
    return (
      <Board>
        <Header title="" onBack={nav.pop} />
        <DeliveryFeedback busy={busy} error={error} retrySync={retrySync} />
        <View
          testID="memo-completion"
          style={{ flex: 1, justifyContent: "center", gap: 14 }}
        >
          <Panel
            style={{
              borderRadius: 14,
              paddingTop: 18,
              paddingHorizontal: 18,
              paddingBottom: 16,
            }}
          >
            <T color={C.muted} size={12.5} style={{ lineHeight: 19.375 }}>
              {peers[receipt.to]?.profile.name ?? "プロフィールを取得中"}へ・
              {CARDS[receipt.card].name}
            </T>
            <T
              color={C.ink}
              size={18}
              style={{ fontFamily: F.bold, lineHeight: 30.6 }}
            >
              「{receipt.story}」
            </T>
          </Panel>
          <T display size={20} style={{ textAlign: "center", lineHeight: 28 }}>
            封筒で贈りました
          </T>
          <T
            size={12.5}
            color={C.pale}
            style={{ textAlign: "center", lineHeight: 19.375 }}
          >
            {peers[receipt.to]?.profile.name}のデッキに、証言として届きます。
          </T>
        </View>
        <Btn plain label="交換へ戻る" onPress={nav.root} />
      </Board>
    );
  return (
    <Board scroll form>
      <Header title="" onBack={back} right={<MemoProgress step={step} />} />
      {error && (
        <T color={C.yellow} accessibilityRole="alert">
          {error}
        </T>
      )}
      <T testID="memo-heading" display size={26} style={{ lineHeight: 36.4 }}>
        {step === 0
          ? "誰に贈る？"
          : step === 1
            ? `${peers[to]?.profile.name}の、どの強み？`
            : "その強みを見た場面は？"}
      </T>
      {step === 0 && (
        <>
          {!members.length && (
            <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
              まだ交換した人がいません。交換すると、ここから場面のメモを贈れます。
            </T>
          )}
          <View
            testID="memo-recipients"
            accessibilityRole="radiogroup"
            accessibilityLabel="相手"
            style={{ gap: 10 }}
          >
            {members.map((id) => (
              <MemoRecipient
                key={id}
                id={id}
                name={peers[id]?.profile.name ?? "プロフィールを取得中"}
                context={
                  s.connections.find(
                    (connection) =>
                      connection.peerId === id &&
                      connection.status === "accepted",
                  )?.context.place || "交換済み"
                }
                selected={to === id}
                onPress={() => setTo(id)}
              />
            ))}
          </View>
        </>
      )}
      {step === 1 && <MemoStrengths selected={card} onChange={setCard} />}
      {step === 2 && (
        <>
          <T size={12.5} color={C.pale} style={{ lineHeight: 19.375 }}>
            性格の採点ではなく、見た行動をひとつ
          </T>
          <MemoStory value={story} onChange={setStory} />
          <T
            size={12.5}
            color={C.pale}
            style={{ textAlign: "right", lineHeight: 19.375 }}
          >
            {story.length}/80
          </T>
        </>
      )}
      <View style={{ flexGrow: 1 }} />
      <Btn
        label={step < 2 ? "次へ" : "封筒で贈る"}
        loading={busy}
        disabled={
          ![members.includes(to), !!card, story.trim().length >= 8][step]
        }
        onPress={() => (step < 2 ? setStep(step + 1) : send())}
      />
      {dialog}
    </Board>
  );
}
