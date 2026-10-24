import { DECO } from "@flocka/domain";
import { test, expect } from "./test";
import {
  capture,
  referenceComparison,
  signInFixture,
  compareLayout,
} from "./helpers";

test("decoration tabs, sticker limits, failed saves and durable preferences", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `decoration-${testInfo.project.name}`,
  );
  await page.goto("/deco?key=bridge");
  const reference = await context.newPage();
  await reference.goto("/reference/?embed=card");
  await reference.locator('[data-od-id="card-deco"]').click();
  for (const [tab, label] of [
    ["frame", "フレーム"],
    ["color", "色"],
    ["stickers", "シール"],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await reference.locator(`[data-od-id="deco-tab-${tab}"]`).click();
    if (tab === "frame")
      await expect(
        page.getByRole("button", { name: "なし", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    await referenceComparison(page, reference, `decoration-${tab}`, testInfo);
    await capture(page, `decoration-${tab}`);
    await compareLayout(
      [
        {
          name: `${tab} options`,
          actual: page.getByTestId("decoration-options"),
          reference: reference.locator('[data-od-id="deco-options"]'),
        },
      ],
      testInfo,
    );
  }
  for (const [key, label] of DECO.stickers.slice(0, 4)) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await reference.locator(`[data-od-id="deco-stickers-${key}"]`).click();
  }
  await referenceComparison(
    page,
    reference,
    "decoration-four-stickers",
    testInfo,
  );
  await capture(page, "decoration-four-stickers");
  await page.getByRole("button", { name: "音符", exact: true }).click();
  await expect(
    page.getByText("シールは4枚まで。貼っているシールを外すと追加できます", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "音符", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "ハート", exact: true }).click();
  await page.getByRole("button", { name: "音符", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "音符", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "色", exact: true }).click();
  await page.getByRole("button", { name: "ピンク", exact: true }).click();
  await page.getByRole("button", { name: "模様", exact: true }).click();
  await page.getByRole("button", { name: "水玉", exact: true }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "完了", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("デコを保存しました", { exact: true }),
  ).toHaveCount(0);
  await context.setOffline(false);
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "デッキ", exact: true }),
  ).toBeVisible();
  const response = await context.request.get("/v1/sync");
  expect(response.ok()).toBeTruthy();
  const snapshot = await response.json();
  expect(snapshot.preferences.data.deco.bridge).toMatchObject({
    pattern: "dots",
    color: "rose",
    stickers: ["star", "bolt", "flower", "note"],
    layout: { note: { position: "bl", size: 23, angle: 12 } },
  });
  await page.reload();
  await page.goto("/deco?key=bridge");
  await expect(
    page.getByRole("button", { name: "水玉", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "色", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ピンク", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // 元に戻す returns to the design this visit started from, after confirmation.
  await page.getByRole("button", { name: "元の色", exact: true }).click();
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await page
    .getByTestId("sheet")
    .getByRole("button", { name: "元に戻す", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "ピンク", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "完了", exact: true }).click();
  const reset = await context.request.get("/v1/sync");
  expect((await reset.json()).preferences.data.deco.bridge).toMatchObject({
    pattern: "dots",
    color: "rose",
  });
  // A real save that completes late must not pop a different screen's history.
  await page.goto("/deco?key=bridge");
  let releaseSave = () => {};
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/v1/me/preferences", async (route) => {
    await saveGate;
    await route.continue();
  });
  // The card was just restored to dots; pick another pattern so a save starts.
  await page.getByRole("button", { name: "ストライプ", exact: true }).click();
  const savedResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/v1/me/preferences" &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "完了", exact: true }).click();
  try {
    await expect(
      page.getByRole("button", { name: "保存中…", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "交換", exact: true }).click();
    await page
      .getByRole("button", { name: "つながった人", exact: true })
      .click();
    await expect(page).toHaveURL(/\/connections$/);
  } finally {
    releaseSave();
  }
  expect((await savedResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/connections$/);
});
