import { useCallback, useEffect, useRef } from "react";
import { findNodeHandle, Platform, type View } from "react-native";
import FlockaSecureInput from "../../modules/flocka-secure-input/src/FlockaSecureInputModule";

/**
 * Keeps the password input inside the returned ref's view from showing the
 * last typed character (Android reveals it for about 1.5 s). Pass `hidden`
 * as true while the field is masked; the native call is repeated whenever the
 * mask is applied again and when the field takes focus.
 */
export function useHiddenPasswordCharacters(hidden: boolean) {
  const container = useRef<View>(null);
  const apply = useCallback(() => {
    if (Platform.OS !== "android" || !FlockaSecureInput || !hidden) return;
    const tag = findNodeHandle(container.current);
    if (tag !== null)
      void FlockaSecureInput.hideTypedCharacters(tag).catch(() => {});
  }, [hidden]);
  useEffect(apply, [apply]);
  return { container, applyOnFocus: apply };
}
