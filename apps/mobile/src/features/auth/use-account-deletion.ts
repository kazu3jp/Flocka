import { useRef, useState } from "react";
import { useApp } from "../../store";
import { assertAuthResult, getAuthClient } from "./client";
import { useDeletionOutcome } from "./deletion-outcome";
import { useAuth } from "./provider";

/** Coordinates verified server deletion and local cleanup independently of the view. */
export function useAccountDeletion(
  token: string | undefined,
  callbackURL: string,
) {
  const auth = useAuth();
  const { clearDeletedAccount } = useApp();
  const {
    outcome,
    setOutcome,
    cleanup,
    setCleanup,
    cleanupError,
    setCleanupError,
  } = useDeletionOutcome();
  const [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const submitDeletion = async (confirm = Boolean(token)) => {
    const isConfirmation = Boolean(token) && confirm;
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await getAuthClient().deleteUser(
        isConfirmation ? { token } : { callbackURL },
        { timeout: 45_000 },
      );
      const pending = result.error?.code === "ACCOUNT_DELETION_PENDING";
      if (!pending) assertAuthResult(result);
      if (!isConfirmation) {
        setSent(true);
        return;
      }
      setCleanup(clearDeletedAccount);
      setCleanupError(null);
      setOutcome(pending ? "pending" : "completed");
      // Retain the actual server outcome if local cleanup fails; offer a real retry.
      try {
        await clearDeletedAccount();
      } catch (error) {
        setCleanupError(
          error instanceof Error
            ? error.message
            : "保存データを消去できませんでした",
        );
      }
      await auth.refetch();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "削除の処理に失敗しました。通信を確認してください。",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const retryCleanup = async () => {
    if (!cleanup) return;
    try {
      await cleanup();
      setCleanupError(null);
      await auth.refetch();
    } catch (error) {
      setCleanupError(
        error instanceof Error
          ? error.message
          : "保存データを消去できませんでした",
      );
    }
  };
  const dismissOutcome = () => {
    setOutcome(null);
    setCleanup(null);
    setCleanupError(null);
  };
  return {
    outcome,
    cleanupError,
    busy,
    sent,
    error,
    submitDeletion,
    retryCleanup,
    dismissOutcome,
  };
}
