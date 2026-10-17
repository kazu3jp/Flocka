import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("showcase completion waits for durable preferences and retries failed saves", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `showcase-${testInfo.project.name}`,
  );
  // The reference hides the player hand and its edit link in compact heights.
  // Open at the normal height, then exercise saving in the short sheet as well.
  const viewport = page.viewportSize()!;
  if (viewport.height < 844)
    await page.setViewportSize({ ...viewport, height: 844 });
  await page.goto("/exchange");
  await page.getByRole("button", { name: "選ぶ", exact: true }).click();
  if (viewport.height < 844) await page.setViewportSize(viewport);
  const selected = page.locator('button[aria-pressed="true"]');
  await expect(selected).toHaveCount(3);
  const removedLabel = await selected.first().getAttribute("aria-label");
  await selected.first().click();
  await expect(selected).toHaveCount(2);
  await context.setOffline(true);
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "決定", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  let releaseSave = () => {};
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/v1/me/preferences", async (route) => {
    await saveGate;
    await route.continue();
  });
  await page.getByRole("button", { name: "決定", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存中…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("相手に見せる強み（3枚まで）", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(
    page.getByText("相手に見せる強み（3枚まで）", { exact: true }),
  ).toBeVisible();
  releaseSave();
  await expect(
    page.getByText("相手に見せる強み（3枚まで）", { exact: true }),
  ).toHaveCount(0);
  const response = await context.request.get("/v1/sync");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).preferences.data.showcase).toHaveLength(2);
  await page.reload();
  if (viewport.height < 844)
    await page.setViewportSize({ ...viewport, height: 844 });
  await page.getByRole("button", { name: "選ぶ", exact: true }).click();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: removedLabel!, exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
