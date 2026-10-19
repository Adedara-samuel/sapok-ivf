import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Records the narrated product walkthrough video (`pnpm demo:video`).
 * The finished video is copied to demo-video/overcare-walkthrough.webm.
 */
export default defineConfig({
  testDir: "./tests/walkthrough",
  timeout: 20 * 60_000,
  retries: 0,
  reporter: "line",
  outputDir: "demo-video/raw",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    video: { mode: "on", size: { width: 1440, height: 900 } },
    launchOptions: { slowMo: 90 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
