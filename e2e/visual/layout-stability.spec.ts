import { test, expect } from "./test";
import { signInFixture } from "./helpers";
import type { Locator } from "@playwright/test";

/**
 * Typing into a field or pressing a button must not move the controls the
 * user is working with. Each test records boxes before an interaction and
 * checks that they are where they were afterwards (0.5px tolerance).
 */
async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, "element is on screen").not.toBeNull();
  return found!;
}

/**
 * `anchor` names a target whose position stands in for the scroll offset:
 * the others are compared by their distance from it, so a page that scrolled
 * to keep a pressed button in view does not count as a shift.
 */
async function expectSameBoxes(
  before: Record<string, Awaited<ReturnType<typeof box>>>,
  targets: Record<string, Locator>,
  when: string,
  anchor?: string,
) {
  const anchorShift = anchor
    ? (await box(targets[anchor])).y - before[anchor].y
    : 0;
  for (const [name, locator] of Object.entries(targets)) {
    const after = await box(locator);
    for (const key of ["x", "y", "width", "height"] as const)
      expect(
        Math.abs(
          after[key] - before[name][key] - (key === "y" ? anchorShift : 0),
        ),
        `${name} ${key} ${when}`,
      ).toBeLessThanOrEqual(0.5);
  }
}

async function measureAll(targets: Record<string, Locator>) {
  const result: Record<string, Awaited<ReturnType<typeof box>>> = {};
  for (const [name, locator] of Object.entries(targets))
    result[name] = await box(locator);
  return result;
}

test("login: an invalid email shows its message only after leaving the field and moves nothing", async ({
  page,
}) => {
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "アカウントをお持ちの方はログイン" })
    .click();
  const email = page.getByRole("textbox", { name: "メールアドレス" });
  const siblings = {
    password: page.getByRole("textbox", { name: "パスワード" }),
    show: page.getByRole("button", { name: "パスワードを表示" }),
    forgot: page.getByRole("button", { name: "パスワードを忘れた方" }),
    submit: page.getByRole("button", { name: "ログイン", exact: true }),
  };
  const before = await measureAll(siblings);
  await email.pressSequentially("g");
  // Still typing: no message yet.
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expectSameBoxes(before, siblings, "while typing");
  await siblings.password.click();
  await expect(page.getByRole("alert")).toHaveText(
    "メールアドレスの形式を確認してください",
  );
  await expectSameBoxes(before, siblings, "with the message shown");
  await email.fill("haru@example.com");
  await expect(page.getByRole("alert")).toHaveCount(0, { timeout: 3000 });
  await expectSameBoxes(before, siblings, "after the message is gone");
});

test("signup: the email message and the password hint keep the form still", async ({
  page,
}) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "アカウントを作成" }).click();
  const siblings = {
    password: page.getByRole("textbox", { name: "パスワード" }),
    agree: page.getByRole("checkbox"),
    submit: page.getByRole("button", { name: "メールで登録" }),
  };
  const before = await measureAll(siblings);
  await page
    .getByRole("textbox", { name: "メールアドレス" })
    .pressSequentially("not-an-email");
  await siblings.password.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await siblings.password.pressSequentially("abc");
  await page.getByRole("button", { name: "パスワードを表示" }).click();
  await siblings.agree.click();
  await expectSameBoxes(before, siblings, "after the form is filled");
});

test("settings save: loading and a failed request change no size or position", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `stability-${testInfo.project.name}`,
  );
  await page.goto("/settings");
  await page.getByRole("switch", { name: "印象を受け取る" }).click();
  const targets = {
    save: page.getByRole("button", { name: "設定を保存", exact: true }),
    blocked: page.getByText("ブロックと報告", { exact: true }),
    sync: page.getByRole("button", { name: "サーバーと同期" }),
  };
  const before = await measureAll(targets);
  const route = "**/v1/me/settings";
  await page.route(route, async (intercepted) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await intercepted.abort("failed");
  });
  await targets.save.click();
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  // While the request runs the button shows its spinner in place.
  await expect(targets.save).toHaveAttribute("aria-busy", "true");
  await expectSameBoxes(before, targets, "while saving", "sync");
  await expect(page.getByRole("alert")).toBeVisible();
  await expectSameBoxes(before, targets, "with the error shown", "sync");
});

test("give: choosing an option moves no other option", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `stability-${testInfo.project.name}`,
  );
  await page.goto(`/give?cid=${fixture.exchanges![1]}`);
  const targets = {
    tabs: page.getByRole("tab", { name: "言葉を選ぶ" }),
    first: page.getByRole("radio", { name: "話しやすい", exact: true }),
    last: page.getByRole("radio", { name: "落ち着いて話せる", exact: true }),
    reason: page.getByRole("textbox", { name: /なぜそう感じましたか/ }),
  };
  const before = await measureAll(targets);
  await targets.last.click();
  await expectSameBoxes(
    { ...before, first: before.first, last: before.last },
    // The chosen option lifts 4pt by design; compare the others.
    { tabs: targets.tabs, first: targets.first, reason: targets.reason },
    "after choosing",
  );
});

test("card: reacting to a card keeps the rest of the page in place", async ({
  page,
  context,
}, testInfo) => {
  await signInFixture(
    context,
    "collected",
    `stability-${testInfo.project.name}`,
  );
  await page.goto("/card?key=bridge");
  const targets = {
    agree: page.getByRole("button", { name: "納得", exact: true }),
    testimonies: page.getByText(/^証言（\d+件）$/),
  };
  const before = await measureAll(targets);
  await page.getByRole("button", { name: "違うかも", exact: true }).click();
  await expectSameBoxes(before, targets, "after choosing 違うかも");
  await page.getByRole("button", { name: "納得", exact: true }).click();
  await expectSameBoxes(before, targets, "after choosing 納得");
});
