/** Top of the art kept for the No. label and the 新発見 stamp. */
export const CARD_ART_LABEL_BAND = 30;
/** Widths those labels take from the art's left (No.) and right (stamp) edges. */
export const CARD_ART_LABEL_LEFT = 46;
export const CARD_ART_LABEL_RIGHT = 58;
const INSET = 4;

/**
 * The illustration's square box inside the card art, clear of the labels: a
 * tall art puts it below them, a short and wide one between them, whichever
 * leaves the larger square. Every card of one size gets the same box.
 */
export function cardIllustrationBox(artWidth: number, artHeight: number) {
  const limit = (size: number) =>
    Math.max(0, Math.min(size, artWidth * 0.74, artHeight * 0.84, 150));
  const belowRoom = artHeight - CARD_ART_LABEL_BAND - INSET;
  const below = limit(belowRoom);
  const besideRoom = artWidth - CARD_ART_LABEL_LEFT - CARD_ART_LABEL_RIGHT;
  const beside = limit(Math.min(besideRoom, artHeight - INSET * 2));
  if (beside > below)
    return {
      size: beside,
      left: CARD_ART_LABEL_LEFT + (besideRoom - beside) / 2,
      top: (artHeight - beside) / 2,
    };
  return {
    size: below,
    left: (artWidth - below) / 2,
    top: CARD_ART_LABEL_BAND + (belowRoom - below) / 2,
  };
}
