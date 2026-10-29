import {
  buildPRAiMessages,
  buildPRAiGroundingRequest,
  buildPRAiRequest,
  CARDS,
  DEFAULT_PR_AI_MODEL,
  estimateNeurons,
  estimateTokensFromChars,
  parsePRAiGroundingDecision,
  parseWorkersAiResult,
  PR_AI_GROUNDING_MODEL,
  PR_AI_MAX_CHARACTERS,
  PR_AI_MAX_COMPLETION_TOKENS,
  PR_AI_REJECTION_MESSAGE,
  promptCharacters,
  reserveNeurons,
  validatePRAiOutput,
  type PRAiDraft,
} from "@flocka/domain";
import { ApiError } from "../http";
import {
  AiUsageRepository,
  PR_AI_DAILY_CALLS_PER_ACCOUNT,
  usageDay,
} from "../repositories/ai-usage";
import { PRAiEvidenceRepository } from "../repositories/pr-ai-evidence";
import {
  AiAllocationExhaustedError,
  aiDeadlineMs,
  AiTimeoutError,
  runWithDeadline,
  type AiRun,
} from "./workers-ai";

const RESET_NOTE = "UTC 0時（日本時間の朝9時）にリセットされます";
const budgetExhausted = () =>
  new ApiError(
    429,
    "AI_BUDGET_EXHAUSTED",
    `本日のAI利用枠を使い切りました。${RESET_NOTE}。それまでは今の下書きをそのまま使えます`,
  );

/**
 * Writes a self-PR draft from the caller's own testimonies. Order matters: the
 * evidence is loaded from D1 (never from the client), the call is reserved
 * before it is made, and nothing is returned unless the output passed validation.
 */
