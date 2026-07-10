import { defineConfig, devices } from "@playwright/test";


export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "../backend/.venv/bin/python -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/api/health/live",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
});
