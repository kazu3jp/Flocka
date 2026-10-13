import type { Context } from "hono";
import type { z } from "zod";

export type ApiContext = {
  Bindings: Env;
  Variables: { accountId: string; requestId: string };
};
export class ApiError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function readBody(
  request: Request,
  limit: number,
): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(
          413,
          "PAYLOAD_TOO_LARGE",
          "送信するデータが大きすぎます",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function readJson<T>(
  c: Context<ApiContext>,
  schema: z.ZodType<T>,
  limit = 64 * 1024,
): Promise<T> {
  if (!c.req.header("Content-Type")?.startsWith("application/json"))
    throw new ApiError(
      415,
      "JSON_REQUIRED",
      "application/jsonで送信してください",
    );
  const bytes = await readBody(c.req.raw, limit);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "JSONを読み込めませんでした");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      422,
      "INVALID_INPUT",
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" / "),
    );
  return parsed.data;
}
