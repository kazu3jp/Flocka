import { test, expect } from "./test";
import { signInFixture } from "./helpers";

// The system prompt itself can only be seen on a device. This covers the web
// flow with a mocked browser answer: the scan tab asks only after a tap, and
// a refusal is explained instead of leaving a blank camera.
test("a refused camera is explained with a way to ask again", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const denied = () =>
      Promise.reject(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: denied, enumerateDevices: async () => [] },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: async () => ({ state: "prompt" }) },
    });
  });
  await signInFixture(context, "empty", "scan-camera-denied");
  await page.goto("/scan");
  await page
    .getByRole("button", { name: "相手のQRを読み取る", exact: true })
    .click();
  await expect(
    page.getByText(/相手の交換用QRを読み取るためにカメラを使います/),
  ).toBeVisible();
  await page.getByRole("button", { name: "カメラを許可する" }).click();
  await expect(
    page.getByText(/カメラが許可されていないため|カメラの許可が拒否/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /もう一度許可を求める|設定を開く/ }),
  ).toBeVisible();
});
