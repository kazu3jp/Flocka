import { test, expect } from "./test";
import {
  capture,
  compareLayout,
  referenceComparison,
  signInFixture,
} from "./helpers";

test("PR editing, clipboard, failed saves and regeneration use real preferences", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(context, "collected", `pr-${testInfo.project.name}`);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/pr");
  await expect(
    page.getByRole("tab", { name: "自己PR", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const generatedText = page.getByTestId("pr-generated-text");
  await expect(generatedText).toContainText("これから取り組みたいこと");
  await expect(page.getByTestId("pr-caret")).toHaveCount(0);
  const original = (await generatedText.textContent())!;
  const reference = await context.newPage();
  await reference.goto("/reference/?embed=pr");
  await reference.locator(".prdoc-body").click();
  await referenceComparison(page, reference, "self-pr", testInfo);
  await capture(page, "self-pr");

  await page.getByRole("button", { name: "コピー", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("コピーしました");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    original,
  );
  await reference.locator('[data-od-id="pr-copy"]').click();
  await referenceComparison(page, reference, "self-pr-copied", testInfo);
  await capture(page, "self-pr-copied");
  await page.getByTestId("toast").getByRole("button").click();
  await reference.locator(".toast-msg").click();

  await page.getByRole("button", { name: "書き直す", exact: true }).click();
  await reference
    .getByRole("button", { name: "書き直す", exact: true })
    .click();
  const editor = page.getByRole("textbox", {
    name: "自己PRを編集",
    exact: true,
  });
  const draft =
    "私の強みは、状況を整理して共有することです。\n次はチーム開発で活かします。";
  await editor.fill(draft);
  await reference
    .getByRole("textbox", { name: "自己PRを編集", exact: true })
    .fill(draft);
  await referenceComparison(page, reference, "self-pr-edit", testInfo);
  await compareLayout(
    [
      {
        name: "PR editor",
        actual: editor,
        reference: reference.locator(".prdoc textarea"),
      },
    ],
    testInfo,
  );
  await capture(page, "self-pr-edit");

  await context.setOffline(true);
  const edited = draft + "（保存確認）";
  await editor.fill(edited);
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(edited);
  let releaseSave = () => {};
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/v1/me/preferences", async (route) => {
    await saveGate;
    await route.continue();
  });
  await context.setOffline(false);
  await page.getByRole("button", { name: "完了", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存中…", exact: true }),
  ).toBeDisabled();
  await expect(editor).not.toBeEditable();
  releaseSave();
  await expect(editor).toHaveCount(0);
  const saved = await context.request.get("/v1/sync");
  expect((await saved.json()).preferences.data.prDraft).toBe(edited);
  await page.reload();
  await expect(page.getByTestId("pr-body")).toContainText(
    edited.split("\n")[1],
  );
  await reference
    .getByRole("textbox", { name: "自己PRを編集", exact: true })
    .fill(edited);
  await reference.getByRole("button", { name: "完了", exact: true }).click();
  await referenceComparison(page, reference, "self-pr-manual", testInfo);
  await capture(page, "self-pr-manual");
  await page.getByRole("button", { name: "コピー", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("コピーしました");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    edited,
  );
  await page.getByTestId("toast").getByRole("button").click();

  await page
    .getByRole("button", { name: "もう一度書き出す", exact: true })
    .click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByTestId("pr-body")).toContainText(
    edited.split("\n")[1],
  );
  await page
    .getByRole("button", { name: "もう一度書き出す", exact: true })
    .click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "書き出す", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "書き出す", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const reset = await context.request.get("/v1/sync");
  expect((await reset.json()).preferences.data.prDraft).toBeNull();
  await expect(generatedText).toHaveText(original);
  await reference
    .getByRole("button", { name: "もう一度書き出す", exact: true })
    .click();
  await reference.locator(".prdoc-body").click();
  await referenceComparison(page, reference, "self-pr-regenerated", testInfo);
  await capture(page, "self-pr-regenerated");

  // Replaying an already generated document must restart rather than stay blank.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", { name: "もう一度書き出す", exact: true })
    .click();
  await page.getByRole("button", { name: "書き出す", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("pr-caret")).toHaveCount(1);
  const caret = await page.getByTestId("pr-caret").boundingBox();
  expect(caret?.width).toBe(2);
  expect(caret?.height).toBe(16.5);
  await expect(generatedText).toHaveText(original, { timeout: 10_000 });
  await expect(page.getByTestId("pr-caret")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });

  // A rejected strength is not eligible for PR, even when it has two witnesses.
  await page.getByRole("tab", { name: "デッキ", exact: true }).click();
  await page
    .getByRole("button", { name: /人と情報をつなぐ力・確認済み/ })
    .click();
  await page.getByRole("button", { name: "違うかも", exact: true }).click();
  await page.getByRole("tab", { name: "自己PR", exact: true }).click();
  await reference.locator('[data-od-id="tab-find"]').click();
  await reference.locator('[data-od-id="card-bridge"]').click();
  await reference
    .getByRole("button", { name: "違うかも", exact: true })
    .click();
  await reference.locator('[data-od-id="tab-pr"]').click();
  await expect(page.getByTestId("pr-locked")).toBeVisible();
  await referenceComparison(page, reference, "self-pr-locked", testInfo);
  await compareLayout(
    [
      {
        name: "locked PR document",
        actual: page.getByTestId("pr-locked"),
        reference: reference.locator(".prdoc"),
      },
    ],
    testInfo,
  );
  await capture(page, "self-pr-locked");
});

test("browser clipboard policy rejection is reported without a legacy write", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `pr-clipboard-${testInfo.project.name}`,
  );
  await page.addInitScript(() => {
    const state = window as unknown as { legacyClipboardWrites: number };
    state.legacyClipboardWrites = 0;
    const original = document.execCommand.bind(document);
    document.execCommand = (command, showUI, value) => {
      if (command === "copy") state.legacyClipboardWrites += 1;
      return original(command, showUI, value);
    };
  });
  await page.route("**/pr", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "permissions-policy": "clipboard-write=()",
      },
    });
  });
  await page.goto("/pr");
  await page.getByRole("button", { name: "コピー", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("コピーできませんでした");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { legacyClipboardWrites: number })
          .legacyClipboardWrites,
    ),
  ).toBe(0);
  await expect(page.getByText("コピーしました", { exact: true })).toHaveCount(
    0,
  );
});
