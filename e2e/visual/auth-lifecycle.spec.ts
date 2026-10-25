import { test, expect } from "./test";
import { capture, markTourSeen } from "./helpers";

test("email signup, onboarding, logout and password reset", async ({
  page,
  context,
}, testInfo) => {
  const email = `ui.signup.${testInfo.project.name}@example.test`;
  // The first-launch guided tour has its own spec (guided-tour.spec.ts).
  await markTourSeen(context);
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "アカウントを作成", exact: true })
    .click();
  const consent = page.getByRole("checkbox", {
    name: "利用規約とプライバシーポリシーに同意する",
  });
  await expect(consent).not.toBeChecked();
  await page.getByRole("link", { name: "利用規約", exact: true }).click();
  await expect(
    page.getByText("古川和温", { exact: false }).first(),
  ).toBeVisible();
  await capture(page, "signup-terms");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .first()
    .click();
  await expect(consent).not.toBeChecked();
  await page
    .getByRole("textbox", { name: "メールアドレス", exact: true })
    .fill(email);
  const password = page.getByLabel("パスワード", { exact: true });
  await password.fill("VrtPassword123");
  await expect(password).toHaveJSProperty("type", "password");
  await page
    .getByRole("button", { name: "パスワードを表示", exact: true })
    .click();
  await expect(password).toHaveJSProperty("type", "text");
  await page
    .getByRole("button", { name: "パスワードを隠す", exact: true })
    .click();
  await consent.click();
  await expect(consent).toBeChecked();
  await page.getByRole("button", { name: "メールで登録", exact: true }).click();
  const otpField = page.getByRole("textbox", {
    name: "確認コード（6桁）",
    exact: true,
  });
  await expect(otpField).toBeVisible();
  // The real mail adapter delivers into the isolated test mailbox, never Resend.
  let code = "";
  await expect
    .poll(async () => {
      const response = await context.request.get(
        `/__vrt/mailbox?to=${encodeURIComponent(email)}`,
      );
      expect(response.ok()).toBeTruthy();
      const messages = (await response.json()) as { text: string }[];
      code = messages.at(-1)?.text.match(/\b\d{6}\b/)?.[0] ?? "";
      return code.length;
    })
    .toBe(6);
  await expect(page).toHaveScreenshot("email-verification.png", {
    mask: [page.getByText(/^再送まで\d+秒$/)],
  });
  await otpField.fill(code);
  await page.getByRole("button", { name: "確認して次へ", exact: true }).click();
  await page
    .getByRole("textbox", { name: "ニックネーム · 16文字まで", exact: true })
    .fill("ハルカ");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await capture(page, "onboarding-avatar");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await capture(page, "onboarding-interests");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await capture(page, "onboarding-strengths");
  await page.getByRole("tab", { name: "動かす", exact: true }).click();
  await page.getByRole("button", { name: "実装力", exact: true }).click();
  await page.getByRole("tab", { name: "自分を育てる", exact: true }).click();
  await page.getByRole("button", { name: "集中力", exact: true }).click();
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await capture(page, "onboarding-explanation");
  await page
    .getByRole("button", { name: "内容を確認する", exact: true })
    .click();
  await capture(page, "onboarding-review");
  await page
    .getByRole("button", { name: "この内容ではじめる", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /実装力・自己申告/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /実装力・自己申告/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "自分のページ", exact: true }).click();
  await page
    .getByRole("button", { name: "公開範囲・安全", exact: true })
    .click();
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ログアウト", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "アカウントを作成", exact: true }),
  ).toBeVisible();
  // Reload proves the server-issued cookie was revoked, rather than only hiding the UI.
  await page.reload();
  await page.getByRole("button", { name: /アカウントをお持ちの方は/ }).click();
  await page
    .getByRole("textbox", { name: "メールアドレス", exact: true })
    .fill(email);
  await page
    .getByRole("button", { name: "パスワードを忘れた方", exact: true })
    .click();
  await page.getByRole("button", { name: "リンクを送る", exact: true }).click();
  let resetLink = "";
  await expect
    .poll(async () => {
      const response = await context.request.get(
        `/__vrt/mailbox?to=${encodeURIComponent(email)}`,
      );
      expect(response.ok()).toBeTruthy();
      const messages = (await response.json()) as {
        subject: string;
        text: string;
      }[];
      resetLink =
        messages
          .slice()
          .reverse()
          .find((message) => message.subject.includes("再設定"))
          ?.text.match(/https?:\/\/[^\s]+/)?.[0] ?? "";
      return resetLink;
    })
    .not.toBe("");
  expect(new URL(resetLink).origin).toBe("https://127.0.0.1:9012");
  await page.goto(resetLink);
  await expect(
    page.getByText("新しいパスワードを設定", { exact: true }),
  ).toBeVisible();
  await capture(page, "new-password");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("VrtUpdatedPassword123");
  await page
    .getByRole("button", { name: "パスワードを変更", exact: true })
    .click();
  await expect(
    page.getByText("パスワードを変更しました。", { exact: true }),
  ).toBeVisible();
  await capture(page, "password-reset-complete");
  await page.getByRole("button", { name: "ログインへ", exact: true }).click();
  await page.getByRole("button", { name: /アカウントをお持ちの方は/ }).click();
  await page
    .getByRole("textbox", { name: "メールアドレス", exact: true })
    .fill(email);
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("VrtUpdatedPassword123");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "デッキ", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "デッキ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /実装力・自己申告/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "自分のページ", exact: true }).click();
  await page
    .getByRole("button", { name: "公開範囲・安全", exact: true })
    .click();
  await page
    .getByRole("button", { name: "アカウントを削除", exact: true })
    .click();
  await expect(
    page.getByText("アカウントを削除する", { exact: true }),
  ).toBeVisible();
  await capture(page, "delete-account-request");
  await page
    .getByRole("button", { name: "確認メールを送信", exact: true })
    .click();
  await expect(page.getByText(/確認メールを送信しました/)).toBeVisible();
  let deletionLink = "";
  await expect
    .poll(async () => {
      const response = await context.request.get(
        `/__vrt/mailbox?to=${encodeURIComponent(email)}`,
      );
      const messages = (await response.json()) as {
        subject: string;
        text: string;
      }[];
      deletionLink =
        messages
          .slice()
          .reverse()
          .find((message) => message.subject === "Flocka：アカウント削除の確認")
          ?.text.match(/https?:\/\/[^\s]+/)?.[0] ?? "";
      return deletionLink;
    })
    .not.toBe("");
  await page.goto(deletionLink);
  await expect(
    page.getByText("削除を確定しますか？", { exact: true }),
  ).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "アカウントを完全に削除",
    exact: true,
  });
  await expect(deleteButton).toBeDisabled();
  await capture(page, "delete-account-confirm");
  await page
    .getByRole("button", {
      name: "削除すると元に戻せないことを確認しました",
      exact: true,
    })
    .click();
  await deleteButton.click();
  await expect(
    page.getByText("アカウントを削除しました", { exact: true }),
  ).toBeVisible();
  await capture(page, "delete-account-complete");
  const session = await context.request.get("/api/auth/get-session");
  expect(await session.json()).toBeNull();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter(
        (key) =>
          key.includes("flocka-expo-state-v1:") && !key.endsWith(":signed-out"),
      ),
    ),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "ログイン画面へ", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "アカウントを作成", exact: true }),
  ).toBeVisible();
});

test("external account deletion entry asks for login", async ({ page }) => {
  await page.goto("/delete-account");
  await expect(
    page.getByRole("textbox", { name: "メールアドレス", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "アカウントを完全に削除", exact: true }),
  ).toHaveCount(0);
});
