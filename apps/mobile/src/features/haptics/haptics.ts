import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Success feedback for results the server confirmed; a no-op on the web. */
export function hapticSuccess() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => {});
}
