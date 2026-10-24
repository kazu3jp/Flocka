import { test, expect } from "./test";
import { ready, signInFixture } from "./helpers";

// The suite runs with reduced motion (playwright.config.ts), so these tests
// state which preference they exercise.
test("reduced motion shows the final state immediately", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInFixture(context, "collected");
  await page.goto("/deck");
  await ready(page);
  const card = page.getByTestId("strength-card-bridge");
  await expect(card).toBeVisible();
  await page.getByRole("tab", { name: "交換", exact: true }).click();
  const screen = page.getByTestId("screen-entrance");
  // No frame is waited for: the revealed screen is already at rest.
  await expect(screen).toHaveCSS("opacity", "1", { timeout: 250 });
  await expect(screen).toHaveCSS("transform", "none", { timeout: 250 });
  await expect(page.getByTestId("toast")).toHaveCount(0);
});

test("a revealed screen fades in, rises and settles when motion is allowed", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-10-18T00:00:00Z") });
  await signInFixture(context, "collected");
  await page.goto("/deck");
  await ready(page);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1000));
  // Let the first screen's own entrance finish before switching tabs.
  await expect
    .poll(async () => {
      await page.clock.runFor(100);
      return page
        .getByTestId("screen-entrance")
        .evaluate((element) => getComputedStyle(element).opacity);
    })
    .toBe("1");

  await page.getByRole("tab", { name: "交換", exact: true }).click();
  const screen = page.getByTestId("screen-entrance");
  // The revealed screen starts hidden and 10pt low, before any time passes.
  await expect(screen).toHaveCSS("opacity", "0");
  const start = await screen.evaluate(
    (element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
  );
  expect(start).toBeGreaterThan(8);

  await page.clock.runFor(90);
  const midOpacity = Number(
    await screen.evaluate((element) => getComputedStyle(element).opacity),
  );
  expect(midOpacity).toBeGreaterThan(0.05);
  expect(midOpacity).toBeLessThan(0.99);

  // 180ms in total; the animated style is dropped once it has settled.
  await page.clock.runFor(300);
  await expect(screen).toHaveCSS("opacity", "1");
  await expect(screen).toHaveCSS("transform", "none");
});

test("hidden screens do not animate while kept mounted", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signInFixture(context, "collected");
  await page.goto("/deck");
  await ready(page);
  await page.getByRole("tab", { name: "自己PR", exact: true }).click();
  await expect(page.getByTestId("screen-entrance")).toHaveCount(1);
  // Only the shown screen is rendered; the kept ones sit inside display:none.
  const kept = await page
    .locator('[data-testid="hidden-screen"] [data-testid="screen-entrance"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.checkVisibility()),
    );
  expect(kept.length).toBeGreaterThan(0);
  for (const rendered of kept) expect(rendered).toBe(false);
});
