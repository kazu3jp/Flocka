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
  let applied = false;
  let completed = false;
  const perform = async () => {
    if (running || completed || !isActive()) return;
    running = true;
    try {
      if (!applied) {
        await undo();
        applied = true;
      }
      if (!isActive()) return;
      await refresh();
      if (!isActive()) return;
      completed = true;
      notify(successMessage);
    } catch (error) {
      if (!isActive()) return;
      const message =
        error instanceof Error ? error.message : "通信に失敗しました";
      notify(
        applied
          ? "取り消しは保存済みです。最新の内容を読み込めませんでした"
          : `取り消せませんでした：${message}`,
        { label: applied ? "再読込" : "再試行", fn: perform },
      );
    } finally {
      running = false;
    }
  };
  return { label: "取り消す", fn: perform };
}
