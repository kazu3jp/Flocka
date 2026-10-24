import type { TokenUsage } from "./ai-neurons";

export type WorkersAiResult = {
  text: string;
  /** Null when the response carried no token counts. */
  usage: TokenUsage | null;
  /** Cloudflare's own cost for the call, when the response reports it. */
  neurons: number | null;
  finishReason: string | null;
  /** True when the response exposed reasoning separately from the answer. */
  reasoningFields: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      isRecord(part) &&
      part.type !== "reasoning" &&
      typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("");
}

/**
 * Reads both the OpenAI-style `choices[0].message.content` shape and the legacy
 * `response` string. Reasoning fields are never part of the returned text.
 */
export function parseWorkersAiResult(result: unknown): WorkersAiResult {
  const body = isRecord(result) ? result : {};
  const choice =
    Array.isArray(body.choices) && isRecord(body.choices[0])
      ? body.choices[0]
      : null;
  const message = choice && isRecord(choice.message) ? choice.message : null;
  const text = message
    ? contentText(message.content)
    : typeof body.response === "string"
      ? body.response
      : "";
  const usageBody = isRecord(body.usage) ? body.usage : null;
  const promptTokens = count(usageBody?.prompt_tokens),
    completionTokens = count(usageBody?.completion_tokens);
  return {
    text,
    usage:
      promptTokens !== null && completionTokens !== null
        ? { promptTokens, completionTokens }
        : null,
    neurons: count(usageBody?.neurons),
    finishReason:
      choice && typeof choice.finish_reason === "string"
        ? choice.finish_reason
        : null,
    reasoningFields: Boolean(
      message && (message.reasoning_content || message.reasoning),
    ),
  };
}
