/** CSS saturate(.55), applied in sRGB to the source card's self-claim artwork. */
export function selfClaimColor(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const channels = [1, 3, 5].map((offset) =>
    parseInt(hex.slice(offset, offset + 2), 16),
  );
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (
    "#" +
    channels
      .map((channel) =>
        Math.round(luminance + (channel - luminance) * 0.55)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
