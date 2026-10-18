/** Allocate independent clients within the reserved 198.19.0.0/16 test range. */
export function testClientAddress(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 65_535)
    throw new Error("Test client address range exhausted or invalid");
  return `198.19.${Math.floor(sequence / 256)}.${sequence % 256}`;
}
