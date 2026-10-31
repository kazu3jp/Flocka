import { z } from "zod";
import { CARDS } from "./catalog";
import {
  PR_AI_MAX_CHARACTERS,
  PR_AI_NEUTRAL_TERMS,
  type PRAiTestimony,
} from "./pr-ai-prompt";

export type PRAiOutputRejection =
  | "empty"
  | "invalid-structure"
  | "unknown-source"
  | "unknown-strength"
  | "quotation-marks"
  | "names-strength"
  | "giver-perspective"
  | "fabricated-number"
  | "unsupported-term"
  | "forbidden-format"
  | "too-long";
export type PRAiGroundedClaim = { sentence: string; evidence: string[] };
export type PRAiOutputVerdict =
  | {
      ok: true;
      text: string;
      claims: PRAiGroundedClaim[];
      /** 0-based indexes of the testimonies the claims cite, ascending. */
      cited: number[];
    }
  | {
      ok: false;
      reason: PRAiOutputRejection;
      /** For "unsupported-term": the words that the cited evidence lacks. */
      terms?: string[];
    };

/** Reasoning blocks, closed or left open by a truncated answer. */
export function stripReasoning(raw: string): string {
  return raw
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/i, "")
    .replace(/^[\s\S]*?<\/(think|thinking|reasoning)>/i, "")
    .trim();
}

const claimSchema = z
  .object({
    sentence: z.string().min(1).max(PR_AI_MAX_CHARACTERS),
    sourceIndexes: z.array(z.number().int()).max(3),
    // Tolerated from older prompts; the draft no longer quotes.
    quotes: z.array(z.string().max(160)).max(4).optional(),
  })
  .strict();
const outputSchema = z
  .object({ claims: z.array(claimSchema).min(1).max(5) })
  .strict();
const quotationMarks = /[「」『』]/;
/** "〜してくれた" is the giver's view; in the owner's own words it misattributes the act. */
const giverPerspective = /[てで]くれ/;
const forbiddenFormats = [
  /https?:\/\/|www\./i,
  /```|`/,
  /<\/?[a-z][^>]*>/i,
  /^\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s)/m,
  /\*\*|__|\[[^\]]*\]\([^)]*\)/,
];
const digits = /[0-9０-９]+/g;
const citationMarkers = /\s*[[［]\s*[0-9０-９]+\s*[\]］]/g;
const contentTerms = /[\p{Script=Han}\p{Script=Katakana}A-Za-z]{2,}/gu;
const neutralTerms = new Set<string>(PR_AI_NEUTRAL_TERMS);
const normalizeDigits = (value: string) =>
  value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );

/**
 * The draft is plain prose: no quotation marks and no catalog card name. Every
 * sentence names its D1 evidence; the server refuses numbers and content words
 * absent from that evidence, and the grounding verifier then judges each
 * sentence's meaning against it.
 */
export function validatePRAiOutput(
  raw: string,
  testimonies: PRAiTestimony[],
  cardKey: string,
): PRAiOutputVerdict {
  const content = stripReasoning(raw);
  if (!content) return { ok: false, reason: "empty" };
  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    return { ok: false, reason: "invalid-structure" };
  }
  const parsed = outputSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, reason: "invalid-structure" };
  if (!Object.hasOwn(CARDS, cardKey))
    return { ok: false, reason: "unknown-strength" };
  const strength = CARDS[cardKey].name;
  // "[1]" repeats sourceIndexes inside a sentence: metadata, not a claim.
  const claims = parsed.data.claims.map((claim) => ({
    ...claim,
    sentence: claim.sentence.replace(citationMarkers, "").trim(),
  }));
  if (claims.length > 4) return { ok: false, reason: "invalid-structure" };
  const usedSources = new Set<number>();
  const groundedClaims: PRAiGroundedClaim[] = [];
  for (const claim of claims) {
    if (
      claim.sourceIndexes.length === 0 ||
      new Set(claim.sourceIndexes).size !== claim.sourceIndexes.length
    )
      return { ok: false, reason: "invalid-structure" };
    const sources = claim.sourceIndexes.map((index) => testimonies[index - 1]);
    if (sources.some((source) => !source))
      return { ok: false, reason: "unknown-source" };
    claim.sourceIndexes.forEach((index) => usedSources.add(index));
    if (quotationMarks.test(claim.sentence))
      return { ok: false, reason: "quotation-marks" };
    if (forbiddenFormats.some((pattern) => pattern.test(claim.sentence)))
      return { ok: false, reason: "forbidden-format" };
    if (giverPerspective.test(claim.sentence))
      return { ok: false, reason: "giver-perspective" };
    const evidence = normalizeDigits(
      sources.map((source) => source.text).join("\n"),
    );
    // The catalog name reads as a game label, unless a giver used the words.
    if (claim.sentence.includes(strength) && !evidence.includes(strength))
      return { ok: false, reason: "names-strength" };
    const numbers = normalizeDigits(claim.sentence).match(digits) ?? [];
    if (numbers.some((number) => !evidence.includes(number)))
      return { ok: false, reason: "fabricated-number" };
    const unsupported = (claim.sentence.match(contentTerms) ?? []).filter(
      (term) => !neutralTerms.has(term) && !evidence.includes(term),
    );
    if (unsupported.length)
      return {
        ok: false,
        reason: "unsupported-term",
        terms: [...new Set(unsupported)],
      };
    groundedClaims.push({
      sentence: claim.sentence,
      evidence: sources.map((source) => source.text),
    });
  }
  if (usedSources.size < 2) return { ok: false, reason: "invalid-structure" };
  const text = claims.map(({ sentence }) => sentence).join("");
  if (Array.from(text).length > PR_AI_MAX_CHARACTERS)
    return { ok: false, reason: "too-long" };
  return {
    ok: true,
    text,
    claims: groundedClaims,
    cited: [...usedSources].map((index) => index - 1).sort((a, b) => a - b),
  };
}

export const PR_AI_REJECTION_MESSAGE =
  "AIの文章が安全な基準を満たさなかったため使えませんでした。もう一度お試しください";
