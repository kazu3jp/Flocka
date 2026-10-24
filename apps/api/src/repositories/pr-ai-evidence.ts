import { PR_AI_MAX_TESTIMONIES, type PRAiTestimony } from "@flocka/domain";
import { noBlockBetween } from "./exchanges";

type EvidenceRow = {
  id: string;
  sender_id: string;
  kind: "vibe" | "proof";
  label: string | null;
  text: string | null;
  story: string | null;
};
export type PRAiEvidence = { testimonies: PRAiTestimony[]; pieceIds: string[] };

/** Same wording the app quotes in its own draft (see wordsOf in the domain). */
const wordsOf = (row: EvidenceRow) =>
  (row.kind === "proof" ? row.story : row.text || row.label) ?? "";

/**
 * The caller's own opened, visible testimonies for one card, chosen the way the
 * app chooses them (proof first, one per giver, at most three). Returns null
 * unless at least two different givers confirm the card, so the evidence always
 * satisfies the preference source check.
 */
export class PRAiEvidenceRepository {
  constructor(private readonly db: D1Database) {}

  async load(accountId: string, card: string): Promise<PRAiEvidence | null> {
    const rows = await this.db
      .prepare(
        `SELECT t.id, t.sender_id, t.kind, t.label, t.text, t.story FROM testimonies AS t
        WHERE t.recipient_id = ?1 AND t.card = ?2 AND t.opened = 1 AND t.visibility != 'hidden'
        AND t.removed_at IS NULL AND ${noBlockBetween("t.recipient_id", "t.sender_id")}
        ORDER BY t.created_at, t.id`,
      )
      .bind(accountId, card)
      .all<EvidenceRow>();
    if (new Set(rows.results.map((row) => row.sender_id)).size < 2) return null;
    const givers = new Set<string>();
    const chosen = rows.results
      .filter((row) => wordsOf(row).trim() !== "")
      .sort((a, b) => Number(b.kind === "proof") - Number(a.kind === "proof"))
      .filter((row) => {
        if (givers.has(row.sender_id)) return false;
        givers.add(row.sender_id);
        return true;
      })
      .slice(0, PR_AI_MAX_TESTIMONIES);
    if (chosen.length < 2) return null;
    return {
      testimonies: chosen.map((row) => ({ id: row.id, text: wordsOf(row) })),
      pieceIds: chosen.map((row) => row.id),
    };
  }

  /** The owner's own "disagree" answer rules a card out of the self-PR. */
  async disagreed(accountId: string, card: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT data_json FROM player_preferences WHERE account_id = ?")
      .bind(accountId)
      .first<{ data_json: string }>();
    if (!row) return false;
    const { resp } = JSON.parse(row.data_json) as {
      resp?: Record<string, string>;
    };
    return (
      resp !== undefined &&
      Object.hasOwn(resp, card) &&
      resp[card] === "disagree"
    );
  }
}
