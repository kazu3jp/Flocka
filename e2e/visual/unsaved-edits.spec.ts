import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("leaving the profile editor with unsaved edits asks before discarding them", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "collected", `unsaved-${testInfo.project.name}`);
  await page.goto("/selfEdit");
  const name = page.getByRole("textbox", { name: /^ニックネーム/ });
  await name.fill("新しい名前");
  // Back asks first; keeping the edits leaves the field as typed.
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.getByText("編集内容を破棄する？")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page).toHaveURL(/\/selfEdit/);
  await expect(name).toHaveValue("新しい名前");
  // A tab tap asks the same way, and discarding follows the tap.
  await page.getByRole("tab", { name: "自己PR", exact: true }).click();
  await expect(page.getByText("編集内容を破棄する？")).toBeVisible();
  await page.getByRole("button", { name: "破棄する", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "自己PR", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("a saved profile whose refresh fails says the save is done", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "collected", `saved-${testInfo.project.name}`);
  await page.goto("/selfEdit");
  await page
    .getByRole("textbox", { name: /^ひとこと/ })
    .fill("チームの段取り役");
  // Only reading back fails; the save itself reaches the real API.
  await page.route("**/v1/sync*", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(
    page.getByText(
      "プロフィールの保存は完了しました。最新データの取得に失敗しました。",
    ),
  ).toBeVisible();
});
