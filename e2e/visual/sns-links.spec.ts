import { test, expect } from "./test";
import { capture, signInFixture } from "./helpers";

test("an accepted peer's self-declared SNS links open validated https URLs", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `sns-peer-${testInfo.project.name}`,
  );
  const external: string[] = [];
  await context.route(/^https:\/\/(x\.com|www\.instagram\.com)\//, (route) => {
    external.push(route.request().url());
    return route.fulfill({ status: 200, body: "external" });
  });
  await page.goto(`/confirm?cid=${fixture.exchanges![2]}`);
  await expect(page.getByTestId("player-name")).toHaveText("カエデ");
  const links = page.getByTestId("sns-links");
  await expect(links).toContainText("自己申告・未確認");
  const x = page.getByRole("button", { name: "X @kaede_plan", exact: true });
  await expect(x).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Instagram @kaede.trip", exact: true }),
  ).toBeVisible();
  // No other peer declared links, so their cards stay without the block.
  const opened = context.waitForEvent("page");
  await x.click();
  const popup = await opened;
  await popup.waitForLoadState();
  expect(popup.url()).toBe("https://x.com/kaede_plan");
  expect(external).toContain("https://x.com/kaede_plan");
  await capture(page, "sns-peer-card");
});

test("a peer without SNS links shows no SNS block", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `sns-none-${testInfo.project.name}`,
  );
  await page.goto(`/confirm?cid=${fixture.exchanges![0]}`);
  await expect(page.getByTestId("player-name")).toHaveText("ミナト");
  await expect(page.getByTestId("sns-links")).toHaveCount(0);
});

test("the profile editor rejects unsafe links and saves valid ones to the own card", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "empty", `sns-edit-${testInfo.project.name}`);
  await page.goto("/selfEdit");
  const editor = page.getByTestId("sns-links-editor");
  await expect(editor).not.toContainText("自己申告です");
  await editor.getByRole("button", { name: "Instagram", exact: true }).click();
  const input = editor.getByRole("textbox");
  await input.fill("javascript:alert(1)");
  await editor.getByRole("button", { name: "追加", exact: true }).click();
  await expect(
    editor.getByText("Instagramのユーザー名またはURLを確認してください"),
  ).toBeVisible();
  await capture(page, "sns-editor-error");
  await editor.getByRole("button", { name: "X", exact: true }).click();
  await input.fill("https://x.com/flocka_app");
  await editor.getByRole("button", { name: "追加", exact: true }).click();
  await expect(editor).toContainText("X @flocka_app");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByText("プロフィールを保存しました", { exact: true }),
  ).toBeVisible();
  await page.goto("/exchange");
  await expect(
    page.getByRole("button", { name: "X @flocka_app", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("sns-links")).toContainText("自己申告・未確認");
});
