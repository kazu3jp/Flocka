import { test, expect } from "./test";
import { signInFixture } from "./helpers";
import type { Locator, Page } from "@playwright/test";
import { TOUR_SPOTLIGHT_PADDING } from "../../apps/mobile/src/features/guided-tour/tour-geometry";
import { TOUR_STEPS } from "../../apps/mobile/src/features/guided-tour/tour-steps";

const TITLE = /^Flockaの使い方/;
const TOTAL = TOUR_STEPS;
/** How far the cut-out may differ from the target's box plus the ring padding. */
const TOLERANCE = 3;

/** The real element each step is about, found the way a person would. */
const TARGETS: Record<string, (page: Page) => Locator> = {
  "deck-cards": (page) => page.getByTestId("deck-first-row"),
  "deck-quest": (page) => page.getByTestId("deck-challenge"),
  "deck-give": (page) =>
    page.getByTestId("deck-header").getByRole("button", { name: "証言を贈る" }),
  "player-card": (page) => page.getByTestId("player-identity"),
  "exchange-actions": (page) => page.getByTestId("exchange-actions"),
  "pr-heading": (page) => page.getByTestId("pr-heading"),
  "deck-me": (page) =>
    page.getByRole("button", { name: "自分のページ", exact: true }),
};

function tour(page: Page) {
  return {
    dialog: page.getByRole("dialog", { name: TITLE }),
    spotlight: page.getByTestId("tour-spotlight"),
    next: page.getByRole("button", { name: /^(次へ|はじめる)$/ }),
    previous: page.getByRole("button", { name: "前へ", exact: true }),
    skip: page.getByRole("button", { name: "スキップ", exact: true }),
    progress: (index: number) =>
      page.getByTestId("tour-progress").filter({
        hasText: `${index} / ${TOTAL.length}`,
      }),
  };
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

/** The target's box grown by the ring padding and kept on screen, like the cut-out. */
function expectedCutOut(
  target: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
) {
  const x = Math.max(0, target.x - TOUR_SPOTLIGHT_PADDING);
  const y = Math.max(0, target.y - TOUR_SPOTLIGHT_PADDING);
  const right = Math.min(
    viewport.width,
    target.x + target.width + TOUR_SPOTLIGHT_PADDING,
  );
  const bottom = Math.min(
    viewport.height,
    target.y + target.height + TOUR_SPOTLIGHT_PADDING,
  );
  return { x, y, width: right - x, height: bottom - y };
}

async function expectSpotlightOn(page: Page, stepIndex: number) {
  const step = TOUR_STEPS[stepIndex];
  const viewport = page.viewportSize()!;
  const target = TARGETS[step.target](page);
  const t = tour(page);
  await expect(t.progress(stepIndex + 1)).toBeVisible();
  await expect(t.dialog).toContainText(step.title);
  // The cut-out follows the element while it settles, so poll until they agree.
  await expect(async () => {
    const cut = await box(t.spotlight);
    const want = expectedCutOut(await box(target), viewport);
    for (const key of ["x", "y", "width", "height"] as const)
      expect(
        Math.abs(cut[key] - want[key]),
        `${step.key} ${key}`,
      ).toBeLessThanOrEqual(TOLERANCE);
  }).toPass();
  // The popover stays on screen and out of the cut-out's way when there is room.
  const popover = await box(t.dialog);
  expect(popover.x).toBeGreaterThanOrEqual(0);
  expect(popover.y).toBeGreaterThanOrEqual(0);
  expect(popover.x + popover.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(popover.y + popover.height).toBeLessThanOrEqual(viewport.height + 0.5);
}

async function startFirstRun(
  page: Page,
  context: Parameters<typeof signInFixture>[0],
  name: string,
) {
  await signInFixture(context, "empty", name, "unseen");
  await page.goto("/");
  await expect(tour(page).dialog).toBeVisible();
}

test("the first run walks through every step with the cut-out on the real element", async ({
  page,
  context,
}, testInfo) => {
  await startFirstRun(page, context, `tour-walk-${testInfo.project.name}`);
  const t = tour(page);
  for (let index = 0; index < TOTAL.length; index++) {
    await expectSpotlightOn(page, index);
    if (index < TOTAL.length - 1) {
      await expect(t.next).toHaveText(/次へ/);
      await t.next.click();
    }
  }
  await expect(t.next).toHaveText(/はじめる/);
  await expect(t.skip).toHaveCount(0);
  await t.next.click();
  await expect(t.dialog).toHaveCount(0);
  // Finishing puts the person back where the tour began, and it stays gone.
  await expect(page).toHaveURL(/\/deck$/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "自分のページ", exact: true }),
  ).toBeVisible();
  await expect(t.dialog).toHaveCount(0);
});