export async function generatePRAiDraft(input: {
  env: Env;
  accountId: string;
  card: string;
  run: AiRun;
  now?: Date;
}): Promise<PRAiDraft> {
  const { env, accountId, card, run } = input,
    now = input.now ?? new Date(),
    model = env.PR_AI_MODEL || DEFAULT_PR_AI_MODEL,
    evidence = new PRAiEvidenceRepository(env.DB);
  if (await evidence.disagreed(accountId, card))
    throw new ApiError(
      409,
      "PR_CARD_NOT_USABLE",
      "「違う」と答えた強みでは自己PRを作れません",
    );
  const loaded = await evidence.load(accountId, card);
  if (!loaded)
    throw new ApiError(
      409,
      "PR_CARD_NOT_CONFIRMED",
      "この強みはまだ2人以上の証言がそろっていません。同期してからもう一度お試しください",
    );
  const messages = buildPRAiMessages(card, loaded.testimonies);
  const usage = new AiUsageRepository(env.DB);
  const generationReservation = reserveNeurons(
    model,
    promptCharacters(messages),
    PR_AI_MAX_COMPLETION_TOKENS,
  );
  // Reserve the verifier before either billable call. Its state repeats the
  // evidence and adds at most one draft plus short decision questions.
  const groundingReservation = reserveNeurons(
    PR_AI_GROUNDING_MODEL,
    promptCharacters(messages) + PR_AI_MAX_CHARACTERS + 1500,
    0,
  );
  const reserved = await usage.reserve(
    accountId,
    now,
    generationReservation + groundingReservation,
  );
  if (!reserved.ok) {
    if (reserved.reason === "account-limit")
      throw new ApiError(
        429,
        "AI_LIMIT_REACHED",
        `AIで整えられるのは1日${PR_AI_DAILY_CALLS_PER_ACCOUNT}回までです。${RESET_NOTE}`,
      );
    if (reserved.reason === "budget") throw budgetExhausted();
    throw new ApiError(
      409,
      "ACCOUNT_UNAVAILABLE",
      "アカウントが削除中、または利用できません",
    );
  }
  const { reservation } = reserved;
  let result: unknown;
  try {
    result = await runWithDeadline(
      run,
      model,
      buildPRAiRequest(model, messages),
      aiDeadlineMs(env),
    );
  } catch (error) {
    if (error instanceof AiAllocationExhaustedError) {
      await usage.exhaustBudget(reservation.day);
      await usage.release(reservation, true);
      throw budgetExhausted();
    }
    // A timeout may still be billed, so its Neurons stay counted.
    await usage.release(reservation, error instanceof AiTimeoutError);
    console.error(
      JSON.stringify({
        event: "pr_ai.failed",
        model,
        reason: error instanceof AiTimeoutError ? "timeout" : "error",
      }),
    );
    throw new ApiError(
      502,
      "AI_UNAVAILABLE",
      "AIに接続できませんでした。少し待ってからもう一度お試しください",
    );
  }
  const parsed = parseWorkersAiResult(result);
  // Cloudflare's own figure first, then tokens x table; without either, the
  // reservation (an upper bound) stays as the cost.
  const actual =
    parsed.neurons ??
    (parsed.usage
      ? estimateNeurons(model, parsed.usage)
      : generationReservation);
  const verdict = validatePRAiOutput(parsed.text, loaded.testimonies, card);
  if (!verdict.ok) {
    await usage.settle(reservation, actual);
    console.log(
      JSON.stringify({
        event: "pr_ai.completed",
        model,
        day: usageDay(now),
        neurons: Math.round(actual * 100) / 100,
        usageKnown: parsed.usage !== null,
        reportedNeurons: parsed.neurons !== null,
        finishReason: parsed.finishReason,
        reasoning: parsed.reasoningFields,
        accepted: false,
        rejection: verdict.reason,
      }),
    );
    throw new ApiError(502, "AI_OUTPUT_REJECTED", PR_AI_REJECTION_MESSAGE);
  }
  const groundingRequest = buildPRAiGroundingRequest(
    CARDS[card].name,
    verdict.claims,
  );
  const groundingNeurons = estimateNeurons(PR_AI_GROUNDING_MODEL, {
    promptTokens: estimateTokensFromChars(
      JSON.stringify(groundingRequest).length,
    ),
    completionTokens: 0,
  });
  let groundingResult: unknown;
  try {
    groundingResult = await runWithDeadline(
      run,
      PR_AI_GROUNDING_MODEL,
      groundingRequest,
      aiDeadlineMs(env),
    );
  } catch (error) {
    if (error instanceof AiAllocationExhaustedError) {
      await usage.exhaustBudget(reservation.day);
      throw budgetExhausted();
    }
    await usage.settle(
      reservation,
      actual + (error instanceof AiTimeoutError ? groundingNeurons : 0),
    );
    console.error(
      JSON.stringify({
        event: "pr_ai.grounding_failed",
        model: PR_AI_GROUNDING_MODEL,
        reason: error instanceof AiTimeoutError ? "timeout" : "error",
      }),
    );
    throw new ApiError(
      502,
      "AI_UNAVAILABLE",
      "AIの根拠を確認できませんでした。少し待ってからもう一度お試しください",
    );
  }
  const grounding = parsePRAiGroundingDecision(
    groundingResult,
    verdict.claims.length,
  );
  const totalNeurons = actual + groundingNeurons;
  await usage.settle(reservation, totalNeurons);
  console.log(
    JSON.stringify({
      event: "pr_ai.completed",
      model,
      groundingModel: PR_AI_GROUNDING_MODEL,
      day: usageDay(now),
      neurons: Math.round(totalNeurons * 100) / 100,
      usageKnown: parsed.usage !== null,
      reportedNeurons: parsed.neurons !== null,
      finishReason: parsed.finishReason,
      reasoning: parsed.reasoningFields,
      groundingProbabilities: grounding.probabilities,
      accepted: grounding.ok,
      ...(grounding.ok ? {} : { rejection: "grounding" }),
    }),
  );
  if (!grounding.ok)
    throw new ApiError(502, "AI_OUTPUT_REJECTED", PR_AI_REJECTION_MESSAGE);
  return {
    text: verdict.text,
    source: { card, pieceIds: loaded.pieceIds },
    model,
    generatedAt: now.toISOString(),
  };
}
