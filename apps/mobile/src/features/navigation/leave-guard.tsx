import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { ScreenVisible } from "../../components/screen-focus";
import { useConfirmation } from "../../components/pickers";
import { useBackStep } from "./use-back-step";

/** Takes over a leave and returns true, or returns false to let it run. */
type LeaveGuard = (leave: () => void) => boolean;

/** Holds the shown screen's guard; the tab bar asks it before switching tabs. */
export type LeaveGuards = {
  /** Sets the guard and returns its removal. */
  register: (guard: LeaveGuard) => () => void;
  /** Runs `leave` now, or once the shown screen's guard lets it. */
  attempt: (leave: () => void) => void;
};

export function createLeaveGuards(): LeaveGuards {
  let current: LeaveGuard | null = null;
  return {
    register: (guard) => {
      current = guard;
      return () => {
        if (current === guard) current = null;
      };
    },
    attempt: (leave) => {
      if (!current?.(leave)) leave();
    },
  };
}

export const LeaveGuardContext =
  createContext<LeaveGuards>(createLeaveGuards());

/**
 * A screen with unsaved edits asks before its back button, Android back or a
 * tab tap takes the person away; the edits are dropped only once confirmed.
 * Render the returned dialog, and call `back` from the header.
 */
export function useUnsavedChangesGuard({
  unsaved,
  title,
  text,
  pop,
}: {
  unsaved: boolean;
  title: string;
  text: string;
  pop: () => void;
}) {
  const { ask, dialog } = useConfirmation();
  const registry = useContext(LeaveGuardContext);
  const visible = useContext(ScreenVisible);
  const guard = useCallback<LeaveGuard>(
    (after) => {
      if (!unsaved) return false;
      ask(title, text, after, "破棄する");
      return true;
    },
    // ask is recreated on every render but only sets the dialog's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unsaved, title, text],
  );
  const latest = useRef(guard);
  useEffect(() => {
    latest.current = guard;
  }, [guard]);
  useEffect(
    // A screen kept mounted out of view must not hold up the tab bar.
    () =>
      visible ? registry.register((after) => latest.current(after)) : undefined,
    [registry, visible],
  );
  const back = useCallback(() => {
    if (!guard(pop)) pop();
  }, [guard, pop]);
  useBackStep(unsaved ? 1 : 0, back);
  return { back, dialog };
}
