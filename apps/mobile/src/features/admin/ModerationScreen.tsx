import { useCallback, useEffect, useState } from "react";
import type { PendingModeration } from "@flocka/domain";
import { Board, Btn, C, Header, Panel, S, T } from "../../components/ui";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

const OUTCOMES = [
  ["removed", "証言を削除", "運営が証言を削除しました"],
  ["rejected", "対応なし", "確認の結果、対応は行いません"],
  ["reviewed", "確認済み", "内容を確認しました"],
] as const;

export function Moderation() {
  const { api, nav, toast, isAdmin } = useApp(),
    [items, setItems] = useState<PendingModeration[]>([]),
    [nextPage, setNextPage] = useState<number | null>(null),
    [loaded, setLoaded] = useState(false),
    { busy, error, run } = useAction();
  const load = useCallback(
    (page: number) =>
      run(async () => {
        const result = await api.pendingModeration(page);
        setItems((current) =>
          page ? [...current, ...result.items] : result.items,
        );
        setNextPage(result.nextPage);
        setLoaded(true);
      }),
    // `run` is stable for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  );
  useEffect(() => {
    if (isAdmin) void load(0);
  }, [isAdmin, load]);
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
      {error && <T color={C.yellow}>{error}</T>}
      {loaded && !items.length && <T size={13}>対応待ちの依頼はありません。</T>}
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
              onPress={() => {
                void run(async () => {
                  await api.resolveModeration(item.id, status, note);
                  setItems((current) =>
                    current.filter((other) => other.id !== item.id),
                  );
                  toast("対応を記録しました");
                });
              }}
            />
          ))}
        </Panel>
      ))}
      {nextPage !== null && (
        <Btn
          plain
          label="さらに読み込む"
          disabled={busy}
          onPress={() => void load(nextPage)}
        />
      )}
    </Board>
  );
}
