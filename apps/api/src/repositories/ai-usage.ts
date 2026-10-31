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
  /** False for a follow-up call that did not take another of the account's calls. */
  accountCall: boolean;
};
export type AiReserveResult =
  | {
      ok: true;
      reservation: AiReservation;
      /** One reservation per extra call reserved with it, in the order asked. */
      followUps: AiReservation[];
    }
  | { ok: false; reason: "account-limit" | "budget" | "account-unavailable" };

/** Cloudflare resets the free allocation at 00:00 UTC, so usage is keyed by UTC date. */
export const usageDay = (at: Date) => at.toISOString().slice(0, 10);

/** Reserve-before-call accounting in D1. Every change is one conditional statement. */
export class AiUsageRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Adds the estimated Neurons and one account call atomically, together with
   * any extra model calls the request already knows it will make (each counted
   * as a day call, none as an account call). The budget and the per-account
   * limit are checked inside the UPDATE, so concurrent requests cannot
   * overshoot either. The batch is one transaction, so changes() in the last
   * statement refers to the budget update before it.
   */
  async reserve(
    accountId: string,
    at: Date,
    neurons: number,
    purpose: AiPurpose = "pr",
    followUpNeurons: number[] = [],
  ): Promise<AiReserveResult> {
    const day = usageDay(at);
    const { column, limit } = PURPOSE[purpose];
    const total = followUpNeurons.reduce((sum, value) => sum + value, neurons);
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
          `UPDATE ai_usage_days SET neurons = neurons + ?3, calls = calls + ?6
          WHERE day = ?1 AND neurons + ?3 <= ?4
          AND EXISTS(SELECT 1 FROM ai_usage_accounts WHERE day = ?1 AND account_id = ?2 AND ${column} < ?5)`,
        )
        .bind(
          day,
          accountId,
          total,
          PR_AI_DAILY_NEURON_BUDGET,
          limit,
          1 + followUpNeurons.length,
        ),
      this.db
        .prepare(
          `UPDATE ai_usage_accounts SET ${column} = ${column} + 1 WHERE day = ?1 AND account_id = ?2 AND changes() > 0`,
        )
        .bind(day, accountId),
    ]);
    if (budget.meta.changes === 1) {
      const reservation = {
        day,
        accountId,
        neurons,
        purpose,
        accountCall: true,
      };
      return {
        ok: true,
        reservation,
        followUps: followUpNeurons.map((value) => ({
          ...reservation,
          neurons: value,
          accountCall: false,
        })),
      };
    }
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

  /**
   * Neurons for follow-up calls within a request that already holds the
   * account's call, reserved together or not at all: only the global budget is
   * checked, and only the day's model calls grow. Null when the budget has no
   * room left for all of them.
   */
  async reserveFollowUps(
    first: AiReservation,
    neurons: number[],
  ): Promise<AiReservation[] | null> {
    const total = neurons.reduce((sum, value) => sum + value, 0);
    const result = await this.db
      .prepare(
        "UPDATE ai_usage_days SET neurons = neurons + ?2, calls = calls + ?4 WHERE day = ?1 AND neurons + ?2 <= ?3",
      )
      .bind(first.day, total, PR_AI_DAILY_NEURON_BUDGET, neurons.length)
      .run();
    return result.meta.changes === 1
      ? neurons.map((value) => ({
          ...first,
          neurons: value,
          accountCall: false,
        }))
      : null;
  }

  async reserveFollowUp(first: AiReservation, neurons: number) {
    return (await this.reserveFollowUps(first, [neurons]))?.[0] ?? null;
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
   * Gives back the call after a failure (the account's too, when it took one).
   * The Neurons stay counted when the call may still have been billed (a timeout).
   */
  async release(reservation: AiReservation, keepNeurons: boolean) {
    const { column } = PURPOSE[reservation.purpose];
    const day = this.db
      .prepare(
        "UPDATE ai_usage_days SET calls = MAX(0, calls - 1), neurons = MAX(0, neurons - ?2) WHERE day = ?1",
      )
      .bind(reservation.day, keepNeurons ? 0 : reservation.neurons);
    await this.db.batch(
      reservation.accountCall
        ? [
            this.db
              .prepare(
                `UPDATE ai_usage_accounts SET ${column} = MAX(0, ${column} - 1) WHERE day = ? AND account_id = ?`,
              )
              .bind(reservation.day, reservation.accountId),
            day,
          ]
        : [day],
    );
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
