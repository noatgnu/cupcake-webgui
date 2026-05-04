import { test, expect } from '@playwright/test';
import { setupWailsMock, emitMockEvent, waitForEventListeners, getRegisteredListeners, clearMockListeners } from './wails-mock';

test.describe('Cupcake Vanilla Wails Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupWailsMock(page);
  });

  test.afterEach(async ({ page }) => {
    await clearMockListeners(page);
  });

  test('single service status update', async ({ page }) => {
    await page.goto('/#/splash');
    await page.waitForTimeout(2000);
    await waitForEventListeners(page);

    const listeners = await getRegisteredListeners(page);
    expect(listeners['backend:status']).toBeGreaterThan(0);

    const dbService = page.locator('.service-row', {
      has: page.locator('.service-name', { hasText: 'Database' })
    });
    await expect(dbService).toHaveClass(/pending/);

    await emitMockEvent(page, 'backend:status', {
      service: 'database',
      status: 'ready',
      message: 'Database initialized'
    });

    await expect(dbService).toHaveClass(/ready/, { timeout: 10000 });
  });

  test('splash page loads with pending services', async ({ page }) => {
    await page.goto('/#/splash');
    await page.waitForTimeout(2000);

    await expect(page.locator('.title')).toContainText('Cupcake Vanilla');

    const pendingServices = page.locator('.service-row.pending');
    await expect(pendingServices).toHaveCount(9, { timeout: 10000 });
  });

  test('multiple services update sequentially', async ({ page }) => {
    await page.goto('/#/splash');
    await page.waitForTimeout(2000);
    await waitForEventListeners(page);

    const services = ['database', 'python', 'venv'];

    for (const serviceName of services) {
      await emitMockEvent(page, 'backend:status', {
        service: serviceName,
        status: 'ready',
        message: `${serviceName} ready`
      });
      await page.waitForTimeout(200);
    }

    const readyServices = page.locator('.service-row.ready');
    await expect(readyServices).toHaveCount(3, { timeout: 10000 });
  });

  test('log events appear in activity log', async ({ page }) => {
    await page.goto('/#/splash');
    await page.waitForTimeout(2000);
    await waitForEventListeners(page);

    await emitMockEvent(page, 'backend:log', {
      message: 'Test log message from E2E',
      type: 'info'
    });

    await page.waitForTimeout(500);

    const logPanel = page.locator('.log-viewport');
    await expect(logPanel).toContainText('Test log message from E2E', { timeout: 10000 });
  });

  test('navigation routes work', async ({ page }) => {
    await page.goto('/#/python-selection');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.title:has-text("Python Setup")')).toBeVisible({ timeout: 10000 });

    await page.goto('/#/management');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.title:has-text("System Management")')).toBeVisible({ timeout: 10000 });

    await page.goto('/#/debug');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.title:has-text("Console")')).toBeVisible({ timeout: 10000 });

    await page.goto('/#/backend-download');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.title:has-text("Backend Source")')).toBeVisible({ timeout: 10000 });
  });

  test('full initialization flow', async ({ page }) => {
    await page.goto('/#/splash');
    await page.waitForTimeout(2000);
    await waitForEventListeners(page);

    const initSequence = [
      { service: 'database', displayName: 'Database' },
      { service: 'python', displayName: 'Python' },
      { service: 'venv', displayName: 'Virtual Environment' },
      { service: 'dependencies', displayName: 'Dependencies' },
      { service: 'migrations', displayName: 'Migrations' },
      { service: 'collectstatic', displayName: 'Static Files' },
      { service: 'redis', displayName: 'Redis Server' },
      { service: 'django', displayName: 'Django Server' },
      { service: 'rq', displayName: 'RQ Worker' }
    ];

    for (const step of initSequence) {
      await emitMockEvent(page, 'backend:status', {
        service: step.service,
        status: 'ready',
        message: `${step.displayName} initialized`
      });
      await page.waitForTimeout(150);
    }

    const readyServices = page.locator('.service-row.ready');
    await expect(readyServices).toHaveCount(9, { timeout: 15000 });
  });

  test('WailsService detects mock mode', async ({ page }) => {
    await page.goto('/#/splash');
    await page.waitForTimeout(2000);

    const listeners = await getRegisteredListeners(page);
    expect(listeners['backend:status']).toBeGreaterThan(0);
    expect(listeners['backend:log']).toBeGreaterThan(0);
  });
});
