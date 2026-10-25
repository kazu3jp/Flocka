import type { RequestRecord } from "@flocka/domain";
import { C, LinkButton, Panel, T } from "../../components/ui";
import { canWithdrawRequest, requestStatusLabel } from "./settings-view-model";

export type HistoryEntry = RequestRecord & { kind: "reports" | "deletions" };

/** Reports and removal requests the user made, with withdrawal while pending. */
export function RequestHistoryList({
  entries,
  busy,
  activeId,
  onWithdraw,
}: {
  entries: HistoryEntry[];
  busy: boolean;
  /** The request whose withdrawal is running, if any. */
  activeId: string | null;
  onWithdraw: (entry: HistoryEntry) => void;
}) {
  if (!entries.length)
    return (
      <Panel>
        <T size={13} color={C.muted}>
          通報や削除依頼の履歴はありません。
        </T>
      </Panel>
    );
  return (
    <>
      {entries.map((entry) => (
        <Panel key={entry.id ?? entry.kind + entry.at}>
          <T color={C.ink} size={13}>
            {entry.kind === "reports" ? "通報" : "削除依頼"} ·{" "}
            {entry.reason || "削除依頼"} · {requestStatusLabel(entry)}
          </T>
          {entry.resolution ? (
            <T color={C.muted} size={13}>
              {entry.resolution}
            </T>
          ) : null}
          {canWithdrawRequest(entry) && (
            <LinkButton
              color={C.ink}
              label={activeId === entry.id ? "取り下げ中…" : "取り下げる"}
              disabled={busy}
              onPress={() => onWithdraw(entry)}
            />
          )}
        </Panel>
      ))}
    </>
  );
}
