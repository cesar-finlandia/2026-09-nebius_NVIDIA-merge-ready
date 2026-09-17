// SPDX-License-Identifier: Apache-2.0
// DP-E2E-BROWSER-TESTING W2. NOTE: testDir/outputDir resolve relative to THIS
// file, so "." / "artifacts" keep the suite and its evidence under e2e/.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  use: {
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "artifacts",
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120000,
});
