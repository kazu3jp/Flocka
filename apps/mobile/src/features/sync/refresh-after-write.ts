import { UserFacingError } from "./user-facing-error";

/**
 * Reads back the latest data after a write the server already accepted. When
 * only that read fails, the error says the write is done, so the person does
 * not repeat it or take it for lost.
 */
export async function refreshAfterWrite(
  refresh: () => Promise<void>,
  done: string,
) {
  try {
    await refresh();
  } catch {
    throw new UserFacingError(`${done}。最新データの取得に失敗しました。`);
  }
}
