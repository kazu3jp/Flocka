/** Compare JSON-shaped data so an unchanged sync keeps the rendered references. */
export function sameData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" ||
    typeof right !== "object" ||
    left === null ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false;
  if (Array.isArray(left)) {
    const items = right as unknown[];
    return (
      left.length === items.length &&
      left.every((item, index) => sameData(item, items[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>,
    rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord).filter(
    (key) => leftRecord[key] !== undefined,
  );
  return (
    keys.length ===
      Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined)
        .length &&
    keys.every((key) => sameData(leftRecord[key], rightRecord[key]))
  );
}

/** Keep the previous value when new data is equal, avoiding a re-render. */
export function keepIfSame<Value>(previous: Value, next: Value) {
  return sameData(previous, next) ? previous : next;
}
