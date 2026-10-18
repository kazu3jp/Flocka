import { test, expect } from "./test";
import {
  capture,
  compareLayout,
  referenceComparison,
  signInFixture,
} from "./helpers";

test("scene memo follows the original recipient, strength, story and completion steps", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `memo-design-${testInfo.project.name}`,
  );
  await page.goto("/connections");
  await page
    .getByRole("button", { name: "見た場面をメモで贈る", exact: true })
    .click();
  const reference = await context.newPage();
  await reference.goto("/reference/?embed=exchange");
  await reference.locator('[data-od-id="exchange-give-entry"]').click();
  await reference.locator('[data-od-id="to-memo"]').click();
  const snapshot = async (name: string) => {
    await capture(page, name);
    await referenceComparison(page, reference, name, testInfo);
  };
  const next = page.getByRole("button", { name: "次へ", exact: true });
  await expect(next).toBeDisabled();
  await snapshot("memo-recipients");
  await compareLayout(
    [
      {
        name: "progress",
        actual: page.getByTestId("memo-progress"),
        reference: reference.locator(".header .chip"),
      },
      {
        name: "heading",
        actual: page.getByTestId("memo-heading"),
        reference: reference.locator(".h1"),
      },
      {
        name: "recipient list",
        actual: page.getByTestId("memo-recipients"),
        reference: reference.getByRole("radiogroup", {
          name: "相手",
          exact: true,
        }),
      },
    ],
    testInfo,
  );
  await page.getByRole("radio", { name: "ミナト", exact: true }).click();
  await reference.getByRole("radio", { name: /ミナト/ }).click();
  await expect(
    page.getByRole("radio", { name: "ミナト", exact: true }),
  ).toBeChecked();
  await snapshot("memo-recipient-selected");
  await next.click();
  await reference.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(next).toBeDisabled();
  await snapshot("memo-strengths");
  await compareLayout(
    [
      {
        name: "strength choices",
        actual: page.getByTestId("memo-strengths"),
        reference: reference.getByRole("radiogroup", {
          name: "強み",
          exact: true,
        }),
      },
    ],
    testInfo,
  );
  await page
    .getByRole("radio", { name: "人と情報をつなぐ力", exact: true })
    .click();
  await reference
    .getByRole("radio", { name: "人と情報をつなぐ力", exact: true })
    .click();
  await snapshot("memo-strength-selected");
  await next.click();
  await reference.getByRole("button", { name: "次へ", exact: true }).click();
  await snapshot("memo-story");
  await compareLayout(
    [
      {
        name: "story textarea",
        actual: page.getByRole("textbox", { name: "場面", exact: true }),
        reference: reference.locator("textarea"),
      },
    ],
    testInfo,
  );
  const submit = page.getByRole("button", { name: "封筒で贈る", exact: true });
  await page.getByRole("textbox").fill("短すぎる文");
  await expect(submit).toBeDisabled();
  const story = "登壇後の質問に、図を描いて答えてくれた";
  await page.getByRole("textbox").fill(story);
  await reference.locator("textarea").fill(story);
  await snapshot("memo-story-filled");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "人と情報をつなぐ力", exact: true }),
  ).toBeChecked();
  await next.click();
  await expect(page.getByRole("textbox")).toHaveValue(story);
  await submit.click();
  await reference
    .getByRole("button", { name: "封筒で贈る", exact: true })
    .click();
  await expect(
    page.getByText("封筒で贈りました", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("最新データを取得中…", { exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("toast").getByRole("button").click();
  await reference.locator(".toast-msg").click();
  await snapshot("memo-done");
  const stored = await (await context.request.get("/v1/sync")).json();
  const sent = stored.sent.filter(
    (piece: { kind: string }) => piece.kind === "proof",
  );
  expect(sent).toHaveLength(1);
  expect(sent[0].story).toBe(story);
  expect(sent[0].card).toBe("bridge");
  expect(sent[0].exchangeId).toBe(fixture.exchanges![0]);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.getByText("つながった人", { exact: true })).toBeVisible();
});

test("scene memo cannot advance without an accepted recipient", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "empty", `memo-empty-${testInfo.project.name}`);
  await page.goto("/memo");
  await expect(
    page.getByText(
      "まだ交換した人がいません。交換すると、ここから場面のメモを贈れます。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "次へ", exact: true }),
  ).toBeDisabled();
  await capture(page, "memo-empty");
});
