import React, { useState } from "react";
import { View } from "react-native";
import {
  Board,
  Btn,
  C,
  Choice,
  Field,
  Header,
  LinkButton,
  Panel,
  S,
  T,
} from "../../components/ui";
import {
  CARDS,
  PEOPLE,
  VIBES,
  VIBE_CARD,
  now,
  summarize,
} from "@flocka/domain";
import { useApp } from "../../store";
import { PeerAvatar } from "./player-card";

export function Give({ cid }: { cid: string }) {
  const { s, update, nav, toast } = useApp(),
    [mode, setMode] = useState<"pick" | "free">("pick"),
    [sel, setSel] = useState(""),
    [text, setText] = useState(""),
    [sum, setSum] = useState<{ card: string; label: string } | null>(null),
    c = s.connections.find((c) => c.id === cid);
  if (!c)
    return (
      <Board>
        <Header title="印象を贈る" onBack={nav.pop} />
        <T>交換が見つかりませんでした。</T>
      </Board>
    );
  const sent = s.sentVibes.find((v) => v.id === c.vibe),
    ready = mode === "pick" ? !!sel && !!text.trim() : text.trim().length >= 8;
  const send = () => {
    if (!ready) return;
    const content =
      mode === "pick"
        ? { card: VIBE_CARD[sel], label: sel }
        : sum || summarize(text);
    const accepted = update((x) => {
      const cc = x.connections.find((v) => v.id === cid);
      if (
        !cc ||
        cc.vibe ||
        cc.status !== "accepted" ||
        x.blocked.includes(cc.peerId)
      )
        return false;
      const id = "sv-" + Date.now();
      x.sentVibes.push({
        id,
        toId: cc.peerId,
        kind: "vibe",
        ...content,
        text: text.trim(),
        context: { ...cc.context },
        createdAt: now(),
      });
      cc.vibe = id;
      return true;
    });
    if (accepted) toast(`${PEOPLE[c.peerId].name}に印象を贈りました（デモ）`);
  };
  if (c.vibe)
    return (
      <Board scroll>
        <Header title="贈った印象" onBack={nav.pop} />
        <Panel style={S.gap}>
          <T color={C.muted} size={13}>
            そう感じた理由
          </T>
          <T display color={C.ink} size={22}>
            「{sent?.text}」
          </T>
          <T color={C.ink}>印象：{sent?.label}</T>
        </Panel>
        <Panel>
          <T color={C.muted} size={12}>
            交換した場所・きっかけ
          </T>
          <T color={C.ink}>
            {c.context.place}
            {"\n"}
            {c.context.trigger}
          </T>
        </Panel>
        <T display size={24} style={{ textAlign: "center" }}>
          {PEOPLE[c.peerId].name}に印象を贈りました
        </T>
        <T size={12}>
          端末内に贈った記録を保存しました。相手への通信は未接続です。
        </T>
        <Btn plain label="交換へ戻る" onPress={nav.root} />
      </Board>
    );
  return (
    <Board scroll>
      <Header
        title="印象を贈る"
        onBack={nav.pop}
        right={<PeerAvatar id={c.peerId} size={32} />}
      />
      <T display size={21}>
        相手のいいなと思ったところは？
      </T>
      <T size={13}>
        {mode === "pick"
          ? "言葉を1つ選び、そう感じた理由を添えて贈ってください。"
          : "どんな場面で、なぜそう感じたかを8文字以上で書いてください。"}
      </T>
      <Panel>
        <T color={C.muted} size={12}>
          交換のきっかけ
        </T>
        <T color={C.ink} size={14}>
          {c.context.place} ／ {c.context.trigger}
        </T>
        <LinkButton
          label="出会いのメモを編集"
          color={C.ink}
          onPress={() => nav.push("confirm", { cid })}
        />
      </Panel>
      <View style={S.row}>
        <Choice
          label="言葉を選ぶ"
          selected={mode === "pick"}
          onPress={() => setMode("pick")}
        />
        <Choice
          label="自由に書く"
          selected={mode === "free"}
          onPress={() => setMode("free")}
        />
      </View>
      {mode === "pick" && (
        <View style={S.wrap}>
          {VIBES.map((v) => (
            <View key={v} style={{ width: "48%" }}>
              <Choice
                label={v}
                selected={sel === v}
                onPress={() => setSel(v)}
              />
            </View>
          ))}
        </View>
      )}
      <Field
        label={
          mode === "pick"
            ? "なぜそう感じましたか？（必須・140文字まで）"
            : "印象と、その理由（8〜140文字）"
        }
        value={text}
        maxLength={140}
        multiline
        onChangeText={(v) => {
          setText(v);
          setSum(null);
        }}
        placeholder="例：発表の準備中、困っている人に声をかけてくれたから"
      />
      <T size={12}>{text.length}/140</T>
      {mode === "free" && (
        <>
          <Btn
            plain
            small
            label={sum ? "もう一度要約" : "要約する"}
            icon="spark"
            disabled={text.trim().length < 8}
            onPress={() => setSum(summarize(text))}
          />
          {sum && (
            <>
              <Panel>
                <T color={C.ink}>要約：{sum.label}</T>
                <T size={12} color={C.muted}>
                  近い強みカード（変更できます）
                </T>
              </Panel>
              <View style={S.wrap}>
                {Object.entries(CARDS).map(([k, c]) => (
                  <Choice
                    key={k}
                    label={c.name}
                    selected={sum.card === k}
                    onPress={() => setSum({ ...sum, card: k })}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
      <Panel>
        <T color={C.muted} size={12}>
          {PEOPLE[c.peerId].name}に贈る印象
        </T>
        <T color={C.ink}>
          {mode === "pick"
            ? sel || "言葉を1つ選んでください"
            : text || "相手に感じた印象を書いてください"}
        </T>
      </Panel>
      <Btn
        label="この印象を贈る"
        disabled={
          !ready || c.status !== "accepted" || s.blocked.includes(c.peerId)
        }
        onPress={send}
      />
      <LinkButton
        label="あとで"
        onPress={() => {
          update((x) => {
            const cc = x.connections.find((v) => v.id === cid);
            if (cc) cc.later = true;
          });
          nav.pop();
        }}
      />
    </Board>
  );
}
