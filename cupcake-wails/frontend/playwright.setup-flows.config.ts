import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/integration',
  testMatch: 'setup-flows.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  timeout: 900000,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup-flows',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results/setup-flows',
});
