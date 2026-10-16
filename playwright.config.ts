import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build served on port 3100 and wired to
 * TEST_DATABASE_URL, so they never touch development data. Emails use the log transport;
 * tests read links from the outbox table, exactly as a user would read them from the email.
 */
const PORT = 3100;
const testDb = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/fr`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: testDb,
      APP_URL: `http://localhost:${PORT}`,
      EMAIL_TRANSPORT: "log",
      ALLOW_LOG_TRANSPORT: "1",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret",
      STORAGE_LOCAL_DIR: ".storage-e2e",
    },
  },
});
