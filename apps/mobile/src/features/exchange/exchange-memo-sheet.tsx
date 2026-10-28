import { useState } from "react";
import { Btn, C, Field, InlineError, Sheet, T } from "../../components/ui";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";
import { useExchangeDecision } from "./use-exchange-decision";

export type ExchangeContext = { place: string; trigger: string };

/** Where and why the two met: both fields are needed to exchange. */
export function ExchangeMemoFields({
  context,
  onChange,
}: {
  context: ExchangeContext;
  onChange: (context: ExchangeContext) => void;
}) {
  return (
    <>
      <Field
        label="場所・イベント名（必須）"
        maxLength={60}
        value={context.place}
        placeholder="例：学校のラウンジ、勉強会"
        onChangeText={(place) => onChange({ ...context, place })}
      />
      <Field
        label="交換のきっかけ（必須）"
        maxLength={100}
        value={context.trigger}
        placeholder="例：同じチームで発表を準備した"
        onChangeText={(trigger) => onChange({ ...context, trigger })}
      />
    </>
  );
}

/**
 * Edits the memo of an exchange that is already made, over the screen that
 * opened it, so writing a testimony never jumps to the exchange screen.
 */
export function ExchangeMemoSheet({
  cid,
  onClose,
}: {
  cid: string;
  onClose: () => void;
}) {
  const { s, toast } = useApp(),
    decision = useExchangeDecision(cid),
    { busy, error, run } = useAction(),
    saved = s.connections.find((c) => c.id === cid)?.context,
    [context, setContext] = useState<ExchangeContext>(
      saved ?? { place: "", trigger: "" },
    );
  const done = !!context.place.trim() && !!context.trigger.trim();
  return (
    <Sheet
      title="出会いのメモ"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <T size={13} color={C.muted}>
        どこで、何をきっかけに交換したか。
      </T>
      <ExchangeMemoFields context={context} onChange={setContext} />
      <InlineError text={error} color={C.danger} size={13} />
      <Btn
        label="保存する"
        loading={busy}
        disabled={!done}
        onPress={() =>
          void run(async () => {
            await decision.approve(context, true);
            toast("メモを保存しました");
            onClose();
          })
        }
      />
    </Sheet>
  );
}
