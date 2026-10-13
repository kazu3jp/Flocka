import React, { useState } from "react";
import {
  Board,
  Btn,
  C,
  Field,
  Header,
  LinkButton,
  Panel,
  Sheet,
  T,
} from "../../components/ui";
import { PEOPLE, approveExchange } from "@flocka/domain";
import { useApp } from "../../store";
import { Player } from "./player-card";

export function Confirm({ cid }: { cid: string }) {
  const { s, nav, update, toast } = useApp(),
    [memoOpen, setMemoOpen] = useState(false),
    c = s.connections.find((c) => c.id === cid);
  if (!c)
    return (
      <Board>
        <Header title="交換" onBack={nav.pop} />
        <T>交換が見つかりませんでした。</T>
      </Board>
    );
  const done = !!c.context.place.trim() && !!c.context.trigger.trim(),
    pending = c.status === "pending" && !c.myApproved;
  const approve = () => {
    if (!done) {
      setMemoOpen(true);
      return;
    }
    const accepted = update((x) => approveExchange(x, cid));
    if (accepted) {
      setMemoOpen(false);
      toast(`交換成立！${PEOPLE[c.peerId].name}とつながりました（デモ）`);
    }
  };
  const setContext = (key: "place" | "trigger", value: string) =>
    update((x) => {
      const cc = x.connections.find((v) => v.id === cid);
      if (cc) cc.context[key] = value;
    });
  return (
    <Board>
      <Header
        title="交換"
        onBack={nav.pop}
        right={
          <T size={12}>{c.status === "accepted" ? "交換成立" : "内容確認"}</T>
        }
      />
      <Player peerId={c.peerId} />
      {!pending && (
        <Panel style={{ padding: 10 }}>
          <T color={C.muted} size={12}>
            出会いのメモ
          </T>
          <T color={C.ink} size={13}>
            {c.context.place} · {c.context.trigger}
          </T>
          <LinkButton
            label="メモを編集"
            color={C.ink}
            onPress={() => setMemoOpen(true)}
          />
        </Panel>
      )}
      {c.status === "accepted" ? (
        <>
          <T size={14} style={{ textAlign: "center" }}>
            {PEOPLE[c.peerId].name}とつながりました！
          </T>
          <Btn
            label={c.vibe ? "交換へ戻る" : "印象を贈る"}
            onPress={() => (c.vibe ? nav.root() : nav.replace("give", { cid }))}
          />
          {!c.vibe && <LinkButton label="あとで贈る" onPress={nav.root} />}
        </>
      ) : c.status === "cancelled" ? (
        <Btn label="交換へ戻る" onPress={nav.root} />
      ) : (
        <>
          <Btn
            label={c.myApproved ? "相手の承認を待っています…" : "交換する"}
            disabled={c.myApproved}
            onPress={approve}
          />
          <LinkButton
            label="キャンセル"
            onPress={() => {
              update((x) => {
                const cc = x.connections.find((v) => v.id === cid);
                if (cc) cc.status = "cancelled";
              });
              toast("キャンセルしました");
              nav.pop();
            }}
          />
        </>
      )}
      {memoOpen && (
        <Sheet title="出会いのメモ" onClose={() => setMemoOpen(false)}>
          <T size={13}>
            どこで、何をきっかけに交換したか。交換するには両方の入力が必要です。あとから編集できます。
          </T>
          <Field
            label="場所・イベント名（必須）"
            maxLength={60}
            value={c.context.place}
            placeholder="例：学校のラウンジ、勉強会"
            onChangeText={(v) => setContext("place", v)}
          />
          <Field
            label="交換のきっかけ（必須）"
            maxLength={100}
            value={c.context.trigger}
            placeholder="例：同じチームで発表を準備した"
            onChangeText={(v) => setContext("trigger", v)}
          />
          <Btn
            label={pending ? "保存して交換する" : "保存する"}
            disabled={!done}
            onPress={() => (pending ? approve() : setMemoOpen(false))}
          />
          {!done && <T size={12}>2つの項目を入力すると進めます</T>}
        </Sheet>
      )}
    </Board>
  );
}
