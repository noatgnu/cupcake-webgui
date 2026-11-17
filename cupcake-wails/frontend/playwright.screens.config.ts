import { defineConfig, devices } from '@playwright/test';

const SCREENS_PORT = 4211;

export default defineConfig({
  testDir: './e2e/screens',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60000,
  outputDir: 'test-results/screens',
  use: {
    baseURL: `http://localhost:${SCREENS_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `ng serve --port ${SCREENS_PORT}`,
    url: `http://localhost:${SCREENS_PORT}`,
    reuseExistingServer: false,
    timeout: 180000,
  },
});
