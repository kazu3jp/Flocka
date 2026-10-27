export const SHOWCASE_LIMIT = 3;

/** The saved showcase, or the first cards of the deck while nothing is saved. */
export function chosenShowcase(saved: string[], available: string[]) {
  const selected = saved.filter((key) => available.includes(key));
  return selected.length ? selected : available.slice(0, SHOWCASE_LIMIT);
}

/**
 * An empty showcase means "not chosen yet" and shows the first cards, so the
 * last chosen card stays: removing it would select the defaults instead.
 */
export function toggleShowcase(
  chosen: string[],
  key: string,
): { showcase: string[] } | { refused: string } {
  if (chosen.includes(key))
    return chosen.length > 1
      ? { showcase: chosen.filter((item) => item !== key) }
      : { refused: "1枚以上選んでください" };
  return chosen.length >= SHOWCASE_LIMIT
    ? { refused: `${SHOWCASE_LIMIT}枚まで選べます` }
    : { showcase: [...chosen, key] };
}
