import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

import { fakeLauncher, LauncherCall, LauncherError } from '../helpers/launcher-calls';
import { screenshot } from '../helpers/screenshots';
import { emitMockEvent, setupWailsMock, waitForEventListeners } from '../wails-mock';

const APP_NAME: string = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'wails.json'), 'utf8')).name;
const LINEUP = `${APP_NAME}-launcher`;

const RELEASES = [
  { tag: '0.0.25', name: 'Cupcake Vanilla 0.0.25', publishedAt: '2026-11-10T09:00:00Z', hasPortable: true },
  { tag: '0.0.24', name: 'Cupcake Vanilla 0.0.24', publishedAt: '2026-10-28T09:00:00Z', hasPortable: true },
  { tag: 'master', name: 'Latest (master branch)', publishedAt: '', hasPortable: false },
];

const PYTHONS = [
  { command: 'python3.12', version: '3.12.7', path: '/usr/bin/python3.12', managed: false },
  { command: 'uv python 3.12', version: '3.12.8', path: '/home/lab/.local/share/uv/python/cpython-3.12.8/bin/python3', managed: true },
];

const ONTOLOGY_COUNTS = {
  mondo: 25913, uberon: 15634, ncbi: 2652, chebi: 61289, psims: 6372, cell: 3121, species: 15134,
  unimod: 1500, tissue: 662, msVocab: 892, humanDisease: 17543, subcellularLoc: 584, total: 151296,
};

const ANSWERS = {
  GetAppVersion: '0.0.25',
  GetBackendPort: 8000,
  IsBackendReady: true,
  GetAvailableReleases: RELEASES,
  DetectPythonCandidates: PYTHONS,
  VerifyPython: { valid: true, version: '3.12.7', message: 'Python 3.12.7 can run the backend' },
  GetDistributionInfo: { distributionType: 'portable', backendSource: 'release', pythonPath: '', venvPath: '', isPortable: true, backendExists: true },
  ListUsers: ['bench-owner'],
  GetSignInSettings: { mode: 'login', username: '', sessionDays: 30 },
  GetSchemaCount: 34,
  GetColumnTemplateCount: 412,
  GetOntologyCounts: ONTOLOGY_COUNTS,
  ListBackups: [],
};

async function openWindow(page: Page, path: string, size: { width: number; height: number }, answers: Record<string, unknown> = {}): Promise<LauncherCall[]> {
  await page.setViewportSize(size);
  await setupWailsMock(page);
  const calls = await fakeLauncher(page, { ...ANSWERS, ...answers });
  await page.goto(`/#/${path}`);
  await waitForEventListeners(page);
  return calls;
}

function called(calls: LauncherCall[], method: string): LauncherCall[] {
  return calls.filter(call => call.method === method);
}

