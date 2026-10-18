import { useTestimonySend } from "./use-testimony-send";
import { DeliveryFeedback } from "./delivery-feedback";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Board,
  Btn,
  C,
  Choice,
  Envelope,
  Field,
  Header,
  Panel,
  S,
  T,
} from "../../components/ui";
import { CARDS } from "@flocka/domain";
import { useApp } from "../../store";

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
    );
  const members = [
    ...new Set(
      s.connections
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
        <Header title="" onBack={nav.root} />
        <DeliveryFeedback busy={busy} error={error} retrySync={retrySync} />
        <View style={{ flex: 1, justifyContent: "center", gap: 16 }}>
          <View style={{ alignItems: "center" }}>
            <Envelope size={180} />
          </View>
          <Panel>
            <T color={C.muted} size={12}>
              {peers[receipt.to]?.profile.name ?? "プロフィールを取得中"}へ ·{" "}
              {CARDS[receipt.card].name}
            </T>
            <T display color={C.ink}>
              「{receipt.story}」
            </T>
          </Panel>
          <T display size={26} style={{ textAlign: "center" }}>
            封筒で贈りました
          </T>
          <T size={12}>相手の受信箱に封筒を届けました。</T>
        </View>
        <Btn plain label="交換へ戻る" onPress={nav.root} />
      </Board>
    );
  return (
    <Board>
      <Header
        title="見た場面をメモで贈る"
        onBack={() => (step ? setStep(step - 1) : nav.pop())}
        right={<T size={12}>{step + 1}/3</T>}
      />
      {error && (
        <T color={C.yellow} accessibilityRole="alert">
          {error}
        </T>
      )}
      <ScrollView
        style={S.fill}
        contentContainerStyle={{ gap: 14, paddingBottom: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <T display size={26}>
          {step === 0
            ? "誰に贈る？"
            : step === 1
              ? `${peers[to]?.profile.name}の、どの強み？`
              : "その強みを見た場面は？"}
        </T>
        {step === 0 &&
          (!members.length ? (
            <T>
              まだ交換した人がいません。交換すると、ここから場面のメモを贈れます。
            </T>
          ) : (
            members.map((id) => (
              <Choice
                key={id}
                label={peers[id]?.profile.name ?? "プロフィールを取得中"}
                selected={to === id}
                onPress={() => setTo(id)}
              />
            ))
          ))}
        {step === 1 && (
          <View style={S.wrap}>
            {Object.entries(CARDS).map(([k, c]) => (
              <Choice
                key={k}
                label={c.name}
                selected={card === k}
                onPress={() => setCard(k)}
              />
            ))}
          </View>
        )}
        {step === 2 && (
          <>
            <T size={13}>性格の採点ではなく、見た行動をひとつ</T>
            <Field
              label="場面（8〜80文字）"
              value={story}
              multiline
              maxLength={80}
              onChangeText={setStory}
              placeholder="例：登壇後の質問に、図を描いて答えてくれた"
            />
            <T size={12}>{story.length}/80</T>
          </>
        )}
      </ScrollView>
      <Btn
        label={step < 2 ? "次へ" : "封筒で贈る"}
        disabled={busy || ![!!to, !!card, story.trim().length >= 8][step]}
        onPress={() => (step < 2 ? setStep(step + 1) : send())}
      />
    </Board>
  );
}
