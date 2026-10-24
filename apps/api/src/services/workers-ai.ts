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
