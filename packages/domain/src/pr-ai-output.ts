import { PR_AI_MAX_CHARACTERS } from "./pr-ai-prompt";

export type PRAiOutputRejection =
  | "empty"
  | "too-long"
  | "not-japanese"
  | "forbidden-format"
  | "no-quote"
  | "fabricated-quote"
  | "fabricated-number";
export type PRAiOutputVerdict =
  { ok: true; text: string } | { ok: false; reason: PRAiOutputRejection };

/** Reasoning blocks, closed or left open by a truncated answer. */
export function stripReasoning(raw: string): string {
  return raw
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/i, "")
    .replace(/^[\s\S]*?<\/(think|thinking|reasoning)>/i, "")
    .trim();
}

const japanese = /[぀-ヿ㐀-鿿]/gu;
const letters = /[\p{L}]/gu;
const forbiddenFormats = [
  /https?:\/\/|www\./i,
  /```|`/,
  /<\/?[a-z][^>]*>/i,
  /^\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s)/m,
  /\*\*|__|\[[^\]]*\]\([^)]*\)/,
];
const digits = /[0-9０-９]+/g;
const normalizeDigits = (value: string) =>
  value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );

/**
 * Accepts the model output only when it is plain Japanese prose whose quotations
 * and numbers all come from the testimonies the server itself loaded.
 */
export function validatePRAiOutput(
  raw: string,
  sources: string[],
): PRAiOutputVerdict {
  const text = stripReasoning(raw);
  if (!text) return { ok: false, reason: "empty" };
  if (Array.from(text).length > PR_AI_MAX_CHARACTERS)
    return { ok: false, reason: "too-long" };
  if (forbiddenFormats.some((pattern) => pattern.test(text)))
    return { ok: false, reason: "forbidden-format" };
  const letterCount = text.match(letters)?.length ?? 0;
  if (!letterCount || (text.match(japanese)?.length ?? 0) / letterCount < 0.6)
    return { ok: false, reason: "not-japanese" };
  const quotes = [...text.matchAll(/「([^「」]+)」/g)].map((match) => match[1]);
  if (!quotes.some((quote) => Array.from(quote).length >= 3))
    return { ok: false, reason: "no-quote" };
  if (quotes.some((quote) => !sources.some((source) => source.includes(quote))))
    return { ok: false, reason: "fabricated-quote" };
  const known = normalizeDigits(sources.join("\n"));
  const numbers = normalizeDigits(text).match(digits) ?? [];
  if (numbers.some((number) => !known.includes(number)))
    return { ok: false, reason: "fabricated-number" };
  return { ok: true, text };
}

export const PR_AI_REJECTION_MESSAGE =
  "AIの文章が安全な基準を満たさなかったため使えませんでした。もう一度お試しください";
