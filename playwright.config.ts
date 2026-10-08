import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  retries: 0,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "pnpm start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
