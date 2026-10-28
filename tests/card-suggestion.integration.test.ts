import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClientError } from "@flocka/api-client";
import { CARD_SUGGESTION_DAILY_CALLS_PER_ACCOUNT } from "@flocka/domain";
import { createAuthRuntime } from "./helpers/auth-runtime";

const answer = (content: string) => ({
  result: {
    choices: [{ message: { role: "assistant", content } }],
    usage: { prompt_tokens: 400, completion_tokens: 3 },
  },
});
const failsWith = (promise: Promise<unknown>, status: number, code: string) =>
  assert.rejects(
    promise,
    (error) =>
      error instanceof ApiClientError &&
      error.status === status &&
      error.code === code,
  );
const today = () => new Date().toISOString().slice(0, 10);

test("a card is suggested from the giver's text, quoted as data, and counted on its own", async () => {
  const f = await createAuthRuntime();
  try {
    const giver = await f.register("贈り手");
    f.ai.script = () => answer("bridge");
    const text = "発表の前に、みんなの意見を整理してまとめてくれた";
    assert.deepEqual(await giver.api.suggestTestimonyCard(text), {
      card: "bridge",
    });
    const sent = f.ai.calls[0].inputs as {
      messages: { role: string; content: string }[];
      temperature: number;
    };
    assert.equal(sent.temperature, 0);
    assert.equal(sent.messages[1].content, `<text>${text}</text>`);
    // Card suggestions leave the self-PR count untouched.
    const counts = await f.db
      .prepare(
        "SELECT calls, card_calls FROM ai_usage_accounts WHERE day = ? AND account_id = ?",
      )
      .bind(today(), giver.player.id)
      .first<{ calls: number; card_calls: number }>();
    assert.deepEqual(counts, { calls: 0, card_calls: 1 });
  } finally {
    await f.runtime.dispose();
  }
});

test("an answer naming no single card is an error, never a guess", async () => {
  const f = await createAuthRuntime();
  try {
    const giver = await f.register("贈り手");
    for (const content of ["わかりません", "bridge か warm です"]) {
      f.ai.script = () => answer(content);
      await failsWith(
        giver.api.suggestTestimonyCard("初対面でもたくさん話しかけてくれた"),
        502,
        "AI_OUTPUT_REJECTED",
      );
    }
  } finally {
    await f.runtime.dispose();
  }
});

test("the daily suggestion limit is per account and leaves the call unmade", async () => {
  const f = await createAuthRuntime();
  try {
    const giver = await f.register("贈り手");
    await f.db
      .prepare(
        "INSERT INTO ai_usage_accounts(day, account_id, card_calls) VALUES(?, ?, ?)",
      )
      .bind(today(), giver.player.id, CARD_SUGGESTION_DAILY_CALLS_PER_ACCOUNT)
      .run();
    await failsWith(
      giver.api.suggestTestimonyCard("最後まで粘り強く作り切ってくれた"),
      429,
      "AI_LIMIT_REACHED",
    );
    assert.equal(f.ai.calls.length, 0);
    // Too short a text is refused before any model call.
    await failsWith(
      giver.api.suggestTestimonyCard("短い"),
      422,
      "INVALID_INPUT",
    );
  } finally {
    await f.runtime.dispose();
  }
});
