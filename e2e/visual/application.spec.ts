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
  await reference.locator('[data-od-id="card-deco"]').click();
  await referenceComparison(page, reference, "decoration", testInfo);
  await compareLayout(
    [
      {
        name: "decoration preview",
        actual: page.getByTestId("decoration-preview"),
        reference: reference.locator('[data-od-id="deco-card-preview"]'),
      },
      {
        name: "decoration tabs",
        actual: page.getByTestId("decoration-tabs"),
        reference: reference.locator(".seg"),
      },
      {
        name: "decoration workspace",
        actual: page.getByTestId("decoration-workspace"),
        reference: reference.locator('[data-od-id="deco-workspace"]'),
      },
      {
        name: "first decoration option",
        actual: page.getByRole("button", { name: "集中線", exact: true }),
        reference: reference.locator('[data-od-id="deco-pattern-burst"]'),
      },
    ],
    testInfo,
  );
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
    page.getByRole("tab", { name: "交換", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "近くの人と交換", exact: true }),
  ).toBeVisible();
  await reference.goto("/reference/?embed=exchange");
  await referenceComparison(page, reference, "exchange", testInfo);
  await compareLayout(
    [
      {
        name: "player",
        actual: page.getByTestId("player-card"),
        reference: reference.locator('[data-od-id="my-player-card"]'),
      },
      {
        name: "player identity",
        actual: page.getByTestId("player-identity"),
        reference: reference.locator(".player > .row").first(),
      },
      {
        name: "player footer",
        actual: page.getByTestId("player-footer"),
        reference: reference.locator(".player-foot"),
      },
      {
        name: "exchange actions",
        actual: page.getByTestId("exchange-actions"),
        reference: reference.locator(".ex-actions"),
      },
    ],
    testInfo,
  );
  // The one-line message is deliberately larger than the source's 14px so it stays readable.
  await expect(page.getByTestId("player-role")).toHaveCSS("font-size", "17px");
  const sourceHandVisible = await reference.locator(".player-hand").isVisible();
  await expect(page.getByTestId("player-hand")).toHaveCount(
    sourceHandVisible ? 1 : 0,
  );
  if (sourceHandVisible) {
    await compareLayout(
      [
        {
          name: "player name",
          actual: page.getByTestId("player-name"),
          reference: reference.locator(".player-name"),
        },
        {
          name: "player hand",
          actual: page.getByTestId("player-hand"),
          reference: reference.locator(".player-hand"),
          // The larger one-line message pushes the hand down by the extra line height.
          skip: ["y"],
        },
        {
          name: "middle showcase card",
          actual: page
            .getByTestId("player-hand")
            .getByTestId("strength-card-impl"),
          reference: reference.locator(".player-hand .gcard").nth(1),
          skip: ["y"],
        },
      ],
      testInfo,
    );
  }
  await capture(page, "exchange");
  if (testInfo.project.name === "mobile") {
    const viewport = page.viewportSize()!;
    // At these window heights, the source player's content box is 520/521px.
    for (const [height, visible] of [
      [792, false],
      [793, true],
    ] as const) {
      await page.setViewportSize({ ...viewport, height });
      await reference.setViewportSize({ ...viewport, height });
      if (visible)
        await expect(reference.locator(".player-hand")).toBeVisible();
      else await expect(reference.locator(".player-hand")).not.toBeVisible();
      await expect(page.getByTestId("player-hand")).toHaveCount(
        visible ? 1 : 0,
      );
    }
    await page.setViewportSize(viewport);
    await reference.setViewportSize(viewport);
  }
  await page.getByRole("button", { name: "つながった人", exact: true }).click();
  await capture(page, "connections");
  await page.getByRole("tab", { name: "自己PR", exact: true }).click();
  await expect(page.getByText(/私の強みは/)).toBeVisible();
  await reference.goto("/reference/?embed=pr");
  await reference.locator(".prdoc-body").click();
  await referenceComparison(page, reference, "self-pr", testInfo);
  await compareLayout(
    [
      {
        name: "PR document",
        actual: page.getByTestId("pr-document"),
        reference: reference.locator(".prdoc"),
        // The AI polish action (docs/ai-pr-generation.md) takes a row below the
        // document, so the document is shorter than in the source.
        skip: ["height"],
      },
      {
        name: "PR heading",
        actual: page.getByTestId("pr-heading"),
        reference: reference.locator(".prdoc-head"),
      },
      {
        name: "PR body",
        actual: page.getByTestId("pr-body"),
        reference: reference.locator(".prdoc-body"),
        skip: ["height"],
      },
      {
        name: "PR sources",
        actual: page.getByTestId("pr-sources"),
        reference: reference.locator(".src-chips"),
        skip: ["y"],
      },
      {
        name: "PR actions",
        actual: page.getByTestId("pr-actions"),
        reference: reference.locator(".btn-row"),
      },
    ],
    testInfo,
  );
  await capture(page, "self-pr");
  expect(errors).toEqual([]);
});
