import { useCallback, useEffect, useState } from "react";

/**
 * Tells when a field's problem should be shown. Nothing shows while the user
 * is still typing the first time: the field must have lost focus once. After
 * that the verdict follows the value once typing pauses, so fixing the text
 * clears the message without a flicker on every keystroke.
 */
export function useDeferredValidation(
  value: string,
  isValid: (value: string) => boolean,
  pauseMs = 700,
) {
  const [blurred, setBlurred] = useState(false);
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), pauseMs);
    return () => clearTimeout(timer);
  }, [value, pauseMs]);
  const onBlur = useCallback(() => {
    setBlurred(true);
    setSettled(value);
  }, [value]);
  const reset = useCallback(() => {
    setBlurred(false);
    setSettled("");
  }, []);
  return {
    invalid: blurred && settled !== "" && !isValid(settled),
    onBlur,
    reset,
  };
}
