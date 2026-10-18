import { ApiClientError } from "@flocka/api-client";
type FeedbackAction = { label: string; fn: () => void };

type UndoOptions = {
  undo: () => Promise<unknown>;
  refresh: () => Promise<void>;
  isActive: () => boolean;
  notify: (text: string, action?: FeedbackAction) => void;
  successMessage: string;
};

/** Keep an undo alive across screens, but never across authenticated accounts. */
export function createUndoAction({
  undo,
  refresh,
  isActive,
  notify,
  successMessage,
}: UndoOptions) {
  let running = false;
  let state: "pending" | "applied" | "conflict" = "pending";
  let completed = false;
  const perform = async () => {
    if (running || completed || !isActive()) return;
    running = true;
    try {
      if (state === "pending") {
        try {
          await undo();
          state = "applied";
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 409)
            state = "conflict";
          else throw error;
        }
      }
      if (!isActive()) return;
      await refresh();
      if (!isActive()) return;
      completed = true;
      notify(
        state === "conflict"
          ? "別の変更があったため取り消しませんでした"
          : successMessage,
      );
    } catch (error) {
      if (!isActive()) return;
      const message =
        error instanceof Error ? error.message : "通信に失敗しました";
      notify(
        state === "applied"
          ? "取り消しは保存済みです。最新の内容を読み込めませんでした"
          : state === "conflict"
            ? "別の変更があったため取り消しませんでした。最新の内容を読み込めませんでした"
            : `取り消せませんでした：${message}`,
        { label: state === "pending" ? "再試行" : "再読込", fn: perform },
      );
    } finally {
      running = false;
    }
  };
  return { label: "取り消す", fn: perform };
}
