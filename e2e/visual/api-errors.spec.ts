import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("failed transport and a non-JSON gateway error keep edits and show readable retry feedback", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `api-errors-${testInfo.project.name}`,
  );
  await page.goto("/pr");
  await page.getByRole("button", { name: "書き直す", exact: true }).click();
  await page
    .getByRole("textbox", { name: "自己PRを編集", exact: true })
    .fill("通信の再試行後に保存する本文");
  const route = "**/v1/me/preferences";
  await page.route(route, (intercepted) => intercepted.abort("failed"));
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "APIに接続できません。接続先と通信環境を確認してください",
  );
  await expect(page.getByTestId("pr-editor")).toBeVisible();
  await page.unroute(route);
  await page.route(route, (intercepted) =>
    intercepted.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<html>internal gateway trace</html>",
    }),
  );
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "APIの応答を読み込めませんでした。もう一度お試しください",
  );
  await expect(
    page.getByRole("textbox", { name: "自己PRを編集", exact: true }),
  ).toHaveValue("通信の再試行後に保存する本文");
  await page.unroute(route);
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.getByTestId("pr-editor")).toHaveCount(0);
  const snapshot = await (await context.request.get("/v1/sync")).json();
  expect(snapshot.preferences.data.prDraft).toBe(
    "通信の再試行後に保存する本文",
  );
});
