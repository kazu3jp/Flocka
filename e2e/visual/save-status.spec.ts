import { test, expect } from "./test";
import { signInFixture } from "./helpers";

const SAVED = "サーバーに保存されています";
const FAILED = "サーバーに保存できていません。自動で再試行します";

test("a failed save shows its state, retries by itself and ends saved", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `save-status-${testInfo.project.name}`,
  );
  await page.goto("/pr");
  const route = "**/v1/me/preferences";
  await page.route(route, (intercepted) => intercepted.abort("failed"));
  await page.getByRole("button", { name: "書き直す", exact: true }).click();
  await page
    .getByRole("textbox", { name: "自己PRを編集", exact: true })
    .fill("通信が戻ると自動で保存される本文");
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  // Leave the editor without a reload: the edit stays unsaved in the app.
  await page.getByRole("tab", { name: "デッキ", exact: true }).click();
  await page.getByRole("button", { name: "自分のページ", exact: true }).click();
  const status = page.getByTestId("save-status");
  await expect(status).toContainText(FAILED);
  await expect(
    page.getByRole("button", { name: "今すぐ再試行" }),
  ).toBeVisible();
  await expect(page.getByText("バックアップ")).toHaveCount(0);
  const failedBox = await status.boundingBox();
  // The short autosave delay has passed and failed too, so only the timer is left.
  await page.waitForTimeout(1_500);
  await expect(status).toContainText(FAILED);

  await page.unroute(route);
  // No tap: the retry timer sends the edit and the row returns to the saved text.
  await expect(status).toContainText(SAVED, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "今すぐ再試行" })).toHaveCount(
    0,
  );
  const savedBox = await status.boundingBox();
  expect(savedBox?.height, "the row keeps its height").toBe(failedBox?.height);
  const snapshot = await (await context.request.get("/v1/sync")).json();
  expect(snapshot.preferences.data.prDraft).toBe(
    "通信が戻ると自動で保存される本文",
  );
});
