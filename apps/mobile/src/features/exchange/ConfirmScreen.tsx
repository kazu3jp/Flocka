import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";
import React, { useState } from "react";
import {
  Board,
  Btn,
  C,
  Field,
  FIXED_LOOKING_BOARD,
  Header,
  LinkButton,
  Panel,
  Sheet,
  T,
  InlineError,
} from "../../components/ui";
import { useApp } from "../../store";
import { Player } from "./player-card";

export function Confirm({ cid }: { cid: string }) {
  const { s, nav, api, refresh, toast, peers } = useApp(),
    [memoOpen, setMemoOpen] = useState(false),
    c = s.connections.find((c) => c.id === cid),
    [context, setContextDraft] = useState(
      c?.context ?? { place: "", trigger: "" },
    ),
    { busy, error, run } = useAction(),
    startVisit = useScreenVisit(cid);
  if (!c)
    return (
      <Board>
        <Header title="交換" onBack={nav.pop} />
        <T>交換が見つかりませんでした。</T>
      </Board>
    );
  const done = !!context.place.trim() && !!context.trigger.trim(),
    pending = c.status === "pending" && !c.myApproved;
  const approve = () => {
    if (!done) {
      setMemoOpen(true);
      return;
    }
    // After this account approved, the same request only updates the memo.
    const editingMemo = c.myApproved || c.status === "accepted";
    void run(async () => {
      const exchange = await api.approveExchange(
        cid,
        context.place,
        context.trigger,
      );
      await refresh();
      setMemoOpen(false);
      toast(
        editingMemo
          ? "メモを保存しました"
          : exchange.status === "accepted"
            ? `交換成立！${peers[c.peerId]?.profile.name ?? "相手"}とつながりました`
            : "承認しました。相手の承認を待っています",
      );
    });
  };
  const setContext = (key: "place" | "trigger", value: string) =>
    setContextDraft((current) => ({ ...current, [key]: value }));
  return (
    <Board scroll contentStyle={FIXED_LOOKING_BOARD}>
      <Header
        title="交換"
        onBack={nav.pop}
        right={
          <T size={12}>{c.status === "accepted" ? "交換成立" : "内容確認"}</T>
        }
      />
      <Player peerId={c.peerId} />
      {!pending && c.status !== "cancelled" && (
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
            {peers[c.peerId]?.profile.name ?? "プロフィールを取得中"}
            とつながりました！
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
            disabled={c.myApproved || busy}
            onPress={approve}
          />
          <LinkButton
            label="キャンセル"
            onPress={() => {
              void run(async () => {
                const sameVisit = startVisit();
                await api.cancelExchange(cid);
                await refresh();
                toast("キャンセルしました");
                if (sameVisit()) nav.pop();
              });
            }}
          />
        </>
      )}
      <InlineError text={error} />
      {memoOpen && c.status !== "cancelled" && (
        <Sheet title="出会いのメモ" onClose={() => setMemoOpen(false)}>
          <T size={13}>
            どこで、何をきっかけに交換したか。交換するには両方の入力が必要です。あとから編集できます。
          </T>
          <Field
            label="場所・イベント名（必須）"
            maxLength={60}
            value={context.place}
            placeholder="例：学校のラウンジ、勉強会"
            onChangeText={(v) => setContext("place", v)}
          />
          <Field
            label="交換のきっかけ（必須）"
            maxLength={100}
            value={context.trigger}
            placeholder="例：同じチームで発表を準備した"
            onChangeText={(v) => setContext("trigger", v)}
          />
          <Btn
            label={pending ? "保存して交換する" : "保存する"}
            disabled={!done || busy}
            onPress={approve}
          />
          {/* Kept in place and hidden once done, so the sheet keeps its height. */}
          <T size={12} style={{ opacity: done ? 0 : 1 }}>
            2つの項目を入力すると進めます
          </T>
        </Sheet>
      )}
    </Board>
  );
}
