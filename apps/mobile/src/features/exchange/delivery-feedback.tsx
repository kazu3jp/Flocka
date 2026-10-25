import { LoadingNotice } from "../../components/loading";
import { Btn, C, T } from "../../components/ui";

export function DeliveryFeedback({
  busy,
  error,
  retrySync,
}: {
  busy: boolean;
  error: string | null;
  retrySync: () => void;
}) {
  if (busy)
    return (
      <LoadingNotice>
        <T size={13} accessibilityLiveRegion="polite">
          最新データを取得中…
        </T>
      </LoadingNotice>
    );
  if (!error) return null;
  return (
    <>
      <T color={C.yellow} accessibilityRole="alert">
        送信は完了しました。最新データの取得に失敗しました。{error}
      </T>
      <Btn plain label="最新データを再取得" onPress={retrySync} />
    </>
  );
}
