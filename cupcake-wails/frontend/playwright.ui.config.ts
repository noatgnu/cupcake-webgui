import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/ui',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report-ui', open: 'never' }], ['list']],
  timeout: 120000,
  outputDir: 'test-results/ui',
  projects: [
    { name: 'portable-setup', testMatch: /first-run\.spec\.ts/ },
    { name: 'native-setup', testMatch: /native-setup\.spec\.ts/ },
    { name: 'workflows', testMatch: /job-workflows\.spec\.ts/, dependencies: ['portable-setup'] },
  ],
});
