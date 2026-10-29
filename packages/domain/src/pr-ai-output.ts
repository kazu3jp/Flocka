import { z } from "zod";
import { CARDS } from "./catalog";
import {
  PR_AI_MAX_CHARACTERS,
  type PRAiTestimony,
} from "./pr-ai-prompt";

export type PRAiOutputRejection =
  | "empty"
  | "invalid-structure"
  | "unknown-source"
  | "unknown-strength"
  | "fabricated-quote"
  | "fabricated-number"
  | "unsupported-term"
  | "forbidden-format"
  | "too-long";
export type PRAiGroundedClaim = { sentence: string; evidence: string[] };
export type PRAiOutputVerdict =
  | { ok: true; text: string; claims: PRAiGroundedClaim[] }
  | { ok: false; reason: PRAiOutputRejection };

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
    sourceIndexes: z.array(z.number().int()).min(1).max(3),
    quotes: z.array(z.string().min(3).max(160)).min(1).max(3),
  })
  .strict();
const outputSchema = z
  .object({ claims: z.array(claimSchema).min(2).max(4) })
  .strict();
const forbiddenFormats = [
  /https?:\/\/|www\./i,
  /```|`/,
  /<\/?[a-z][^>]*>/i,
  /^\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s)/m,
  /\*\*|__|\[[^\]]*\]\([^)]*\)/,
];
const digits = /[0-9０-９]+/g;
const contentTerms = /[\p{Script=Han}\p{Script=Katakana}A-Za-z]{2,}/gu;
const neutralTerms = new Set([
  "自己PR",
  "仲間",
  "言葉",
  "強み",
  "証言",
]);
const normalizeDigits = (value: string) =>
  value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );

/**
 * Every sentence must identify its D1 evidence and carry an exact quote. The
 * server also refuses numbers and content words absent from that evidence.
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
  const usedSources = new Set<number>();
  const groundedClaims: PRAiGroundedClaim[] = [];
  for (const claim of parsed.data.claims) {
    if (
      new Set(claim.sourceIndexes).size !== claim.sourceIndexes.length ||
      new Set(claim.quotes).size !== claim.quotes.length
    )
      return { ok: false, reason: "invalid-structure" };
    const sources = claim.sourceIndexes.map((index) => testimonies[index - 1]);
    if (sources.some((source) => !source))
      return { ok: false, reason: "unknown-source" };
    claim.sourceIndexes.forEach((index) => usedSources.add(index));
    if (
      claim.quotes.some(
        (quote) =>
          !claim.sentence.includes(`「${quote}」`) ||
          !sources.some((source) => source.text.includes(quote)),
      ) ||
      sources.some((source) =>
        !claim.quotes.some((quote) => source.text.includes(quote)),
      )
    )
      return { ok: false, reason: "fabricated-quote" };
    if (forbiddenFormats.some((pattern) => pattern.test(claim.sentence)))
      return { ok: false, reason: "forbidden-format" };
    const evidence = normalizeDigits(
      `${CARDS[cardKey].name}\n${sources.map((source) => source.text).join("\n")}`,
    );
    const numbers = normalizeDigits(claim.sentence).match(digits) ?? [];
    if (numbers.some((number) => !evidence.includes(number)))
      return { ok: false, reason: "fabricated-number" };
    const outsideQuotes = claim.quotes.reduce(
      (sentence, quote) => sentence.replaceAll(`「${quote}」`, ""),
      claim.sentence,
    );
    const terms = outsideQuotes.match(contentTerms) ?? [];
    if (
      terms.some(
        (term) => !neutralTerms.has(term) && !evidence.includes(term),
      )
    )
      return { ok: false, reason: "unsupported-term" };
    groundedClaims.push({
      sentence: claim.sentence.trim(),
      evidence: sources.map((source) => source.text),
    });
  }
  if (usedSources.size < 2)
    return { ok: false, reason: "invalid-structure" };
  const text = parsed.data.claims.map(({ sentence }) => sentence.trim()).join("\n\n");
  if (Array.from(text).length > PR_AI_MAX_CHARACTERS)
    return { ok: false, reason: "too-long" };
  return { ok: true, text, claims: groundedClaims };
}

export const PR_AI_REJECTION_MESSAGE =
  "AIの文章が安全な基準を満たさなかったため使えませんでした。もう一度お試しください";
