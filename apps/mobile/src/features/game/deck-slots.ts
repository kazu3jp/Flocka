/** The deck screen's grid: three rows of two. */
export const DECK_SLOTS = 6;

/**
 * What fills each grid slot, in order. Up to six cards fill the grid and the
 * rest stay locked (null). With more, five cards show and the last slot
 * becomes "more", which opens the full collection and counts the rest.
 */
export function deckSlots<T>(deck: T[]): {
  slots: (T | "more" | null)[];
  hidden: number;
} {
  const overflow = deck.length > DECK_SLOTS;
  const shown = overflow ? deck.slice(0, DECK_SLOTS - 1) : deck;
  return {
    slots: [
      ...shown,
      ...(overflow ? (["more"] as const) : []),
      ...Array<null>(Math.max(0, DECK_SLOTS - deck.length)).fill(null),
    ],
    hidden: deck.length - shown.length,
  };
}
