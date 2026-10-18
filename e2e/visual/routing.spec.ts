import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("requested card URL survives initial loading and a failed snapshot retry", async ({
  page,
  context,
}) => {
  await signInFixture(context, "collected");
  await page.goto("/card?key=bridge");
  const decorationButton = page.getByRole("button", {
    name: "このカードをデコる",
    exact: true,
  });
  await expect(decorationButton).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/card");
  // Fail transport only. Never replace the actual API with a successful fixture response.
  const snapshotRoute = "**/v1/sync*";
  await page.route(snapshotRoute, (route) => route.abort("failed"));
  await page.reload();
  const retry = page.getByRole("button", {
    name: "もう一度読み込む",
    exact: true,
  });
  await expect(retry).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/card");
  expect(new URL(page.url()).searchParams.get("key")).toBe("bridge");
  await page.unroute(snapshotRoute);
  await retry.click();
  await expect(decorationButton).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/card");
});

test("direct routes reconcile selected tabs and nested back navigation", async ({
  page,
  context,
}) => {
  await signInFixture(context, "collected");
  await page.goto("/pr");
  await expect(
    page.getByRole("tab", { name: "自己PR", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/exchange");
  await expect(
    page.getByRole("tab", { name: "交換", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "つながった人", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/exchange$/);
  await page.goto("/card?key=bridge");
  await page
    .getByRole("button", { name: "このカードをデコる", exact: true })
    .click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/card\?key=bridge$/);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/deck$/);
});
