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
  await context.route(/^https:\/\/(x\.com|kaede\.dev)\//, (route) => {
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
    page.getByRole("button", { name: "Webサイト kaede.dev", exact: true }),
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

test("the profile editor rejects unsafe links and saves several services to the own card", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "empty", `sns-edit-${testInfo.project.name}`);
  await page.goto("/selfEdit");
  const editor = page.getByTestId("sns-links-editor");
  await expect(editor).not.toContainText("自己申告です");
  const zenn = editor.getByRole("textbox", {
    name: "ZennのIDまたはURL",
    exact: true,
  });
  const x = editor.getByRole("textbox", {
    name: "XのIDまたはURL",
    exact: true,
  });
  const github = editor.getByRole("textbox", {
    name: "GitHubのIDまたはURL",
    exact: true,
  });
  await zenn.fill("javascript:alert(1)");
  await x.click();
  await expect(
    editor.getByText("Zennのユーザー名またはURLを確認してください"),
  ).toBeVisible();
  // An invalid field must not be saved or dropped silently.
  await expect(
    page.getByRole("button", { name: "保存", exact: true }),
  ).toBeDisabled();
  await capture(page, "sns-editor-error");
  // A profile URL pasted into another service's field names the right one.
  await zenn.fill("https://x.com/flocka_app");
  await x.click();
  await expect(
    editor.getByText("XのURLです。Xの欄に入力してください"),
  ).toBeVisible();
  await zenn.fill("");
  await x.fill("https://x.com/flocka_app");
  await github.fill("kazu3jp");
  const website = editor.getByRole("textbox", {
    name: "WebサイトのURL",
    exact: true,
  });
  // A profile URL is refused as the website, too.
  await website.fill("https://github.com/kazu3jp");
  await x.click();
  await expect(
    editor.getByText("GitHubのURLです。GitHubの欄に入力してください"),
  ).toBeVisible();
  await website.fill("flocka.dev/about");
  await expect(
    page.getByRole("button", { name: "保存", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByText("プロフィールを保存しました", { exact: true }),
  ).toBeVisible();
  await page.goto("/exchange");
  await expect(
    page.getByRole("button", { name: "X @flocka_app", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "GitHub kazu3jp", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Webサイト flocka.dev/about",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("sns-links")).toContainText("自己申告・未確認");
});
