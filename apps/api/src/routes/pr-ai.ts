import { Hono } from "hono";
import { prAiRequestSchema } from "@flocka/domain";
import { readJson, type ApiContext } from "../http";
import { generatePRAiDraft } from "../services/pr-ai-generation";
import { aiRunnerFor } from "../services/workers-ai";

export const prAiRoutes = new Hono<ApiContext>();
prAiRoutes.post("/me/pr-draft/ai", async (c) => {
  // Only the card key is read. Testimony text comes from D1, not from the client.
  const { card } = await readJson(c, prAiRequestSchema, 1024);
  return c.json(
    await generatePRAiDraft({
      env: c.env,
      accountId: c.get("accountId"),
      card,
      run: aiRunnerFor(c.env),
    }),
  );
});
