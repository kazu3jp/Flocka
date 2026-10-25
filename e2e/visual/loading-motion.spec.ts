import { test, expect } from "./test";
import { ready, signInFixture } from "./helpers";

const spinnerTransform = (page: import("@playwright/test").Page) =>
  page
    .getByTestId("spinner")
    .locator("div")
    .first()
    .evaluate((element) => getComputedStyle(element).transform);

async function holdSnapshot(page: import("@playwright/test").Page) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/v1/sync**", async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}

test("the loading screen shows a turning spinner while the deck loads", async ({
  page,
  context,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signInFixture(context, "collected", `loading-${testInfo.project.name}`);
  const release = await holdSnapshot(page);
  await page.goto("/deck");
  await expect(page.getByText("デッキを読み込み中…")).toBeVisible();
  await expect(page.getByTestId("spinner")).toBeVisible();
  const first = await spinnerTransform(page);
  await expect
    .poll(() => spinnerTransform(page), { timeout: 2000 })
    .not.toBe(first);
  release();
  await ready(page);
  await expect(page.getByTestId("spinner")).toHaveCount(0);
});

test("reduced motion keeps the loading spinner still", async ({
  page,
  context,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInFixture(
    context,
    "collected",
    `loading-reduced-${testInfo.project.name}`,
  );
  const release = await holdSnapshot(page);
  await page.goto("/deck");
  await expect(page.getByTestId("spinner")).toBeVisible();
  const first = await spinnerTransform(page);
  await page.waitForTimeout(500);
  expect(await spinnerTransform(page)).toBe(first);
  release();
  await ready(page);
});

test("a pushed screen slides in from the right and settles", async ({
  page,
  context,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-10-18T00:00:00Z") });
  await signInFixture(context, "collected", `push-${testInfo.project.name}`);
  await page.goto("/deck");
  await ready(page);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1000));
  await page.getByRole("tab", { name: "交換", exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole("button", { name: "つながった人" }).click();
  const screen = page.getByTestId("screen-entrance");
  await expect(screen).toHaveCSS("opacity", "0");
  const startX = await screen.evaluate(
    (element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41,
  );
  expect(startX).toBeGreaterThan(10);
  await page.clock.runFor(400);
  await expect(screen).toHaveCSS("opacity", "1");
  await expect(screen).toHaveCSS("transform", "none");
});
