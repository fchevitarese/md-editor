import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test/e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
