/** Runs one model call. Tests substitute the AI binding, never this contract. */
export type AiRun = (
  model: string,
  inputs: Record<string, unknown>,
) => Promise<unknown>;

export const AI_DEADLINE_MS = 25_000;

export class AiTimeoutError extends Error {}
/** Cloudflare's free daily Neuron allocation is used up (error code 4006). */
export class AiAllocationExhaustedError extends Error {}

export function aiRunnerFor(env: Env): AiRun {
  return (model, inputs) =>
    (env.AI as unknown as { run: AiRun }).run(model, inputs);
}

export const aiDeadlineMs = (env: Env) => {
  const configured = Number(env.PR_AI_TIMEOUT_MS);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : AI_DEADLINE_MS;
};

const allocationExceeded = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (code === 4006 || code === "4006") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /\b4006\b|daily free allocation|neurons/i.test(message);
};

/** Resolves with the raw model result, or throws a typed error for the two known failures. */
export async function runWithDeadline(
  run: AiRun,
  model: string,
  inputs: Record<string, unknown>,
  deadlineMs: number,
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = (async () => run(model, inputs))();
  // A call that outlives its deadline must not become an unhandled rejection.
  call.catch(() => undefined);
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiTimeoutError()), deadlineMs);
  });
  try {
    return await Promise.race([call, deadline]);
  } catch (error) {
    if (error instanceof AiTimeoutError) throw error;
    if (allocationExceeded(error)) throw new AiAllocationExhaustedError();
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Workers AI failures that a fresh request usually does not hit: internal
 * errors (8005, 3043) and temporary capacity limits (3040). Measured on
 * 2026-10-30, they came back within 3 s, so a retry fits in the deadline.
 */
export function isTransientAiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(3040|3043|8005)\b|internal server error|capacity temporarily exceeded/i.test(
    message,
  );
}

/** How each request of a hedged call ended. "unanswered" may still be billed. */
export type HedgedRequest = "answered" | "failed" | "unanswered";
export type HedgedOutcome =
  | { ok: true; result: unknown; requests: HedgedRequest[] }
  | { ok: false; error: Error; requests: HedgedRequest[] };

type Settled = { index: number } & (
  { ok: true; result: unknown } | { ok: false; error: unknown }
);

/**
 * One logical model call that may send one more identical request: when the
 * first has not answered after `hedgeAfterMs`, or failed with a transient
 * error while at least `secondMinMs` of the deadline remains. The first answer
 * wins. The second request is sent only after `reserveSecond` agreed to pay
 * for it. Never throws: the outcome lists how each request ended so the caller
 * can account for each one.
 */
export async function runHedged(input: {
  run: AiRun;
  model: string;
  inputs: Record<string, unknown>;
  deadlineMs: number;
  hedgeAfterMs: number;
  secondMinMs: number;
  reserveSecond: () => Promise<boolean>;
}): Promise<HedgedOutcome> {
  const started = Date.now(),
    elapsed = () => Date.now() - started,
    requests: HedgedRequest[] = [],
    pending = new Map<number, Promise<Settled>>();
  const send = (index: number) => {
    requests[index] = "unanswered";
    pending.set(
      index,
      (async () => input.run(input.model, input.inputs))().then(
        (result): Settled => ({ index, ok: true, result }),
        (error: unknown): Settled => ({ index, ok: false, error }),
      ),
    );
  };
  let secondTried = false,
    lastError: unknown = null;
  const trySecond = async () => {
    secondTried = true;
    if (
      input.deadlineMs - elapsed() >= input.secondMinMs &&
      (await input.reserveSecond())
    )
      send(1);
  };
  if (input.deadlineMs <= 0)
    return { ok: false, error: new AiTimeoutError(), requests };
  send(0);
  for (;;) {
    const left = input.deadlineMs - elapsed();
    if (left <= 0 || pending.size === 0)
      return {
        ok: false,
        error:
          pending.size === 0 && lastError !== null
            ? classify(lastError)
            : new AiTimeoutError(),
        requests,
      };
    const wakeAt = secondTried
      ? left
      : Math.min(left, input.hedgeAfterMs - elapsed());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settled = await Promise.race([
      ...pending.values(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), Math.max(0, wakeAt));
      }),
    ]);
    if (timer !== undefined) clearTimeout(timer);
    if (settled === null) {
      if (!secondTried && elapsed() >= input.hedgeAfterMs) await trySecond();
      continue;
    }
    pending.delete(settled.index);
    if (settled.ok) {
      requests[settled.index] = "answered";
      return { ok: true, result: settled.result, requests };
    }
    requests[settled.index] = "failed";
    lastError = settled.error;
    // Out of allocation: another request would fail the same way.
    if (allocationExceeded(settled.error))
      return { ok: false, error: new AiAllocationExhaustedError(), requests };
    if (!secondTried && isTransientAiError(settled.error)) await trySecond();
  }
}

const classify = (error: unknown) =>
  allocationExceeded(error)
    ? new AiAllocationExhaustedError()
    : error instanceof Error
      ? error
      : new Error(String(error));
