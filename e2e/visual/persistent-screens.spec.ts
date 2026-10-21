import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("going back and switching tabs reveal the mounted screens instead of rebuilding them", async ({
  page,
  context,
}) => {
  await signInFixture(context, "collected");
  await page.goto("/deck");
  const deckHeader = await page.getByTestId("deck-header").elementHandle();
  expect(deckHeader).not.toBeNull();

  await page.getByTestId("strength-card-bridge").click();
  await expect(page).toHaveURL(/\/card\?key=bridge$/);
  await expect(
    page.getByRole("button", { name: "このカードをデコる", exact: true }),
  ).toBeVisible();
  // The deck stays mounted out of view while the card is shown.
  expect(await deckHeader!.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  await expect(page.getByTestId("deck-header")).toHaveCount(0);

  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/deck$/);
  // The same deck element returns: going back did not rebuild the screen.
  await expect(page.getByTestId("deck-header")).toBeVisible();
  expect(
    await deckHeader!.evaluate(
      (element) =>
        element.isConnected && element.getBoundingClientRect().height > 0,
    ),
  ).toBe(true);

  // Another tab keeps its own stack while the deck stays mounted.
  await page.getByRole("tab", { name: "交換", exact: true }).click();
  await expect(page).toHaveURL(/\/exchange$/);
  await page.getByRole("tab", { name: "デッキ", exact: true }).click();
  await expect(page).toHaveURL(/\/deck$/);
  expect(await deckHeader!.evaluate((element) => element.isConnected)).toBe(
    true,
  );

  // Moving between screens rewrites the URL without leaving stale params.
  await page.getByTestId("strength-card-bridge").click();
  await expect(page).toHaveURL(/\/card\?key=bridge$/);
  await page.getByRole("tab", { name: "自己PR", exact: true }).click();
  await expect(page).toHaveURL(/\/pr$/);
});
