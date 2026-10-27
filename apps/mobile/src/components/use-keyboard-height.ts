import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Height of the on-screen keyboard, 0 while it is hidden. iOS reports the
 * keyboard before it slides in, Android once it is shown; the web has no
 * such events and stays 0.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subscriptions = [
      Keyboard.addListener(show, (event) =>
        setHeight(event.endCoordinates.height),
      ),
      Keyboard.addListener(hide, () => setHeight(0)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  return height;
}
