import { createContext, useContext } from "react";
import { TourTargetRegistry } from "./tour-registry";
import type { TourTab } from "./tour-steps";

export type TourApi = {
  /** Null outside a TourProvider, so screens still render in isolation. */
  registry: TourTargetRegistry | null;
  running: boolean;
  /** Starts the tour from its first step. Does not touch the seen flag. */
  start: () => void;
  /** Ends the tour and returns to where it started. Used by the overlay. */
  finish: () => void;
  /** Shows the tab root a step needs. Used by the overlay. */
  showTab: (tab: TourTab) => void;
};

const nothing = () => undefined;

export const TourContext = createContext<TourApi>({
  registry: null,
  running: false,
  start: nothing,
  finish: nothing,
  showTab: nothing,
});

export function useTour() {
  return useContext(TourContext);
}