test("next, previous and skip move between steps and skip ends the tour for good", async ({
  page,
  context,
}, testInfo) => {
  await startFirstRun(page, context, `tour-nav-${testInfo.project.name}`);
  const t = tour(page);
  await expectSpotlightOn(page, 0);
  await expect(t.previous).toHaveCount(0);
  await t.next.click();
  await expectSpotlightOn(page, 1);
  await t.next.click();
  await expectSpotlightOn(page, 2);
  await t.previous.click();
  await expectSpotlightOn(page, 1);
  // The popover is announced as "N枚中M枚目".
  await expect(t.dialog).toHaveAttribute("aria-label", /7枚中2枚目/);
  await t.skip.click();
  await expect(t.dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/deck$/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "自分のページ", exact: true }),
  ).toBeVisible();
  await expect(t.dialog).toHaveCount(0);
});

test("a step in another tab switches to it and the last step returns", async ({
  page,
  context,
}, testInfo) => {
  await startFirstRun(page, context, `tour-tabs-${testInfo.project.name}`);
  const t = tour(page);
  for (let index = 0; index < 3; index++) await t.next.click();
  await expectSpotlightOn(page, 3);
  await expect(page).toHaveURL(/\/exchange$/);
  await t.next.click();
  await t.next.click();
  await expectSpotlightOn(page, 5);
  await expect(page).toHaveURL(/\/pr$/);
  await page.keyboard.press("Escape");
  await expect(t.dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/deck$/);
});

test("the dim area and the highlighted element do not pass presses to the app", async ({
  page,
  context,
}, testInfo) => {
  await startFirstRun(page, context, `tour-block-${testInfo.project.name}`);
  const t = tour(page);
  await t.next.click();
  await t.next.click();
  await t.next.click();
  await t.next.click();
  await t.next.click();
  await t.next.click();
  // The last step highlights the avatar button that opens "自分".
  await expectSpotlightOn(page, 6);
  const avatar = await box(TARGETS["deck-me"](page));
  await page.mouse.click(
    avatar.x + avatar.width / 2,
    avatar.y + avatar.height / 2,
  );
  await expect(page).toHaveURL(/\/deck$/);
  // A tab in the dim area does not switch tabs either.
  const tab = await box(page.getByRole("tab", { name: "自己PR", exact: true }));
  await page.mouse.click(tab.x + tab.width / 2, tab.y + tab.height / 2);
  await expect(page).toHaveURL(/\/deck$/);
  await expectSpotlightOn(page, 6);
  // Keyboard focus stays in the popover.
  await page.keyboard.press("Tab");
  await expect(t.dialog.locator(":focus")).toHaveCount(1);
});

test("the tour adds nothing to the layout of the screen under it", async ({
  page,
  context,
}, testInfo) => {
  await startFirstRun(page, context, `tour-shift-${testInfo.project.name}`);
  const t = tour(page);
  await expect(t.spotlight).toBeVisible();
  const names = ["自分のページ", "デッキ", "交換", "自己PR"];
  const locate = (name: string) =>
    page.getByRole(name === "自分のページ" ? "button" : "tab", {
      name,
      exact: true,
    });
  const during = await Promise.all(names.map((name) => box(locate(name))));
  const content = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await t.skip.click();
  await expect(t.dialog).toHaveCount(0);
  const after = await Promise.all(names.map((name) => box(locate(name))));
  expect(after).toEqual(during);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    content,
  );
});

test("a step whose element is not on screen is skipped, not waited on", async ({
  page,
  context,
}, testInfo) => {
  await startFirstRun(page, context, `tour-missing-${testInfo.project.name}`);
  const t = tour(page);
  await expectSpotlightOn(page, 0);
  // Step 2 points at the envelope banner; take the real element away.
  await page.evaluate(() => {
    document.querySelector('[data-testid="deck-challenge"]')?.remove();
  });
  await t.next.click();
  await expect(t.progress(3)).toBeVisible({ timeout: 8000 });
  await expectSpotlightOn(page, 2);
  // Going back from the step after it also passes over the missing one.
  await t.previous.click();
  await expectSpotlightOn(page, 0);
});

test("the my page replays the tour without changing the seen flag and returns to it", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "empty", `tour-replay-${testInfo.project.name}`);
  await page.goto("/me");
  const t = tour(page);
  await expect(t.dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "使い方をもう一度見る", exact: true })
    .click();
  await expectSpotlightOn(page, 0);
  await t.next.click();
  await expectSpotlightOn(page, 1);
  await t.skip.click();
  await expect(t.dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/me$/);
  expect(
    await page.evaluate(() => localStorage.getItem("flocka-expo-tutorial-v1")),
  ).toBe("1");
  await page.reload();
  await expect(t.dialog).toHaveCount(0);
});

test("the tour waits until registration is finished", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "onboarding",
    `tour-onboarding-${testInfo.project.name}`,
    "unseen",
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(tour(page).dialog).toHaveCount(0);
});

test("a storage read failure never shows the tour", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "empty",
    `tour-storage-${testInfo.project.name}`,
    "unseen",
  );
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "flocka-expo-tutorial-v1") throw new Error("storage");
      return read.call(this, key);
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "自分のページ", exact: true }),
  ).toBeVisible();
  await expect(tour(page).dialog).toHaveCount(0);
});
