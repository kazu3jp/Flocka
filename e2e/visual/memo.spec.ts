import { test, expect } from "./test";
import { capture, signInFixture } from "./helpers";

test("one form gives the first impression, then episodes to the same person", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `memo-design-${testInfo.project.name}`,
  );
  await page.goto("/memo");
  await capture(page, "memo-recipients");
  // Each person says what the next testimony will be.
  const minato = page.getByRole("button", { name: "ミナト", exact: true });
  await expect(page.getByTestId("memo-recipients")).toContainText(
    "第一印象をまだ贈っていません",
  );
  await minato.click();
  await expect(page).toHaveURL(
    new RegExp(`/give\\?cid=${fixture.exchanges![0]}$`),
  );
  await expect(page.getByText("第一印象を贈る", { exact: true })).toBeVisible();
  const send = page.getByRole("button", { name: "封筒で贈る", exact: true });
  const impression = "初対面でも話しかけてくれて、すぐ打ち解けられた";
  await page.getByRole("textbox").fill(impression);
  await expect(send).toBeDisabled();
  await page
    .getByRole("radio", { name: "人と情報をつなぐ力", exact: true })
    .click();
  await send.click();
  await expect(
    page.getByText("ミナトに証言を贈りました", { exact: true }),
  ).toBeVisible();
  // The same form now sends an episode; the impression was the one per person.
  await page
    .getByRole("button", { name: "エピソードも贈る", exact: true })
    .click();
  await expect(
    page.getByText("エピソードを贈る", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "あとで" })).toHaveCount(0);
  const story = "登壇後の質問に、図を描いて答えてくれた";
  await page.getByRole("textbox").fill("短すぎる文");
  await page.getByRole("radio", { name: "実装力", exact: true }).click();
  await expect(send).toBeDisabled();
  await page.getByRole("textbox").fill(story);
  await send.click();
  await expect(
    page.getByText("ミナトに証言を贈りました", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("最新データを取得中…", { exact: true }),
  ).toHaveCount(0);
  await capture(page, "memo-done");
  const stored = await (await context.request.get("/v1/sync")).json();
  const sent = (kind: string) =>
    stored.sent.filter((piece: { kind: string }) => piece.kind === kind);
  expect(sent("vibe")).toHaveLength(1);
  expect(sent("vibe")[0].text).toBe(impression);
  expect(sent("vibe")[0].card).toBe("bridge");
  expect(sent("proof")).toHaveLength(1);
  expect(sent("proof")[0].story).toBe(story);
  expect(sent("proof")[0].card).toBe("impl");
  expect(sent("proof")[0].exchangeId).toBe(fixture.exchanges![0]);
});

test("the recipient list explains when there is nobody to give to", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "empty", `memo-empty-${testInfo.project.name}`);
  await page.goto("/memo");
  await expect(
    page.getByText(
      "まだ交換した人がいません。交換すると、ここから証言を贈れます。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByTestId("memo-recipients")).toHaveCount(0);
  await capture(page, "memo-empty");
});
