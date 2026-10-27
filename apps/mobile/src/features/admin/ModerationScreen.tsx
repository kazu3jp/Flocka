import {
  Board,
  Btn,
  C,
  Header,
  InlineError,
  Panel,
  S,
  T,
} from "../../components/ui";
import { useApp } from "../../store";
import { useModerationQueue } from "./use-moderation-queue";

const OUTCOMES = [
  ["removed", "証言を削除", "運営が証言を削除しました"],
  ["rejected", "対応なし", "確認の結果、対応は行いません"],
  ["reviewed", "確認済み", "内容を確認しました"],
] as const;

export function Moderation() {
  const { nav, isAdmin } = useApp(),
    { items, next, loaded, busy, error, loadMore, resolve } =
      useModerationQueue();
  if (!isAdmin)
    return (
      <Board>
        <Header title="通報の対応" onBack={nav.pop} />
        <T>運営権限がありません。</T>
      </Board>
    );
  return (
    <Board scroll>
      <Header title="通報の対応" onBack={nav.pop} />
      <InlineError text={error} />
      {loaded && !items.length && (
        <T size={13}>
          {next === null
            ? "対応待ちの依頼はありません。"
            : "表示中の依頼はすべて対応しました。続きを読み込んでください。"}
        </T>
      )}
      {items.map((item) => (
        <Panel key={item.id} style={S.gap}>
          <T color={C.ink} size={13}>
            {item.kind === "report" ? "通報" : "削除依頼"} ·{" "}
            {item.reason || "理由なし"}
          </T>
          <T color={C.ink}>{item.excerpt || "(本文なし)"}</T>
          {OUTCOMES.map(([status, label, note]) => (
            <Btn
              key={status}
              plain={status !== "removed"}
              label={label}
              disabled={busy}
              onPress={() => resolve(item.id, status, note)}
            />
          ))}
        </Panel>
      ))}
      {next !== null && (
        <Btn plain label="さらに読み込む" disabled={busy} onPress={loadMore} />
      )}
    </Board>
  );
}