test.describe('Launcher windows', () => {
  test('starting Cupcake: the splash window follows each service', async ({ page }) => {
    await openWindow(page, 'splash', { width: 600, height: 500 });
    const row = (name: string) => page.locator('.service-row', { has: page.locator('.service-name', { hasText: name }) });
    await expect(row('Database')).toHaveClass(/pending/);

    for (const [service, message] of [
      ['database', 'Database initialized'],
      ['python', 'Using Python: bundled 3.12'],
      ['venv', 'Using portable virtual environment'],
      ['dependencies', 'Dependencies pre-installed'],
    ]) {
      await emitMockEvent(page, 'backend:status', { service, status: 'ready', message });
    }
    await emitMockEvent(page, 'backend:status', { service: 'migrations', status: 'starting', message: 'Running Django migrations...' });
    await emitMockEvent(page, 'backend:log', { message: 'Applying ccv.0042_vocabulary_terms... OK', type: 'info' });
    await expect(row('Database')).toHaveClass(/ready/);
    await expect(row('Migrations')).toContainText('Running Django migrations');
    await screenshot(page, LINEUP, 'start-01-splash', 'Cupcake starting its services, one by one');

    for (const [service, message] of [
      ['migrations', 'Migrations completed'],
      ['collectstatic', 'Static files collected'],
      ['redis', 'Redis server started'],
      ['django', 'Server running on port 8000'],
      ['rq', 'RQ worker started'],
    ]) {
      await emitMockEvent(page, 'backend:status', { service, status: 'ready', message });
    }
    await expect(row('RQ Worker')).toHaveClass(/ready/);
    await screenshot(page, LINEUP, 'start-02-splash-ready', 'Every service running, just before the main window opens');
  });

  test('first run: choosing and downloading the backend', async ({ page }) => {
    const calls = await openWindow(page, 'downloader?type=backend', { width: 500, height: 400 });
    await page.locator('.mode-row', { hasText: 'Portable' }).click();
    await expect(page.locator('.version-section .select-row').first()).toBeVisible();
    await expect(page.locator('.version-section .select-row.active')).toContainText('0.0.25');
    await screenshot(page, LINEUP, 'setup-01-backend-portable', 'Choosing the portable backend, which brings its own Python');

    await page.locator('.mode-row', { hasText: 'Native' }).click();
    await expect(page.getByText('3.12.7')).toBeVisible();
    await screenshot(page, LINEUP, 'setup-02-backend-native', 'Choosing the native backend and the Python on this computer');

    await page.locator('.mode-row', { hasText: 'Portable' }).click();
    await page.locator('.panel-footer .btn-primary').click();
    await emitMockEvent(page, 'download:progress', { downloaded: 61 * 1048576, total: 156 * 1048576, percentage: 39, speed: 8.4 * 1048576 });
    await expect(page.locator('.progress-section')).toBeVisible();
    expect(called(calls, 'DownloadPortableBackend').map(call => call.args)).toEqual([['0.0.25']]);
    await screenshot(page, LINEUP, 'setup-03-backend-downloading', 'Downloading the backend');

    await emitMockEvent(page, 'download:complete', { success: true, message: 'Portable backend downloaded successfully' });
    await expect(page.locator('.success-bar')).toBeVisible();
    await screenshot(page, LINEUP, 'setup-04-backend-downloaded', 'The backend downloaded; Cupcake starts it next');
  });

  test('first run: a failed download says why and offers a retry', async ({ page }) => {
    await openWindow(page, 'downloader?type=backend', { width: 500, height: 400 });
    await page.locator('.mode-row', { hasText: 'Portable' }).click();
    await page.locator('.panel-footer .btn-primary').click();
    await emitMockEvent(page, 'download:complete', { success: false, message: 'no portable release found for version 0.0.25 on linux/arm64' });
    await expect(page.locator('.error-bar .error-text')).toContainText('no portable release found');
    await expect(page.locator('.btn-retry')).toBeVisible();
    await screenshot(page, LINEUP, 'setup-05-backend-failed', 'A download that failed, with the reason and a retry');
  });

  test('first run: GitHub cannot be read, so no portable version is offered', async ({ page }) => {
    const calls = await openWindow(page, 'downloader?type=backend', { width: 500, height: 400 }, {
      GetAvailableReleases: [{ tag: 'master', name: 'Latest (master branch)', publishedAt: '', hasPortable: false }],
    });
    await page.locator('.mode-row', { hasText: 'Portable' }).click();
    await expect(page.locator('.no-releases')).toContainText('No portable release could be found');
    await expect(page.locator('.version-section .select-row')).toHaveCount(0);
    await expect(page.locator('.panel-footer .btn-primary')).toBeDisabled();
    await expect(page.locator('.panel-footer .btn-primary')).toHaveAttribute('title', 'Choose a version with a portable download');
    await screenshot(page, LINEUP, 'setup-05b-no-portable-release', 'GitHub could not be read: no portable version, with a retry');
    await page.locator('.no-releases .btn-retry').click();
    await expect.poll(() => called(calls, 'GetAvailableReleases').length).toBe(2);
  });

  test('first run: downloading the cache server', async ({ page }) => {
    const calls = await openWindow(page, 'downloader?type=valkey', { width: 500, height: 400 });
    await expect(page.locator('.panel-main')).toContainText(/Valkey|Redis/);
    await screenshot(page, LINEUP, 'setup-06-valkey', 'Downloading Valkey, the cache server for background tasks');
    await page.locator('.panel-footer .btn-primary').click();
    await expect.poll(() => called(calls, 'DownloadValkey').length).toBe(1);
  });

  test('first run: choosing the Python that runs the backend', async ({ page }) => {
    const calls = await openWindow(page, 'python-selection', { width: 520, height: 450 });
    await expect(page.locator('.candidate-row')).toHaveCount(2);
    await page.locator('.candidate-row').first().click();
    await screenshot(page, LINEUP, 'setup-07-python', 'Choosing the Python installation for a native backend');
    await page.locator('.panel-footer .btn-primary').click();
    await expect.poll(() => called(calls, 'SelectPython').length).toBe(1);
    expect(called(calls, 'SelectPython')[0].args[0]).toBe('/usr/bin/python3.12');
  });

  test('first run: creating the admin account with automatic sign-in', async ({ page }) => {
    const calls = await openWindow(page, 'superuser-creation', { width: 450, height: 400 });
    await page.locator('#username').fill('bench-owner');
    await page.locator('#email').fill('owner@lab.example.org');
    await page.locator('#password').fill('correct-horse-battery');
    await page.locator('#confirmPassword').fill('correct-horse-battery');
    await expect(page.locator('#signInAutomatically')).not.toBeChecked();
    await page.locator('#signInAutomatically').check();
    await screenshot(page, LINEUP, 'setup-09-admin-account', 'Creating the admin account and choosing automatic sign-in');

    await page.locator('.panel-footer .btn-primary').click();
    await expect(page.locator('.msg-bar.success')).toBeVisible();
    await screenshot(page, LINEUP, 'setup-10-admin-created', 'The admin account created');
    expect(called(calls, 'CreateSuperuser')[0].args).toEqual(['bench-owner', 'owner@lab.example.org', 'correct-horse-battery']);
    const signIn = called(calls, 'SaveSignInSettings')[0].args[0] as Record<string, unknown>;
    expect(signIn['mode']).toBe('automatic');
    expect(signIn['username']).toBe('bench-owner');
    const order = calls.map(call => call.method);
    expect(order.indexOf('CreateSuperuser')).toBeLessThan(order.indexOf('SaveSignInSettings'));
  });

  test('sign-in: choosing the login screen and how long a sign-in lasts', async ({ page }) => {
    const calls = await openWindow(page, 'sign-in', { width: 460, height: 420 });
    await expect(page.locator('.choice[data-mode="login"]')).toHaveClass(/active/);
    await page.locator('#sessionDays').selectOption('7');
    await screenshot(page, LINEUP, 'sign-in-01-login-screen', 'Using the login screen, with a sign-in that lasts 7 days');
    await page.locator('.panel-footer .btn-primary').click();
    await expect(page.locator('.msg-bar.success')).toBeVisible();
    const saved = called(calls, 'SaveSignInSettings')[0].args[0] as Record<string, unknown>;
    expect(saved).toEqual(expect.objectContaining({ mode: 'login', sessionDays: 7 }));
  });

  test('sign-in: signing in automatically', async ({ page }) => {
    const calls = await openWindow(page, 'sign-in', { width: 460, height: 420 }, { ListUsers: ['bench-owner', 'facility-staff'] });
    await page.locator('.choice[data-mode="automatic"] input[type="radio"]').check();
    await expect(page.locator('.panel-footer .btn-primary')).toBeDisabled();
    await expect(page.locator('.panel-footer .btn-primary')).toHaveAttribute('title', 'Choose the account to sign in automatically');
    await page.locator('#account').selectOption('bench-owner');
    await screenshot(page, LINEUP, 'sign-in-02-automatic', 'Signing in automatically as one account');
    await page.locator('.panel-footer .btn-primary').click();
    await expect(page.locator('.msg-bar.success')).toBeVisible();
    await screenshot(page, LINEUP, 'sign-in-03-saved', 'The sign-in choice saved');
    expect(called(calls, 'SaveSignInSettings')[0].args[0]).toEqual(expect.objectContaining({ mode: 'automatic', username: 'bench-owner' }));
  });

  test('sign-in: a refused choice shows the reason', async ({ page }) => {
    await openWindow(page, 'sign-in', { width: 460, height: 420 }, {
      GetSignInSettings: { mode: 'automatic', username: 'bench-owner', sessionDays: 30 },
      SaveSignInSettings: new LauncherError('there is no account named bench-owner'),
    });
    await page.locator('.panel-footer .btn-primary').click();
    await expect(page.locator('.msg-bar.error')).toContainText('there is no account named bench-owner');
  });

  test('resetting a password', async ({ page }) => {
    const calls = await openWindow(page, 'password-reset', { width: 450, height: 350 });
    await page.locator('#newPassword').fill('a-new-long-password');
    await page.locator('#confirmPassword').fill('a-new-long-password');
    await screenshot(page, LINEUP, 'password-reset', 'Resetting the password of an account');
    await page.locator('.panel-footer .btn-primary').click();
    await expect.poll(() => called(calls, 'ResetPassword').length).toBe(1);
    expect(called(calls, 'ResetPassword')[0].args).toEqual(['bench-owner', 'a-new-long-password']);
  });

  test('database setup: loading reference data', async ({ page }) => {
    const calls = await openWindow(page, 'management', { width: 700, height: 600 });
    await expect(page.locator('.stats-col')).toContainText('412');
    await expect(page.locator('.stat-row.primary .stat-val')).toHaveText('151296');
    await expect(page.locator('.ontology-list')).toContainText('MONDO: 25,913');
    await screenshot(page, LINEUP, 'management-01-overview', 'The reference data already loaded, and the commands that load more');

    const ontologies = page.locator('.command-row', { hasText: /ontolog/i }).first();
    await ontologies.locator('.btn-opt').click();
    await expect(ontologies).toHaveClass(/expanded/);
    const run = await ontologies.locator('.btn-exec').boundingBox();
    expect(run!.x + run!.width).toBeLessThanOrEqual(700);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(700);
    await screenshot(page, LINEUP, 'management-02-ontology-options', 'Choosing which ontologies to load');

    const schemas = page.locator('.command-row', { hasText: /schema/i }).first();
    await schemas.locator('.btn-exec').click();
    await expect.poll(() => called(calls, 'RunSyncSchemas').length).toBe(1);
    for (const output of ['Synchronising schemas from sdrf-templates 1.1.0...', 'Created 3 schemas, updated 31', 'Done.']) {
      await emitMockEvent(page, 'command:output', { command: 'sync-schemas', output, type: 'info' });
    }
    await expect(page.locator('.term-viewport')).toContainText('Created 3 schemas');
    await screenshot(page, LINEUP, 'management-03-output', 'The output of a command as it runs');
  });

  test('debug console', async ({ page }) => {
    await openWindow(page, 'debug', { width: 800, height: 600 });
    for (const [message, type] of [
      ['Starting Redis from: /home/lab/.config/cupcake/redis/valkey-server', 'info'],
      ['redis: Ready to accept connections tcp', 'info'],
      ['Django server started on port 8000', 'success'],
      ['[RQ] Worker rq:worker:7f3a started with PID 48211', 'info'],
      ['Static files error: 2 files were skipped', 'warning'],
    ]) {
      await emitMockEvent(page, 'backend:log', { message, type });
    }
    await expect(page.locator('.log-row')).toHaveCount(5);
    await screenshot(page, LINEUP, 'debug-console', 'The debug console with the backend log');
  });
});
