import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Success feedback for results the server confirmed; a no-op on the web. */
export function hapticSuccess() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => {});
}

/** A prediction was selected; this does not imply that saving or opening succeeded. */
export function hapticSelection() {
  if (Platform.OS === "web") return;
  void Haptics.selectionAsync().catch(() => {});
}
