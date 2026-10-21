import { z } from "zod";
import { ApiError } from "../http";

const positionSchema = z.object({
  at: z.string().min(1).max(64),
  id: z.string().min(1).max(100),
});
export type SyncPosition = z.infer<typeof positionSchema>;
/**
 * Each list keeps its own keyset position. `null` marks a list that has no
 * more rows, so a later page never queries it again.
 */
const syncCursorSchema = z.object({
  exchanges: positionSchema.nullable(),
  inbox: positionSchema.nullable(),
  sent: positionSchema.nullable(),
  requests: positionSchema.nullable(),
  blocks: z.string().min(1).max(100).nullable(),
});
export type SyncCursor = z.infer<typeof syncCursorSchema>;

export function encodeSyncCursor(cursor: SyncCursor): string {
  // Values are ISO timestamps and UUIDs, so the JSON is ASCII.
  return btoa(JSON.stringify(cursor))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeSyncCursor(value: string): SyncCursor {
  try {
    if (value.length > 2000) throw new Error("cursor too long");
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return syncCursorSchema.parse(JSON.parse(atob(base64)));
  } catch {
    throw new ApiError(
      422,
      "INVALID_INPUT",
      "同期の読み込み位置を確認できませんでした",
    );
  }
}
