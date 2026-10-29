/** Workers AI bills in Neurons. Rates are Neurons per one million tokens. */
export type NeuronRate = { input: number; output: number };

/** The single table of per-model rates. Update it together with PR_AI_MODEL. */
export const NEURON_RATES: Record<string, NeuronRate> = {
  "@cf/google/gemma-4-26b-a4b-it": { input: 9091, output: 27273 },
  "@cf/qwen/qwen3-30b-a3b-fp8": { input: 4625, output: 30475 },
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { input: 26668, output: 204805 },
  "@cf/zai-org/glm-4.7-flash": { input: 5500, output: 36400 },
  "@cf/cloudflare/clef": { input: 21818, output: 0 },
};
/** A model missing from the table is priced like the most expensive one. */
export const UNKNOWN_MODEL_RATE: NeuronRate =
  NEURON_RATES["@cf/meta/llama-3.3-70b-instruct-fp8-fast"];
export const DEFAULT_PR_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";

export type TokenUsage = { promptTokens: number; completionTokens: number };

export const neuronRateFor = (model: string): NeuronRate =>
  Object.hasOwn(NEURON_RATES, model) ? NEURON_RATES[model] : UNKNOWN_MODEL_RATE;

export function estimateNeurons(model: string, usage: TokenUsage): number {
  const rate = neuronRateFor(model);
  return (
    (usage.promptTokens * rate.input + usage.completionTokens * rate.output) /
    1_000_000
  );
}

/** Japanese text can take about one token per character; assume a bit more. */
export const estimateTokensFromChars = (characters: number) =>
  Math.ceil(characters * 1.2);

/**
 * Upper bound reserved before calling the model: the prompt estimated from its
 * characters plus every completion token the request allows.
 */
export function reserveNeurons(
  model: string,
  promptCharacters: number,
  maxCompletionTokens: number,
): number {
  return Math.ceil(
    estimateNeurons(model, {
      promptTokens: estimateTokensFromChars(promptCharacters),
      completionTokens: maxCompletionTokens,
    }),
  );
}

/**
 * Extra request fields, per model, that were verified against the real API.
 * gemma-4 thinks by default and then spends the whole token budget on
 * reasoning (empty answer); this switches that off. Other models get nothing,
 * because their parameters have not been verified.
 */
export const MODEL_REQUEST_EXTRAS: Record<string, Record<string, unknown>> = {
  "@cf/google/gemma-4-26b-a4b-it": {
    chat_template_kwargs: { enable_thinking: false },
  },
};
export const requestExtrasFor = (model: string): Record<string, unknown> =>
  Object.hasOwn(MODEL_REQUEST_EXTRAS, model) ? MODEL_REQUEST_EXTRAS[model] : {};
