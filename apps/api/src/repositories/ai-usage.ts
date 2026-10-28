import { CARD_SUGGESTION_DAILY_CALLS_PER_ACCOUNT } from "@flocka/domain";

/** Per-account calls per UTC day. */
export const PR_AI_DAILY_CALLS_PER_ACCOUNT = 5;

/** What a call is for; each purpose has its own per-account count. */
export type AiPurpose = "pr" | "card";
const PURPOSE: Record<AiPurpose, { column: string; limit: number }> = {
  pr: { column: "calls", limit: PR_AI_DAILY_CALLS_PER_ACCOUNT },
  card: {
    column: "card_calls",
    limit: CARD_SUGGESTION_DAILY_CALLS_PER_ACCOUNT,
  },
};
/** Soft budget below Cloudflare's 10,000 free Neurons per day for the whole account. */
export const PR_AI_DAILY_NEURON_BUDGET = 9000;
const USAGE_RETENTION_DAYS = 7;

export type AiReservation = {
  day: string;
  accountId: string;
  neurons: number;
  purpose: AiPurpose;
};
export type AiReserveResult =
  | { ok: true; reservation: AiReservation }
  | { ok: false; reason: "account-limit" | "budget" | "account-unavailable" };

/** Cloudflare resets the free allocation at 00:00 UTC, so usage is keyed by UTC date. */
export const usageDay = (at: Date) => at.toISOString().slice(0, 10);

/** Reserve-before-call accounting in D1. Every change is one conditional statement. */
export class AiUsageRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Adds the estimated Neurons and one call atomically. The budget and the
   * per-account limit are checked inside the UPDATE, so concurrent requests
   * cannot overshoot either. The batch is one transaction, so changes() in the
   * last statement refers to the budget update before it.
   */
  async reserve(
    accountId: string,
    at: Date,
    neurons: number,
    purpose: AiPurpose = "pr",
  ): Promise<AiReserveResult> {
    const day = usageDay(at);
    const { column, limit } = PURPOSE[purpose];
    const [, , budget] = await this.db.batch([
      this.db
        .prepare("INSERT OR IGNORE INTO ai_usage_days(day) VALUES(?)")
        .bind(day),
      this.db
        .prepare(
          `INSERT OR IGNORE INTO ai_usage_accounts(day, account_id) SELECT ?1, ?2
          WHERE EXISTS(SELECT 1 FROM accounts WHERE id = ?2) AND NOT EXISTS(SELECT 1 FROM account_deletions WHERE account_id = ?2)`,
        )
        .bind(day, accountId),
      this.db
        .prepare(
          `UPDATE ai_usage_days SET neurons = neurons + ?3, calls = calls + 1
          WHERE day = ?1 AND neurons + ?3 <= ?4
          AND EXISTS(SELECT 1 FROM ai_usage_accounts WHERE day = ?1 AND account_id = ?2 AND ${column} < ?5)`,
        )
        .bind(day, accountId, neurons, PR_AI_DAILY_NEURON_BUDGET, limit),
      this.db
        .prepare(
          `UPDATE ai_usage_accounts SET ${column} = ${column} + 1 WHERE day = ?1 AND account_id = ?2 AND changes() > 0`,
        )
        .bind(day, accountId),
    ]);
    if (budget.meta.changes === 1)
      return { ok: true, reservation: { day, accountId, neurons, purpose } };
    const mine = await this.db
      .prepare(
        `SELECT ${column} AS calls FROM ai_usage_accounts WHERE day = ? AND account_id = ?`,
      )
      .bind(day, accountId)
      .first<{ calls: number }>();
    if (!mine) return { ok: false, reason: "account-unavailable" };
    return {
      ok: false,
      reason: mine.calls >= limit ? "account-limit" : "budget",
    };
  }

  /** Replaces the reserved estimate with the Neurons the call actually used. */
  async settle(reservation: AiReservation, actualNeurons: number) {
    await this.db
      .prepare(
        "UPDATE ai_usage_days SET neurons = MAX(0, neurons + ?2) WHERE day = ?1",
      )
      .bind(reservation.day, actualNeurons - reservation.neurons)
      .run();
  }

  /**
   * Gives back the account's call after a failure. The Neurons stay counted
   * when the call may still have been billed (a timeout).
   */
  async release(reservation: AiReservation, keepNeurons: boolean) {
    const { column } = PURPOSE[reservation.purpose];
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE ai_usage_accounts SET ${column} = MAX(0, ${column} - 1) WHERE day = ? AND account_id = ?`,
        )
        .bind(reservation.day, reservation.accountId),
      this.db
        .prepare(
          "UPDATE ai_usage_days SET calls = MAX(0, calls - 1), neurons = MAX(0, neurons - ?2) WHERE day = ?1",
        )
        .bind(reservation.day, keepNeurons ? 0 : reservation.neurons),
    ]);
  }

  /** Cloudflare said the allocation is gone, whatever our own count was. */
  async exhaustBudget(day: string) {
    await this.db
      .prepare(
        "UPDATE ai_usage_days SET neurons = MAX(neurons, ?2) WHERE day = ?1",
      )
      .bind(day, PR_AI_DAILY_NEURON_BUDGET)
      .run();
  }

  async deleteOlderThan(now: Date) {
    const cutoff = usageDay(
      new Date(now.getTime() - USAGE_RETENTION_DAYS * 86_400_000),
    );
    await this.db.batch([
      this.db
        .prepare("DELETE FROM ai_usage_accounts WHERE day < ?")
        .bind(cutoff),
      this.db.prepare("DELETE FROM ai_usage_days WHERE day < ?").bind(cutoff),
    ]);
  }
}
