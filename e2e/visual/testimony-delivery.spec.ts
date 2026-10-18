import { test, expect } from "./test";
import { signInFixture } from "./helpers";

for (const kind of ["vibe", "proof"] as const) {
  test(`${kind} delivery retains failed edits and retries only sync after server acknowledgment`, async ({
    page,
    context,
  }, testInfo) => {
    const fixture = await signInFixture(
      context,
      "collected",
      `delivery-${kind}-${testInfo.project.name}`,
    );
    const text = "発表の準備中、困っている人に声をかけてくれたから";
    let submissions = 0;
    let failDelivery = true;
    let releaseDelivery!: () => void;
    let startedDelivery!: () => void;
    const deliveryStarted = new Promise<void>((resolve) => {
      startedDelivery = resolve;
    });
    const deliveryReleased = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    await page.route("**/v1/testimonies", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      submissions++;
      if (failDelivery)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "UNAVAILABLE", message: "送信を再試行してください" },
          }),
        });
      startedDelivery();
      await deliveryReleased;
      return route.continue();
    });
    if (kind === "vibe") {
      await page.goto(`/give?cid=${fixture.exchanges![0]}`);
      await page
        .getByRole("radio", { name: "話しやすい", exact: true })
        .click();
    } else {
      await page.goto("/memo");
      await page.getByRole("button", { name: "ミナト", exact: true }).click();
      await page.getByRole("button", { name: "次へ", exact: true }).click();
      await page
        .getByRole("button", { name: "人と情報をつなぐ力", exact: true })
        .click();
      await page.getByRole("button", { name: "次へ", exact: true }).click();
    }
    await page.getByRole("textbox").fill(text);
    const submit = page.getByRole("button", {
      name: kind === "vibe" ? "この印象を贈る" : "封筒で贈る",
      exact: true,
    });
    await submit.click();
    await expect(page.getByRole("alert")).toHaveText(
      "送信を再試行してください",
    );
    await expect(page.getByRole("textbox")).toHaveValue(text);
    failDelivery = false;
    await page.route("**/v1/sync?*", (route) => route.abort("failed"));
    await submit.click();
    await deliveryStarted;
    await page.getByRole("textbox").fill("送信を待っている間に書き換えた内容");
    releaseDelivery();
    await expect(page.getByRole("alert")).toContainText(
      "送信は完了しました。最新データの取得に失敗しました。",
    );
    await expect(
      page.getByText(
        kind === "vibe" ? "ミナトに印象を贈りました" : "封筒で贈りました",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByText(`「${text}」`, { exact: true })).toBeVisible();
    expect(submissions).toBe(2);
    await page.unroute("**/v1/sync?*");
    await page
      .getByRole("button", { name: "最新データを再取得", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "最新データを再取得", exact: true }),
    ).toHaveCount(0);
    expect(submissions).toBe(2);
    const snapshot = await (await context.request.get("/v1/sync")).json();
    const sent = snapshot.sent.filter(
      (piece: { kind: string }) => piece.kind === kind,
    );
    expect(sent).toHaveLength(1);
    expect(kind === "vibe" ? sent[0].text : sent[0].story).toBe(text);
    await page.reload();
    if (kind === "vibe")
      await expect(
        page.getByText("ミナトに印象を贈りました", { exact: true }),
      ).toBeVisible();
    expect(submissions).toBe(2);
  });
}
