import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list", { printSteps: true }]],
  timeout: 240_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 20_000,
    navigationTimeout: 180_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
