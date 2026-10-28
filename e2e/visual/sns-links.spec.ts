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

test("pasting a profile URL adds that service, and a bare name asks which service", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "empty", `sns-edit-${testInfo.project.name}`);
  await page.goto("/me");
  await page
    .getByRole("button", { name: "SNS・Webサイト", exact: true })
    .click();
  const editor = page.getByTestId("sns-links-editor");
  const field = editor.getByRole("textbox", {
    name: "プロフィールのURLまたはユーザー名",
    exact: true,
  });
  const add = editor.getByRole("button", { name: "追加する", exact: true });
  // Unusable text is never added, and says why once the field is left.
  await field.fill("javascript:alert(1)");
  await field.blur();
  await expect(editor.getByText(/このURLは追加できません/)).toBeVisible();
  await expect(add).toBeDisabled();
  await capture(page, "sns-editor-error");
  // A profile URL names its service and is saved as it is added.
  await field.fill("https://x.com/flocka_app");
  await expect(editor.getByTestId("sns-entry-preview")).toContainText(
    "@flocka_app",
  );
  await add.click();
  await expect(field).toHaveValue("");
  await expect(
    editor.getByRole("button", { name: "Xを削除", exact: true }),
  ).toBeVisible();
  // A bare name fits several services, so the person picks one.
  await field.fill("kazu3jp");
  await expect(add).toBeDisabled();
  await editor.getByRole("button", { name: "GitHub", exact: true }).click();
  await add.click();
  await expect(
    editor.getByRole("button", { name: "GitHubを削除", exact: true }),
  ).toBeVisible();
  await field.fill("flocka.dev/about");
  await add.click();
  await expect(
    editor.getByRole("button", { name: "Webサイトを削除", exact: true }),
  ).toBeVisible();
  await capture(page, "sns-editor");
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
