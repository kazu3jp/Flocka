import { test, expect } from "./test";
import {
  capture,
  compareLayout,
  referenceComparison,
  signInFixture,
} from "./helpers";

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
}, testInfo) => {
  await signInFixture(context, "collected");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /人と情報をつなぐ力・確認済み/ }),
  ).toBeVisible();
  await capture(page, "collected-deck");
  const reference = await context.newPage();
  await reference.goto("/reference/?embed=deck");
  await referenceComparison(page, reference, "collected-deck", testInfo);
  await compareLayout(
    [
      {
        name: "deck header",
        actual: page.getByTestId("deck-header"),
        reference: reference.locator(".hud"),
      },
      {
        name: "challenge banner",
        actual: page.getByTestId("deck-challenge"),
        reference: reference.locator(".quest"),
      },
      {
        name: "PR banner",
        actual: page.getByTestId("deck-pr"),
        reference: reference.locator(".prbar"),
      },
      {
        name: "confirmed deck card",
        actual: page.getByTestId("strength-card-bridge"),
        reference: reference.locator('[data-od-id="card-bridge"]'),
      },
      {
        name: "last deck card",
        actual: page.getByLabel("未発見のカード", { exact: true }).last(),
        reference: reference.locator(".gcard.locked").last(),
      },
    ],
    testInfo,
  );
  await page
    .getByRole("button", { name: /人と情報をつなぐ力・確認済み/ })
    .click();
  await expect(
    page.getByText("このカードをデコる", { exact: true }),
  ).toBeVisible();
  await capture(page, "confirmed-card");
  await reference.goto("/reference/?embed=card");
  await referenceComparison(page, reference, "confirmed-card", testInfo);
  const actualCard = await page
    .getByTestId("strength-card-bridge")
    .boundingBox();
  const sourceCard = await reference
    .locator('[data-od-id="card-bridge"]')
    .boundingBox();
  expect(actualCard).not.toBeNull();
  expect(sourceCard).not.toBeNull();
  // This fidelity gate stays tied to the source even when baselines are updated.
  expect(Math.abs(actualCard!.width - sourceCard!.width)).toBeLessThanOrEqual(
    1,
  );
  expect(Math.abs(actualCard!.height - sourceCard!.height)).toBeLessThanOrEqual(
    1,
  );
  await page
    .getByRole("button", { name: "このカードをデコる", exact: true })
    .click();
  await capture(page, "decoration");
  await reference.locator('[data-od-id="card-deco"]').click();
  await referenceComparison(page, reference, "decoration", testInfo);
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
    page.getByRole("tab", { name: "交換", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "近くの人と交換", exact: true }),
  ).toBeVisible();
  await capture(page, "exchange");
  await reference.goto("/reference/?embed=exchange");
  await referenceComparison(page, reference, "exchange", testInfo);
  await page.getByRole("button", { name: "つながった人", exact: true }).click();
  await capture(page, "connections");
  await page.getByRole("tab", { name: "自己PR", exact: true }).click();
  await expect(page.getByText(/私の強みは/)).toBeVisible();
  await capture(page, "self-pr");
  await reference.goto("/reference/?embed=pr");
  await reference.locator(".prdoc-body").click();
  await referenceComparison(page, reference, "self-pr", testInfo);
  expect(errors).toEqual([]);
});
