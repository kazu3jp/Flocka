import { test, expect } from "./test";
import { capture, signInFixture } from "./helpers";

const TITLE = "Flockaの使い方";
const FIRST_STEP = "会った人と、カードを交換";

test("the tutorial opens on a fresh install, skips, and stays gone after a relaunch", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "empty",
    `tutorial-skip-${testInfo.project.name}`,
    "unseen",
  );
  await page.goto("/");
  const tutorial = page.getByRole("dialog", { name: TITLE });
  await expect(tutorial).toBeVisible();
  await expect(tutorial.getByText(FIRST_STEP)).toBeVisible();
  await expect(tutorial.getByTestId("tutorial-dot")).toHaveCount(4);
  await expect(tutorial.getByTestId("tutorial-dot-current")).toHaveCount(1);
  await capture(page, "tutorial-first-step");
  // It never replaces the home screen the sign-in lands on.
  await expect(page).toHaveURL(/\/deck$/);
  await tutorial.getByRole("button", { name: "スキップ", exact: true }).click();
  await expect(tutorial).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "自分のページ", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
});

test("finishing every step persists and keeps the buttons in place", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "empty",
    `tutorial-done-${testInfo.project.name}`,
    "unseen",
  );
  await page.goto("/");
  const tutorial = page.getByRole("dialog", { name: TITLE });
  const next = tutorial.getByRole("button", { name: "次へ", exact: true });
  await expect(next).toBeVisible();
  const before = await next.boundingBox();
  await next.click();
  await expect(tutorial.getByText("1 / 5")).toHaveCount(0);
  await expect(tutorial.getByText("2 / 5")).toBeVisible();
  const after = await next.boundingBox();
  expect(after?.y).toBe(before?.y);
  await tutorial.getByRole("button", { name: "前へ", exact: true }).click();
  await expect(tutorial.getByText(FIRST_STEP)).toBeVisible();
  for (let step = 0; step < 4; step++) await next.click();
  await expect(tutorial.getByText("5 / 5")).toBeVisible();
  await capture(page, "tutorial-last-step");
  await tutorial.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(tutorial).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "自分のページ", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
});

test("settings replays the tutorial without changing the seen flag", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "empty",
    `tutorial-replay-${testInfo.project.name}`,
  );
  await page.goto("/settings");
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
  await page
    .getByRole("button", { name: "使い方をもう一度見る", exact: true })
    .click();
  const tutorial = page.getByRole("dialog", { name: TITLE });
  await expect(tutorial.getByText(FIRST_STEP)).toBeVisible();
  await tutorial.getByRole("button", { name: "次へ", exact: true }).click();
  await tutorial.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(tutorial).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
});

test("the tutorial waits until registration is finished", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "onboarding",
    `tutorial-onboarding-${testInfo.project.name}`,
    "unseen",
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
});

test("a storage read failure never shows the tutorial", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "empty",
    `tutorial-storage-${testInfo.project.name}`,
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
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
});
