import { test, expect } from "./test";
import {
  capture,
  compareLayout,
  referenceComparison,
  signInFixture,
} from "./helpers";

test("showcase completion waits for durable preferences and retries failed saves", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
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
  const reference = await context.newPage();
  if (viewport.height < 844)
    await reference.setViewportSize({ ...viewport, height: 844 });
  await reference.goto("/reference/?embed=exchange");
  await reference.locator('[data-od-id="showcase-edit"]').click();
  if (viewport.height < 844) await page.setViewportSize(viewport);
  await reference.setViewportSize(viewport);
  await referenceComparison(page, reference, "showcase-selection", testInfo);
  await compareLayout(
    [
      {
        name: "showcase sheet",
        actual: page.getByTestId("sheet"),
        reference: reference.locator(".sheet"),
      },
      {
        name: "showcase heading",
        actual: page.getByTestId("sheet-heading"),
        reference: reference.locator(".sheet > .row"),
      },
      {
        name: "showcase grid",
        actual: page.getByTestId("showcase-grid"),
        reference: reference.locator(".pick-grid"),
      },
      {
        name: "first showcase choice",
        actual: page.getByTestId("showcase-choice-bridge"),
        reference: reference.locator(".pick-cell").first(),
      },
    ],
    testInfo,
  );
  await capture(page, "showcase-selection");
  const selected = page.locator('button[aria-pressed="true"]');
  await expect(selected).toHaveCount(3);
  const removedLabel = await selected.first().getAttribute("aria-label");
  await selected.first().click();
  await expect(selected).toHaveCount(2);
  await page.getByRole("button", { name: removedLabel!, exact: true }).click();
  await expect(page.getByTestId("showcase-order-impl")).toHaveText("1");
  await expect(page.getByTestId("showcase-order-focus")).toHaveText("2");
  await expect(page.getByTestId("showcase-order-bridge")).toHaveText("3");
  await reference.locator(".pick-cell").first().click();
  await reference.locator(".pick-cell").first().click();
  await referenceComparison(page, reference, "showcase-reordered", testInfo);
  await capture(page, "showcase-reordered");
  await page.getByRole("button", { name: removedLabel!, exact: true }).click();
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
  expect((await response.json()).preferences.data.showcase).toEqual([
    "impl",
    "focus",
  ]);
  await page.reload();
  if (viewport.height < 844)
    await page.setViewportSize({ ...viewport, height: 844 });
  await page.getByRole("button", { name: "選ぶ", exact: true }).click();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: removedLabel!, exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  // Walk the original reference's receive flow to show the same fourth card.
  await reference.getByRole("button", { name: "閉じる", exact: true }).click();
  await reference.setViewportSize({
    ...viewport,
    height: Math.max(viewport.height, 844),
  });
  await reference.locator('[data-od-id="tab-find"]').click();
  await reference.locator('[data-od-id="quest-open"]').click();
  await reference
    .getByRole("button", { name: "予想せずに開ける", exact: true })
    .click();
  await reference.locator('[data-od-id="guess-commit"]').click();
  await reference.locator('[data-od-id="tab-exchange"]').click();
  await reference.locator('[data-od-id="showcase-edit"]').click();
  // Acquire a fourth real card to exercise the three-card cap.
  const opened = await context.request.patch(
    `/v1/testimonies/${fixture.unopenedId}`,
    { data: { opened: true, guess: "skip" } },
  );
  expect(opened.ok()).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "選ぶ", exact: true }).click();
  await page.getByTestId("showcase-choice-bridge").click();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(3);
  await page.setViewportSize(viewport);
  await reference.setViewportSize(viewport);
  await reference.locator('.pick-cell:has([data-od-id="card-warm"])').click();
  await page.getByTestId("showcase-choice-warm").click();
  await expect(page.getByTestId("showcase-choice-warm")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(3);
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("3枚まで選べます");
  await compareLayout(
    [
      {
        name: "showcase limit toast",
        actual: page.getByTestId("toast"),
        reference: reference.locator('[data-od-id="toast"]'),
      },
    ],
    testInfo,
  );
  await referenceComparison(page, reference, "showcase-limit", testInfo);
  await capture(page, "showcase-limit");
  await page
    .getByTestId("toast")
    .getByRole("button", { name: "3枚まで選べます", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/exchange$/);
});
