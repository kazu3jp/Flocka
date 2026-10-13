import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/visual",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 120,
      threshold: 0.1,
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate:
    "{testDir}/baselines/{platform}/{projectName}/{arg}{ext}",
  use: {
    baseURL: "https://127.0.0.1:9012",
    browserName: "chromium",
    // Test-generated certificate only. The application keeps HTTPS validation.
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 1,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    reducedMotion: "reduce",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "narrow", use: { viewport: { width: 320, height: 740 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 1000 } } },
  ],
  webServer: {
    command: "npx tsx tools/vrt/serve.mts",
    url: "https://127.0.0.1:9012/__vrt/ready",
    reuseExistingServer: false,
    ignoreHTTPSErrors: true,
    timeout: 30_000,
  },
});
