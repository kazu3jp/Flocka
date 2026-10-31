import {
  buildPRAiGroundingRequest,
  buildPRAiMessages,
  buildPRAiRepairMessages,
  buildPRAiRequest,
  CARDS,
  DEFAULT_PR_AI_MODEL,
  estimateNeurons,
  estimateTokensFromChars,
  parsePRAiGroundingDecision,
  parseWorkersAiResult,
  PR_AI_GROUNDING_MODEL,
  PR_AI_GROUNDING_THRESHOLD,
  PR_AI_MAX_CHARACTERS,
  PR_AI_MAX_COMPLETION_TOKENS,
  PR_AI_REJECTION_MESSAGE,
  promptCharacters,
  reserveNeurons,
  stripReasoning,
  validatePRAiOutput,
  type PRAiDraft,
  type PRAiMessage,
  type PRAiRefusal,
} from "@flocka/domain";
import { ApiError } from "../http";
import {
  AiUsageRepository,
  PR_AI_DAILY_CALLS_PER_ACCOUNT,
  usageDay,
  type AiReservation,
} from "../repositories/ai-usage";
import { PRAiEvidenceRepository } from "../repositories/pr-ai-evidence";
import {
  AiAllocationExhaustedError,
  aiDeadlineMs,
  AiTimeoutError,
  runHedged,
  type AiRun,
} from "./workers-ai";

/** A refused draft gets one repair round, only while this share of the deadline remains. */
const REPAIR_MIN_DEADLINE_SHARE = 0.2;
/**
 * A call still unanswered after this share of the deadline (6 s of 25 s) gets a
 * second request. Measured on 2026-10-30: first calls answered within 4.3 s
 * (23 calls), while repair calls had a tail of 5.3, 5.6, 9.9, 11.4 and 43 s (15 calls).
 */
const HEDGE_AFTER_DEADLINE_SHARE = 0.24;
/** A second request is only worth sending while this share of the deadline remains. */
const SECOND_REQUEST_MIN_DEADLINE_SHARE = 0.2;

const RESET_NOTE = "UTC 0時（日本時間の朝9時）にリセットされます";
const budgetExhausted = () =>
  new ApiError(
    429,
    "AI_BUDGET_EXHAUSTED",
    `本日のAI利用枠を使い切りました。${RESET_NOTE}。それまでは今の下書きをそのまま使えます`,
  );

const unavailable = (message: string) =>
  new ApiError(502, "AI_UNAVAILABLE", message);
const rejected = () =>
  new ApiError(502, "AI_OUTPUT_REJECTED", PR_AI_REJECTION_MESSAGE);

/** The whole request shares one deadline: every call, repair and hedge included. */
type Deadline = { fullMs: number; remainingMs: () => number };

/**
 * One logical model call, settled against its reservation. A second identical
 * request goes out when the first is slow or hit a transient Workers AI error
 * (see runHedged); it takes Neurons, never another of the user's calls.
 * Failures release what was not billed and surface as ApiErrors.
 */
async function callModel(input: {
  usage: AiUsageRepository;
  run: AiRun;
  model: string;
  request: Record<string, unknown>;
  reservation: AiReservation;
  deadline: Deadline;
  /** The call's cost once answered; the reservation is an upper bound. */
  costOf: (result: unknown) => number;
  failureMessage: string;
}) {
  const { usage, model, reservation, deadline } = input;
  const reservations: AiReservation[] = [reservation];
  const outcome = await runHedged({
    run: input.run,
    model,
    inputs: input.request,
    deadlineMs: deadline.remainingMs(),
    hedgeAfterMs: deadline.fullMs * HEDGE_AFTER_DEADLINE_SHARE,
    secondMinMs: deadline.fullMs * SECOND_REQUEST_MIN_DEADLINE_SHARE,
    reserveSecond: async () => {
      const second = await usage.reserveFollowUp(
        reservation,
        reservation.neurons,
      );
      if (second) reservations.push(second);
      return second !== null;
    },
  });
  if (!outcome.ok) {
    const allocation = outcome.error instanceof AiAllocationExhaustedError;
    if (allocation) await usage.exhaustBudget(reservation.day);
    // An unanswered request may still be billed, so its Neurons stay counted.
    for (const [index, held] of reservations.entries())
      await usage.release(
        held,
        allocation || outcome.requests[index] === "unanswered",
      );
    if (allocation) throw budgetExhausted();
    console.error(
      JSON.stringify({
        event: "pr_ai.failed",
        model,
        requests: outcome.requests,
        reason: outcome.error instanceof AiTimeoutError ? "timeout" : "error",
      }),
    );
    throw unavailable(input.failureMessage);
  }
  const winner = outcome.requests.indexOf("answered");
  const neurons = input.costOf(outcome.result);
  for (const [index, held] of reservations.entries()) {
    if (index === winner) await usage.settle(held, neurons);
    // A failed request was not billed; the call still happened, so it stays counted.
    else if (outcome.requests[index] === "failed") await usage.settle(held, 0);
  }
  return {
    result: outcome.result,
    neurons,
    requests: outcome.requests.length,
  };
}

