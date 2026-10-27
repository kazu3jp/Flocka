export const SHOWCASE_CHOICE_GAP = 10;
// Below this a card's name and illustration get cramped, so narrow phones
// show two columns instead of the design's three.
const MIN_SHOWCASE_CHOICE_WIDTH = 100;

/**
 * Floors the width: fractional widths can round up on device pixels, and three
 * of them plus the gaps then overflow the row and wrap the last card.
 */
export function showcaseChoiceLayout(gridWidth: number) {
  const widthFor = (columns: number) =>
    Math.max(
      0,
      Math.floor((gridWidth - SHOWCASE_CHOICE_GAP * (columns - 1)) / columns),
    );
  const columns = widthFor(3) >= MIN_SHOWCASE_CHOICE_WIDTH ? 3 : 2;
  return { columns, width: widthFor(columns) };
}
