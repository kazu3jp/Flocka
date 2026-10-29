import type { PRAiGroundedClaim } from "./pr-ai-output";

export const PR_AI_GROUNDING_MODEL = "@cf/cloudflare/clef";
export const PR_AI_GROUNDING_THRESHOLD = 0.9;

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

export function parsePRAiGroundingDecision(
  result: unknown,
  claimCount: number,
): { ok: boolean; probabilities: number[] } {
  const answers = isRecord(result) && isRecord(result.answers) ? result.answers : {};
  const probabilities = Array.from({ length: claimCount }, (_, index) => {
    const answer = answers[`claim_${index + 1}`];
    return typeof answer === "number" && Number.isFinite(answer) ? answer : -1;
  });
  return {
    ok:
      probabilities.length === claimCount &&
      probabilities.every(
        (probability) => probability >= PR_AI_GROUNDING_THRESHOLD,
      ),
    probabilities,
  };
}
