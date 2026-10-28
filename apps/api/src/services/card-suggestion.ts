import {
  buildCardSuggestionMessages,
  buildCardSuggestionRequest,
  CARD_SUGGESTION_DAILY_CALLS_PER_ACCOUNT,
  CARD_SUGGESTION_MAX_COMPLETION_TOKENS,
  DEFAULT_PR_AI_MODEL,
  estimateNeurons,
  parseCardSuggestion,
  parseWorkersAiResult,
  promptCharacters,
  reserveNeurons,
  type CardSuggestion,
} from "@flocka/domain";
import { ApiError } from "../http";
import { AiUsageRepository } from "../repositories/ai-usage";
import {
  AiAllocationExhaustedError,
  aiDeadlineMs,
  AiTimeoutError,
  runWithDeadline,
  type AiRun,
} from "./workers-ai";

const RESET_NOTE = "UTC 0時（日本時間の朝9時）にリセットされます";
const PICK_YOURSELF = "カードは自分で選んで贈れます";

/**
 * Suggests the strength card a testimony's text speaks to. The call is
 * reserved before it is made like a self-PR draft, but counted on its own.
 * An answer that names no single card is an error, never a guess.
 */
export async function suggestCard(input: {
  env: Env;
  accountId: string;
  text: string;
  run: AiRun;
  now?: Date;
}): Promise<CardSuggestion> {
  const { env, accountId, text, run } = input,
    now = input.now ?? new Date(),
    model = env.PR_AI_MODEL || DEFAULT_PR_AI_MODEL,
    messages = buildCardSuggestionMessages(text),
    usage = new AiUsageRepository(env.DB);
  const reserved = await usage.reserve(
    accountId,
    now,
    reserveNeurons(
      model,
      promptCharacters(messages),
      CARD_SUGGESTION_MAX_COMPLETION_TOKENS,
    ),
    "card",
  );
  if (!reserved.ok) {
    if (reserved.reason === "account-limit")
      throw new ApiError(
        429,
        "AI_LIMIT_REACHED",
        `AIでカードを提案できるのは1日${CARD_SUGGESTION_DAILY_CALLS_PER_ACCOUNT}回までです。${RESET_NOTE}。${PICK_YOURSELF}`,
      );
    if (reserved.reason === "budget")
      throw new ApiError(
        429,
        "AI_BUDGET_EXHAUSTED",
        `本日のAI利用枠を使い切りました。${RESET_NOTE}。${PICK_YOURSELF}`,
      );
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
      buildCardSuggestionRequest(model, messages),
      aiDeadlineMs(env),
    );
  } catch (error) {
    if (error instanceof AiAllocationExhaustedError) {
      await usage.exhaustBudget(reservation.day);
      await usage.release(reservation, true);
      throw new ApiError(
        429,
        "AI_BUDGET_EXHAUSTED",
        `本日のAI利用枠を使い切りました。${RESET_NOTE}。${PICK_YOURSELF}`,
      );
    }
    await usage.release(reservation, error instanceof AiTimeoutError);
    console.error(
      JSON.stringify({
        event: "card_suggestion.failed",
        model,
        reason: error instanceof AiTimeoutError ? "timeout" : "error",
      }),
    );
    throw new ApiError(
      502,
      "AI_UNAVAILABLE",
      `AIに接続できませんでした。${PICK_YOURSELF}`,
    );
  }
  const parsed = parseWorkersAiResult(result);
  await usage.settle(
    reservation,
    parsed.neurons ??
      (parsed.usage
        ? estimateNeurons(model, parsed.usage)
        : reservation.neurons),
  );
  const card = parseCardSuggestion(parsed.text);
  console.log(
    JSON.stringify({
      event: "card_suggestion.completed",
      model,
      accepted: !!card,
    }),
  );
  if (!card)
    throw new ApiError(
      502,
      "AI_OUTPUT_REJECTED",
      `AIがカードを決められませんでした。${PICK_YOURSELF}`,
    );
  return { card };
}
