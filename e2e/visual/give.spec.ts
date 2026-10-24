import { test, expect } from "./test";
import {
  capture,
  compareLayout,
  referenceComparison,
  signInFixture,
} from "./helpers";

test("impression forms and delivered content follow the original design", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `give-design-${testInfo.project.name}`,
  );
  await page.goto(`/give?cid=${fixture.exchanges![1]}`);
  const reference = await context.newPage();
  await reference.goto("/reference/?embed=give");
  await expect(page.getByText("ソラに贈る印象", { exact: true })).toBeVisible();
  await capture(page, "give-pick");
  await referenceComparison(page, reference, "give-pick", testInfo);
  await compareLayout(
    [
      {
        name: "instructions",
        actual: page.getByTestId("give-instructions"),
        reference: reference.locator('[data-od-id="give-instructions"]'),
      },
      {
        name: "exchange context",
        actual: page.getByTestId("give-exchange-context"),
        reference: reference.locator('[data-od-id="give-exchange-context"]'),
      },
      {
        name: "vibe options",
        actual: page.getByTestId("give-options"),
        reference: reference.locator(".vgrid"),
      },
      {
        name: "reason",
        actual: page.getByRole("textbox"),
        reference: reference.locator("textarea"),
      },
    ],
    testInfo,
  );
  await compareLayout(
    [
      {
        name: "reason field",
        actual: page.getByTestId("give-reason"),
        reference: reference.locator('[data-od-id="give-reason"]'),
      },
    ],
    testInfo,
  );
  await page.getByRole("radio", { name: "話しやすい", exact: true }).click();
  await reference
    .getByRole("radio", { name: "話しやすい", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "話しやすい", exact: true }),
  ).toBeChecked();
  const reason = "初対面でも話しかけてくれて、一緒に発表の準備ができた";
  await page.getByRole("textbox").fill(reason);
  await reference.locator("textarea").fill(reason);
  await capture(page, "give-selected");
  await referenceComparison(page, reference, "give-selected", testInfo);
  await page.getByRole("tab", { name: "自由に書く", exact: true }).click();
  await reference
    .getByRole("button", { name: "自由に書く", exact: true })
    .click();
  await compareLayout(
    [
      {
        name: "free reason",
        actual: page.getByTestId("give-reason"),
        reference: reference.locator(".field"),
        // The source removes "出会いのメモを編集" once something is typed,
        // pulling the options up. Native keeps it (section 10 of the screen spec).
        skip: ["y"],
      },
      {
        name: "summary button",
        actual: page.getByRole("button", { name: "要約する", exact: true }),
        reference: reference.getByRole("button", {
          name: "要約する",
          exact: true,
        }),
        skip: ["y"],
      },
    ],
    testInfo,
  );
  await capture(page, "give-free");
  await referenceComparison(page, reference, "give-free", testInfo);
  await page.getByRole("button", { name: "要約する", exact: true }).click();
  await reference
    .getByRole("button", { name: "要約する", exact: true })
    .click();
  await capture(page, "give-summary");
  await referenceComparison(page, reference, "give-summary", testInfo);
  await page
    .getByRole("button", { name: "この印象を贈る", exact: true })
    .click();
  await reference
    .getByRole("button", { name: "この印象を贈る", exact: true })
    .click();
  await expect(
    page.getByText("ソラに印象を贈りました", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("最新データを取得中…", { exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("toast").getByRole("button").click();
  await reference.locator(".toast-msg").click();
  await capture(page, "give-done");
  await referenceComparison(page, reference, "give-done", testInfo);
  await page.reload();
  await expect(page.getByText(`「${reason}」`, { exact: true })).toBeVisible();
});
