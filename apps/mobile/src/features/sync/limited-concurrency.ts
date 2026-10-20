/** Runs `task` for every item with at most `limit` tasks in flight at once. */
export async function forEachWithLimit<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker),
  );
}
