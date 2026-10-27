/**
 * Sizing rules for small phones and enlarged system fonts. Android and iOS
 * multiply every Text size by the user's font scale after the app has laid
 * the screen out; a screen that sizes text from the window height alone then
 * breaks on a tall, narrow phone or at a large font setting. These helpers
 * keep two decisions in one place: how far the system font scale may grow
 * text, and how large a display-font name may be for the room it has.
 */

/**
 * Largest factor the system font scale may enlarge each kind of text by
 * (Text `maxFontSizeMultiplier`). The wide display face is capped lower than
 * body text: it is already heavy, and a few characters fill a line. Body text
 * still grows with the user's setting up to 1.5, so reading stays possible.
 */
export const DISPLAY_FONT_MAX_MULTIPLIER = 1.2;
export const BODY_FONT_MAX_MULTIPLIER = 1.5;

/** The factor by which the system will really enlarge text with the given cap. */
export function appliedFontScale(fontScale: number, maxMultiplier: number) {
  return Math.min(Math.max(fontScale, 1), maxMultiplier);
}

/**
 * Advance of a character in the display face, in em. Kana, kanji and
 * full-width forms fill the em square; Latin letters and digits are narrower
 * but the wide capitals come close, so they are counted generously.
 */
function glyphAdvance(character: string) {
  const code = character.codePointAt(0) ?? 0;
  const fullWidth =
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0x1f000 && code <= 0x1faff);
  return fullWidth ? 1 : 0.8;
}

export function displayTextEm(text: string) {
  let total = 0;
  for (const character of text) total += glyphAdvance(character);
  return total;
}

/**
 * Extra room a wrapped line needs because a line can only break between
 * characters: the last line is rarely full.
 */
const WRAP_SLACK = 1.12;

/**
 * Font size for a name in the display face, between `maxSize` (what the
 * layout would use with plenty of room) and `minSize`.
 *
 * It stays on one line while it can at `minSize` or more. Otherwise it plans
 * for two lines, and assumes the display font cap, because a name that
 * already needs a second line has no spare room if the system enlarges it.
 * Names that fit at `maxSize` are returned unchanged.
 */
export function fitDisplayName({
  name,
  availableWidth,
  maxSize,
  minSize,
  fontScale,
}: {
  name: string;
  availableWidth: number;
  maxSize: number;
  minSize: number;
  fontScale: number;
}) {
  const em = displayTextEm(name);
  if (availableWidth <= 0 || em === 0) return maxSize;
  const applied = appliedFontScale(fontScale, DISPLAY_FONT_MAX_MULTIPLIER);
  const oneLine = Math.floor(availableWidth / (em * applied));
  if (oneLine >= maxSize) return maxSize;
  if (oneLine >= minSize) return oneLine;
  const worst = Math.max(applied, DISPLAY_FONT_MAX_MULTIPLIER);
  const twoLines = Math.floor((availableWidth * 2) / (em * worst * WRAP_SLACK));
  return Math.max(minSize, Math.min(maxSize, twoLines));
}

/**
 * Tallest card fan, in layout units, a space of `availableHeight` can hold
 * once the cards are rotated and shifted, or 0 when even the smallest fan
 * would not fit and the strength names should be listed instead.
 */
const FAN_ROTATION_ALLOWANCE = 1.22;
export function fanCardHeightFor(
  availableHeight: number,
  minimumCardHeight: number,
) {
  const cardHeight = availableHeight / FAN_ROTATION_ALLOWANCE;
  return cardHeight >= minimumCardHeight ? cardHeight : 0;
}

/**
 * Height of a card in a row of `count` cards that share `rowWidth`. On a
 * 390pt phone a three-card row keeps its full `height`; on a narrower phone
 * the cards grow no taller than twice their width, so they shrink as a whole
 * instead of becoming thin strips.
 */
export function cardHeightInRow(
  rowWidth: number,
  count: number,
  gap: number,
  height: number,
) {
  const cardWidth = (rowWidth - gap * (count - 1)) / count;
  return Math.min(height, Math.round(cardWidth * TALL_CARD_ASPECT));
}

const TALL_CARD_ASPECT = 2;
