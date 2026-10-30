import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("AI PR preview is optional and its origin survives editing and reload", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "collected", `pr-ai-${testInfo.project.name}`);
  await page.goto("/pr");
  const body = page.getByTestId("pr-body");
  await expect(body).toContainText("これから取り組みたいこと");
  const original = await body.textContent();
  const generate = page.getByRole("button", {
    name: "AIで文章を整える",
    exact: true,
  });
  await generate.click();
  await expect(page.getByTestId("pr-ai-text")).toBeVisible();
  const draft = (await page.getByTestId("pr-ai-text").textContent())!;
  expect(draft).not.toMatch(/[「」『』]/);
  expect(draft).not.toContain("人と情報をつなぐ力");
  await expect(page.getByTestId("pr-ai-source")).toHaveText(
    "仲間2人の言葉から作成",
  );
  const preferences = async () =>
    (await (await context.request.get("/v1/sync")).json()).preferences.data;
  expect((await preferences()).prDraft).toBeNull();
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(body).toHaveText(original!);

  await generate.click();
  await expect(page.getByTestId("pr-ai-text")).toHaveText(draft);
  await page
    .getByRole("button", { name: "この下書きを使う", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(body).toHaveText(draft);
  const saved = await preferences();
  expect(saved.prDraft).toBe(draft);
  expect(saved.prDraftSource.pieceIds).toHaveLength(2);
  expect(saved.prDraftOrigin.kind).toBe("ai");

  await page.getByRole("button", { name: "書き直す", exact: true }).click();
  const edited = draft + "次の活動でも活かします。";
  await page.getByTestId("pr-editor").fill(edited);
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.getByTestId("pr-editor")).toHaveCount(0);
  await page.reload();
  await expect(body).toHaveText(edited);
  await expect(page.getByTestId("pr-note")).toContainText("AIが仲間の言葉");
  expect((await preferences()).prDraftOrigin).toEqual(saved.prDraftOrigin);

  await page
    .getByRole("button", { name: "もう一度書き出す", exact: true })
    .click();
  await page.getByRole("button", { name: "書き出す", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(body).toHaveText(original!);
  const reset = await preferences();
  expect(reset.prDraft).toBeNull();
  expect(reset.prDraftOrigin).toBeUndefined();
});

test("failed AI generation and adoption preserve the previous PR", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `pr-ai-fail-${testInfo.project.name}`,
  );
  await page.goto("/pr");
  const body = page.getByTestId("pr-body");
  await expect(body).toContainText("これから取り組みたいこと");
  const original = await body.textContent();
  const generate = page.getByRole("button", {
    name: "AIで文章を整える",
    exact: true,
  });
  const generationRoute = "**/v1/me/pr-draft/ai";
  await page.route(generationRoute, (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "AI_UNAVAILABLE", message: "AIに接続できませんでした" },
      }),
    }),
  );
  await generate.click();
  await expect(page.getByRole("alert")).toHaveText("AIに接続できませんでした");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(body).toHaveText(original!);
  await page.unroute(generationRoute);

  await generate.click();
  await expect(page.getByTestId("pr-ai-text")).toBeVisible();
  await page.route("**/v1/me/preferences", (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "この下書きを使う", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(body).toHaveText(original!);
  const saved = (await (await context.request.get("/v1/sync")).json())
    .preferences.data;
  expect(saved.prDraft).toBeNull();
  expect(saved.prDraftOrigin).toBeUndefined();
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await page.reload();
  await expect(body).toHaveText(original!);
});
