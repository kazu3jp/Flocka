import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";
import React, { useEffect, useRef, useState } from "react";
import {
  Board,
  Btn,
  C,
  FIXED_LOOKING_BOARD,
  Header,
  LinkButton,
  Sheet,
  T,
  InlineError,
} from "../../components/ui";
import { useApp } from "../../store";
import { useScreenFocused } from "../../components/screen-focus";
import { useConfirmation } from "../../components/pickers";
import { useExchangeDecision } from "./use-exchange-decision";
import { Player } from "./player-card";
import { Chip } from "../../components/chip";
import { ExchangeMemoRow } from "./exchange-memo-row";
import { ExchangeMemoFields } from "./exchange-memo-sheet";

export function Confirm({ cid }: { cid: string }) {
  const { s, nav, toast, peers } = useApp(),
    decision = useExchangeDecision(cid),
    [memoOpen, setMemoOpen] = useState(false),
    c = s.connections.find((c) => c.id === cid),
    [context, setContextDraft] = useState(
      c?.context ?? { place: "", trigger: "" },
    ),
    { busy, error, run } = useAction(),
    { ask, dialog } = useConfirmation(),
    startVisit = useScreenVisit(cid),
    focused = useScreenFocused(),
    // The status this screen last saw, to notice the moment the exchange is made.
    seenStatus = useRef(c?.status);
  const status = c?.status,
    vibeSent = !!c?.vibe;
  // Once both approve, the first impression is the next step, so the screen
  // moves on to it. "あとで" there keeps it for later.
  useEffect(() => {
    const before = seenStatus.current;
    seenStatus.current = status;
    if (focused && before === "pending" && status === "accepted" && !vibeSent)
      nav.replace("give", { cid });
  }, [status, vibeSent, focused, nav, cid]);
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
    const editingMemo = c.myApproved || c.status === "accepted";
    void run(async () => {
      const exchange = await decision.approve(context, editingMemo);
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
  return (
    <Board scroll contentStyle={FIXED_LOOKING_BOARD}>
      <Header
        title="交換"
        onBack={nav.pop}
        right={
          <Chip label={c.status === "accepted" ? "交換成立" : "内容確認"} />
        }
      />
      <Player peerId={c.peerId} />
      {!pending && c.status !== "cancelled" && (
        <ExchangeMemoRow
          place={c.context.place}
          trigger={c.context.trigger}
          onPress={() => setMemoOpen(true)}
        />
      )}
      {c.status === "accepted" ? (
        <>
          <T size={14} style={{ textAlign: "center" }}>
            {peers[c.peerId]?.profile.name ?? "相手"}
            とつながりました！
          </T>
          {!c.vibe && (
            <T size={14} color={C.pale} style={{ textAlign: "center" }}>
              次は、相手の第一印象を贈れます（1人に1回）。
            </T>
          )}
          <Btn
            label={c.vibe ? "交換へ戻る" : "第一印象を贈る"}
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
            disabled={busy}
            onPress={() =>
              ask(
                "交換をキャンセルする？",
                "この交換は成立しません。もう一度つながるには、交換し直してください。",
                () =>
                  void run(async () => {
                    const sameVisit = startVisit();
                    await decision.cancel();
                    toast("キャンセルしました");
                    if (sameVisit()) nav.pop();
                  }),
                "キャンセルする",
              )
            }
          />
        </>
      )}
      <InlineError text={error} />
      {dialog}
      {memoOpen && c.status !== "cancelled" && (
        <Sheet title="出会いのメモ" onClose={() => setMemoOpen(false)}>
          <T size={13}>
            どこで、何をきっかけに交換したか。交換するには両方の入力が必要です。あとから編集できます。
          </T>
          <ExchangeMemoFields context={context} onChange={setContextDraft} />
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
