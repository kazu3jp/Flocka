import { test, expect } from "./test";
import {
  capture,
  compareLayout,
  referenceComparison,
  signInFixture,
} from "./helpers";

test("the testimony form follows the original design and sends the first impression", async ({
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
  await expect(page.getByText("ソラに贈る証言", { exact: true })).toBeVisible();
  await capture(page, "give-empty");
  await referenceComparison(page, reference, "give-empty", testInfo);
  await compareLayout(
    [
      {
        name: "exchange context",
        actual: page.getByTestId("give-exchange-context"),
        reference: reference.locator('[data-od-id="give-exchange-context"]'),
      },
      {
        name: "first step",
        actual: page.getByTestId("give-instructions"),
        reference: reference.locator('[data-od-id="give-instructions"]'),
      },
      {
        name: "reason field",
        actual: page.getByTestId("give-reason"),
        reference: reference.locator('[data-od-id="give-reason"]'),
      },
      {
        name: "strength choices",
        actual: page.getByTestId("give-options"),
        reference: reference.locator('[data-od-id="give-options"]'),
      },
    ],
    testInfo,
  );
  const send = page.getByRole("button", { name: "封筒で贈る", exact: true });
  const reason = "初対面でも話しかけてくれて、一緒に発表の準備ができた";
  await page.getByRole("textbox").fill(reason);
  await reference.locator("textarea").fill(reason);
  // An AI answer that names no card is reported; no card is picked for the person.
  await page
    .getByRole("button", { name: "書いた文章からAIが選ぶ", exact: true })
    .click();
  await expect(
    page.getByText(/AIがカードを決められませんでした/),
  ).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(send).toBeDisabled();
  // The recipient's own picks come first.
  await page.getByRole("radio", { name: "実装力", exact: true }).click();
  await reference.getByRole("radio", { name: "実装力" }).click();
  await capture(page, "give-selected");
  await referenceComparison(page, reference, "give-selected", testInfo);
  await send.click();
  await reference
    .getByRole("button", { name: "封筒で贈る", exact: true })
    .click();
  await expect(
    page.getByText("ソラに証言を贈りました", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("最新データを取得中…", { exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("toast").getByRole("button").click();
  await reference.locator(".toast-msg").click();
  await capture(page, "give-done");
  await referenceComparison(page, reference, "give-done", testInfo);
  const stored = await (await context.request.get("/v1/sync")).json();
  const vibe = stored.sent.find(
    (piece: { kind: string }) => piece.kind === "vibe",
  );
  expect(vibe.card).toBe("impl");
  expect(vibe.text).toBe(reason);
  // The first impression is sent once; the form now offers an episode.
  await page.reload();
  await expect(
    page.getByText("エピソードを贈る", { exact: true }),
  ).toBeVisible();
});

test("the exchange memo is edited in place, without leaving the form", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `give-memo-${testInfo.project.name}`,
  );
  const url = `/give?cid=${fixture.exchanges![1]}`;
  await page.goto(url);
  await page.getByRole("textbox").fill("書きかけの証言をそのまま残す");
  await page
    .getByRole("button", { name: "出会いのメモを編集", exact: true })
    .click();
  const sheet = page.getByTestId("sheet");
  await sheet
    .getByRole("textbox", { name: "場所・イベント名（必須）" })
    .fill("学内ハッカソン");
  await sheet.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${url.replace("?", "\\?")}$`));
  await expect(page.getByTestId("give-exchange-context")).toContainText(
    "学内ハッカソン",
  );
  await expect(
    page.getByTestId("give-reason").getByRole("textbox"),
  ).toHaveValue("書きかけの証言をそのまま残す");
});