/**
 * Writes a self-PR draft from the caller's own testimonies. Order matters: the
 * evidence is loaded from D1 (never from the client), both billable calls are
 * reserved before either is made, and nothing is returned unless the output
 * passed the deterministic validation and the grounding verifier. A refused
 * draft is sent back once with the exact reason; the repair round takes
 * Neurons, never another of the user's calls.
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
  const generationNeurons = (round: PRAiMessage[]) =>
    reserveNeurons(model, promptCharacters(round), PR_AI_MAX_COMPLETION_TOKENS);
  // The verifier's state repeats the evidence and adds at most one draft plus
  // short decision questions.
  const groundingNeurons = reserveNeurons(
    PR_AI_GROUNDING_MODEL,
    promptCharacters(messages) + PR_AI_MAX_CHARACTERS + 1500,
    0,
  );
  // The verifier is reserved with the draft, in the same atomic statement,
  // before either billable call.
  const reserved = await usage.reserve(
    accountId,
    now,
    generationNeurons(messages),
    "pr",
    [groundingNeurons],
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
  const account = reserved.reservation;
  const [firstGrounding] = reserved.followUps;
  const started = Date.now(),
    fullMs = aiDeadlineMs(env),
    deadline: Deadline = {
      fullMs,
      remainingMs: () => fullMs - (Date.now() - started),
    };
  const generationCost = (result: unknown, roundMessages: PRAiMessage[]) => {
    const parsed = parseWorkersAiResult(result);
    // Cloudflare's own figure first, then tokens x table.
    return (
      parsed.neurons ??
      (parsed.usage
        ? estimateNeurons(model, parsed.usage)
        : generationNeurons(roundMessages))
    );
  };
  const rejections: string[] = [];
  let round = {
      messages,
      generation: account,
      grounding: firstGrounding,
    },
    neurons = 0,
    requests = 0,
    probabilities: number[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const repairing = attempt > 1;
    let generated: Awaited<ReturnType<typeof callModel>>;
    try {
      generated = await callModel({
        usage,
        run,
        model,
        request: buildPRAiRequest(model, round.messages),
        reservation: round.generation,
        deadline,
        costOf: (result) => generationCost(result, round.messages),
        failureMessage:
          "AIに接続できませんでした。少し待ってからもう一度お試しください",
      });
    } catch (error) {
      // Once Cloudflare reports the allocation gone, the day stays full.
      await usage.release(
        round.grounding,
        error instanceof ApiError && error.code === "AI_BUDGET_EXHAUSTED",
      );
      // The first draft was already refused; a failed repair leaves it refused.
      if (
        repairing &&
        error instanceof ApiError &&
        error.code === "AI_UNAVAILABLE"
      )
        throw rejected();
      throw error;
    }
    neurons += generated.neurons;
    requests += generated.requests;
    const parsed = parseWorkersAiResult(generated.result);
    const verdict = validatePRAiOutput(parsed.text, loaded.testimonies, card);
    let refusal: PRAiRefusal;
    if (!verdict.ok) {
      await usage.release(round.grounding, false);
      refusal = verdict;
    } else {
      const groundingRequest = buildPRAiGroundingRequest(
        CARDS[card].name,
        verdict.claims,
      );
      let grounded: Awaited<ReturnType<typeof callModel>>;
      try {
        grounded = await callModel({
          usage,
          run,
          model: PR_AI_GROUNDING_MODEL,
          request: groundingRequest,
          reservation: round.grounding,
          deadline,
          costOf: (result) =>
            parseWorkersAiResult(result).neurons ??
            estimateNeurons(PR_AI_GROUNDING_MODEL, {
              promptTokens: estimateTokensFromChars(
                JSON.stringify(groundingRequest).length,
              ),
              completionTokens: 0,
            }),
          failureMessage:
            "AIの根拠を確認できませんでした。少し待ってからもう一度お試しください",
        });
      } catch (error) {
        if (
          repairing &&
          error instanceof ApiError &&
          error.code === "AI_UNAVAILABLE"
        )
          throw rejected();
        throw error;
      }
      neurons += grounded.neurons;
      requests += grounded.requests;
      const decision = parsePRAiGroundingDecision(
        grounded.result,
        verdict.claims.length,
      );
      probabilities = decision.probabilities;
      if (decision.ok) {
        logCompletion({ accepted: true });
        return {
          text: verdict.text,
          // Only the testimonies the claims cite are the draft's source.
          source: {
            card,
            pieceIds: verdict.cited.map((index) => loaded.pieceIds[index]),
          },
          model,
          generatedAt: now.toISOString(),
        };
      }
      refusal = {
        reason: "ungrounded-claim",
        sentences: verdict.claims
          .filter(
            (_, index) =>
              !(decision.probabilities[index] >= PR_AI_GROUNDING_THRESHOLD),
          )
          .map((claim) => claim.sentence),
      };
    }
    rejections.push(refusal.reason);
    if (
      repairing ||
      deadline.remainingMs() < fullMs * REPAIR_MIN_DEADLINE_SHARE
    ) {
      logCompletion({ accepted: false });
      throw rejected();
    }
    const repair = buildPRAiRepairMessages(
      messages,
      stripReasoning(parsed.text),
      refusal,
    );
    const followUps = await usage.reserveFollowUps(account, [
      generationNeurons(repair),
      groundingNeurons,
    ]);
    if (!followUps) {
      logCompletion({ accepted: false });
      throw rejected();
    }
    const [generation, grounding] = followUps;
    round = { messages: repair, generation, grounding };
  }

  function logCompletion(result: { accepted: boolean }) {
    console.log(
      JSON.stringify({
        event: "pr_ai.completed",
        model,
        groundingModel: PR_AI_GROUNDING_MODEL,
        day: usageDay(now),
        neurons: Math.round(neurons * 100) / 100,
        // Requests sent to Workers AI, hedges and transient retries included.
        requests,
        attempts: rejections.length + Number(result.accepted),
        groundingProbabilities: probabilities,
        accepted: result.accepted,
        // Reasons only, never any text.
        ...(rejections.length ? { rejections } : {}),
      }),
    );
  }
}
