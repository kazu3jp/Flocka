import type { PRAiGroundedClaim } from "./pr-ai-output";

export const PR_AI_GROUNDING_MODEL = "@cf/cloudflare/clef";
/**
 * Measured on 2026-10-30 against the real model, three runs each (Clef gave the
 * same value every run): sentences that only restate their testimonies scored
 * 0.60-0.79, sentences adding a role, an award, a duration or an attitude
 * scored 0.01-0.16. The threshold sits between the two groups.
 */
export const PR_AI_GROUNDING_THRESHOLD = 0.5;

export function buildPRAiGroundingRequest(
  strength: string,
  claims: PRAiGroundedClaim[],
) {
  return {
    model: "clef",
    state: {
      language: "Japanese",
      confirmedStrength: strength,
      claims: claims.map((claim, index) => ({
        id: `claim_${index + 1}`,
        sentence: claim.sentence,
        citedTestimonies: claim.evidence,
      })),
    },
    questions: Object.fromEntries(
      claims.map((_, index) => [
        `claim_${index + 1}`,
        {
          type: "noul",
          instructions:
            "Is every factual assertion and evaluation in this claim fully supported by its cited testimonies or the confirmed strength? Answer yes only when nothing new is added. Paraphrasing is allowed, but invented details, stronger wording, unsupported intent, and unsupported conclusions are not.",
        },
      ]),
    ),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Clef answers a "noul" question as { type: "noul", noul: <probability> }. */
const probabilityOf = (answer: unknown) => {
  const value = isRecord(answer) ? answer.noul : answer;
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
};

export function parsePRAiGroundingDecision(
  result: unknown,
  claimCount: number,
): { ok: boolean; probabilities: number[] } {
  const answers =
    isRecord(result) && isRecord(result.answers) ? result.answers : {};
  const probabilities = Array.from({ length: claimCount }, (_, index) =>
    probabilityOf(answers[`claim_${index + 1}`]),
  );
  return {
    ok:
      probabilities.length === claimCount &&
      probabilities.every(
        (probability) => probability >= PR_AI_GROUNDING_THRESHOLD,
      ),
    probabilities,
  };
}
