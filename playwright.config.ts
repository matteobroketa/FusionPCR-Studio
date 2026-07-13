import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PAGES_BASE_URL || 'http://127.0.0.1:4173';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['line']] : 'line',
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
        port: 4173,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: 'chromium-functional',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /app\.spec\.ts/,
    },
    {
      name: 'chromium-smoke',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /(smoke|deployed-smoke)\.spec\.ts/,
    },
    {
      name: 'firefox-smoke',
      use: {
        ...devices['Desktop Firefox'],
      },
      testMatch: /(smoke|deployed-smoke)\.spec\.ts/,
    },
    {
      name: 'webkit-smoke',
      use: {
        ...devices['Desktop Safari'],
      },
      testMatch: /(smoke|deployed-smoke)\.spec\.ts/,
    },
    {
      name: 'chromium-visual',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /visual\.spec\.ts/,
    },
  ],
});
