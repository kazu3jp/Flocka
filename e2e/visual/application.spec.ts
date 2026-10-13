import { test, expect } from "@playwright/test";
import { capture, signInFixture } from "./helpers";

test("first profile registration", async ({ page, context }) => {
  await signInFixture(context, "onboarding");
  await page.goto("/");
  await expect(
    page.getByRole("textbox", {
      name: "ニックネーム · 16文字まで",
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, "onboarding-name");
});

test("empty deck", async ({ page, context }) => {
  await signInFixture(context, "empty");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /実装力・自己申告/ }),
  ).toBeVisible();
  await capture(page, "empty-deck");
});

test("real collected cards, profile, settings and exchange", async ({
  page,
  context,
}) => {
  await signInFixture(context, "collected");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /人と情報をつなぐ力・確認済み/ }),
  ).toBeVisible();
  await capture(page, "collected-deck");
  await page
    .getByRole("button", { name: /人と情報をつなぐ力・確認済み/ })
    .click();
  await expect(
    page.getByText("このカードをデコる", { exact: true }),
  ).toBeVisible();
  await capture(page, "confirmed-card");
  await page
    .getByRole("button", { name: "このカードをデコる", exact: true })
    .click();
  await capture(page, "decoration");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "自分のページ", exact: true }).click();
  await expect(
    page.getByText("ハッカソンでよく実装担当", { exact: true }),
  ).toBeVisible();
  await capture(page, "profile");
  await page
    .getByRole("button", { name: "公開範囲・安全", exact: true })
    .click();
  await capture(page, "settings");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("tab", { name: "交換", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "近くの人と交換", exact: true }),
  ).toBeVisible();
  await capture(page, "exchange");
  await page.getByRole("button", { name: "つながった人", exact: true }).click();
  await capture(page, "connections");
  await page.getByRole("tab", { name: "自己PR", exact: true }).click();
  await expect(page.getByText(/私の強みは/)).toBeVisible();
  await capture(page, "self-pr");
  expect(errors).toEqual([]);
});
