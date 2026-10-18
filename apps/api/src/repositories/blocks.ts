import { ApiError } from "../http";

export class BlocksRepository {
  constructor(private readonly db: D1Database) {}

  async create(accountId: string, blockedId: string) {
    const token = crypto.randomUUID();
    const result = await this.db
      .prepare(
        "INSERT OR IGNORE INTO blocks(account_id, blocked_id, created_at, mutation_id) VALUES(?, ?, ?, ?)",
      )
      .bind(accountId, blockedId, new Date().toISOString(), token)
      .run();
    // An existing block was not created by this action and must not be undone by it.
    return {
      blocked: true as const,
      undoToken: result.meta.changes ? token : null,
    };
  }

  async remove(accountId: string, blockedId: string, undoToken?: string) {
    const result = await this.db
      .prepare(
        "DELETE FROM blocks WHERE account_id = ? AND blocked_id = ? AND (? IS NULL OR mutation_id = ?)",
      )
      .bind(accountId, blockedId, undoToken ?? null, undoToken ?? null)
      .run();
    if (undoToken !== undefined && !result.meta.changes)
      throw new ApiError(
        409,
        "BLOCK_CONFLICT",
        "ブロック状態が変更されています。最新の内容を確認してください",
      );
    return { blocked: false as const };
  }
}
