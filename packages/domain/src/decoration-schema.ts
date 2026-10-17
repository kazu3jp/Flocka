import { z } from "zod";
import { DECO, DECO_COLORS } from "./catalog";
import type { DecoData } from "./types";

function catalogKey(keys: readonly string[]) {
  const allowed = new Set(keys);
  return z
    .string()
    .max(40)
    .refine((key) => allowed.has(key), "装飾の種類が見つかりません");
}
const stickerKey = catalogKey(DECO.stickers.map(([key]) => key));

/** Snapshots and live preferences must reference the same shipped assets. */
export const decorationSchema: z.ZodType<DecoData> = z.object({
  pattern: catalogKey(DECO.pattern.map(([key]) => key)),
  frame: catalogKey(DECO.frame.map(([key]) => key)),
  color: catalogKey(DECO_COLORS.map(([key]) => key)),
  stickers: z
    .array(stickerKey)
    .max(4)
    .refine(
      (keys) => new Set(keys).size === keys.length,
      "同じシールは1枚までです",
    ),
  layout: z
    .record(
      stickerKey,
      z.object({
        position: z.enum(["br", "bl", "tr", "tl"]),
        size: z.number().min(5).max(80),
        angle: z.number().min(-360).max(360),
      }),
    )
    .optional(),
});
