import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { z } from "zod";

const noticeSchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(["testimony", "exchange", "moderation"]),
});
export type NoticeKind = z.infer<typeof noticeSchema>["kind"];

/** Only recognized events for the current account may change navigation. */
export function useNotificationResponse(
  accountId: string,
  enabled: boolean,
  onOpen: (kind: NoticeKind) => Promise<void>,
  onError: (message: string) => void,
) {
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let active = true;
    let lastId: string | null = null;
    const receive = (response: Notifications.NotificationResponse) => {
      const payload = noticeSchema.safeParse(
        response.notification.request.content.data,
      );
      const id = response.notification.request.identifier;
      if (
        !payload.success ||
        payload.data.accountId !== accountId ||
        id === lastId
      )
        return;
      lastId = id;
      void onOpen(payload.data.kind).then(
        () => {
          // The screen already opened; failing to clear the stored response only
          // means it may be offered again, which `lastId` ignores in this session.
          if (active)
            void Notifications.clearLastNotificationResponseAsync().catch(
              () => {},
            );
        },
        () => {
          if (active) {
            lastId = null;
            onError(
              "通知の内容を読み込めませんでした。通信を確認してください。",
            );
          }
        },
      );
    };
    const subscription =
      Notifications.addNotificationResponseReceivedListener(receive);
    const last = Notifications.getLastNotificationResponse();
    if (last) receive(last);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [accountId, enabled, onOpen, onError]);
}
