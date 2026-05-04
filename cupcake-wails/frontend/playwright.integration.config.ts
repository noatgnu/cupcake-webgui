import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/integration',
  testMatch: 'full-ui-flow.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'test-results/integration-report' }], ['list']],
  timeout: 600000,
  expect: {
    timeout: 60000,
  },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: false,
  },
  projects: [
    {
      name: 'integration',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results/integration',
});
