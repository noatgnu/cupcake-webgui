import { test, expect, Page, BrowserContext } from '@playwright/test';
import { launchWailsApp } from './wails-launcher';
import { ChildProcess, spawn } from 'child_process';
import * as http from 'http';
import { join } from 'path';

const SETUP_APP_URL = 'http://localhost:4200';
const MAIN_APP_URL = 'http://localhost:4201';
const TEST_API_URL = 'http://localhost:9999';
const SETUP_TIMEOUT = 600000;

const SUPERUSER = {
  username: 'integrationtest',
  email: 'integration@test.com',
  password: 'IntegrationTest123!',
};

let wailsProcess: ChildProcess;
let setupAppProcess: ChildProcess;
let mainAppProcess: ChildProcess;
let cleanupFn: () => Promise<void>;
let testDataDir: string;

async function callTestAPI(path: string, method = 'GET', body?: object): Promise<object | string> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, TEST_API_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForTestAPI(timeout = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const result = await callTestAPI('/test/health') as { status: string };
      if (result.status === 'ok') return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function waitForServer(url: string, timeout = 60000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function waitForBackendReady(timeout = 300000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const result = await callTestAPI('/test/backend-ready') as { ready: boolean };
      if (result.ready) return true;
    } catch {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return false;
}

async function waitForDownloadComplete(timeout = 300000): Promise<boolean> {
  const startTime = Date.now();
  let lastPercent = -1;

  while (Date.now() - startTime < timeout) {
    try {
      const status = await callTestAPI('/test/ui/downloader/status') as { downloading: boolean; backendReady: boolean };
      const progress = await callTestAPI('/test/ui/downloader/progress') as { percentage: number };

      if (progress.percentage !== lastPercent) {
        console.log(`Download progress: ${progress.percentage}%`);
        lastPercent = progress.percentage;
      }

      if (status.backendReady) {
        console.log('Backend is ready - download and setup complete');
        return true;
      }

      if (!status.downloading && progress.percentage === 100) {
        console.log('Download complete at 100%');
        return true;
      }
    } catch {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

async function waitForWindowOpen(windowName: string, timeout = 10000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const windows = await callTestAPI('/test/windows') as Record<string, boolean>;
      if (windows[windowName]) return true;
    } catch {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function waitForDownloaderReady(timeout = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const result = await callTestAPI('/test/ui/downloader/ready') as { ready: boolean };
      if (result.ready) {
        console.log('Downloader UI ready');
        return true;
      }
    } catch {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

test.describe.configure({ mode: 'serial', timeout: SETUP_TIMEOUT });

test.describe('Full UI Integration: Complete User Flow', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    console.log('Launching Wails backend services...');

    const result = await launchWailsApp({ cleanStart: true });
    wailsProcess = result.process;
    cleanupFn = result.cleanup;
    testDataDir = result.testDataDir;

    console.log(`Wails app launched, test data dir: ${testDataDir}`);

    console.log('Waiting for test API to be ready...');
    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) {
      throw new Error('Test API did not become ready');
    }
    console.log('Test API is ready');

    console.log('Starting setup app dev server on port 4200...');
    const setupAppDir = join(__dirname, '..', '..');
    setupAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4200'], {
      cwd: setupAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    setupAppProcess.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[setup-app] ${line}`);
    });

    setupAppProcess.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[setup-app:err] ${line}`);
    });

    console.log('Starting main app dev server on port 4201...');
    const mainAppDir = join(__dirname, '..', '..', '..', '..');
    mainAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4201', '--configuration', 'integration-test', '--proxy-config', 'proxy.conf.json'], {
      cwd: mainAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    mainAppProcess.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[main-app] ${line}`);
    });

    mainAppProcess.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[main-app:err] ${line}`);
    });

    console.log('Waiting for setup app dev server...');
    const setupAppReady = await waitForServer(SETUP_APP_URL, 60000);
    if (!setupAppReady) {
      throw new Error('Setup app dev server did not start');
    }
    console.log('Setup app dev server is ready');

    console.log('Waiting for main app dev server (may take several minutes for library builds)...');
    const mainAppReady = await waitForServer(MAIN_APP_URL, 300000);
    if (!mainAppReady) {
      throw new Error('Main app dev server did not start');
    }
    console.log('Main app dev server is ready');

    context = await browser.newContext({ ignoreHTTPSErrors: true });
  });

  test.afterAll(async () => {
    console.log('Cleaning up...');
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (setupAppProcess) {
      setupAppProcess.kill('SIGTERM');
    }
    if (mainAppProcess) {
      mainAppProcess.kill('SIGTERM');
    }
    if (cleanupFn) await cleanupFn().catch(() => {});
  });

  test('step 1: verify Wails app started', async () => {
    expect(wailsProcess.pid).toBeDefined();
    expect(wailsProcess.killed).toBe(false);

    const health = await callTestAPI('/test/health') as { status: string };
    expect(health.status).toBe('ok');

    console.log(`Wails process PID: ${wailsProcess.pid}`);
  });

  test('step 2: open downloader window via UI', async () => {
    console.log('Opening downloader window...');
    await callTestAPI('/test/ui/open-downloader', 'POST');

    const windowOpen = await waitForWindowOpen('downloader', 10000);
    expect(windowOpen).toBe(true);
    console.log('Downloader window opened');

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('step 3: start download and wait for completion', async () => {
    const initialStatus = await callTestAPI('/test/backend-ready') as { ready: boolean };
    if (initialStatus.ready) {
      console.log('Backend already ready, skipping download');
      return;
    }

    console.log('Waiting for downloader UI to be ready...');
    const ready = await waitForDownloaderReady(30000);
    expect(ready).toBe(true);

    console.log('Starting download via Test API...');
    const downloadResult = await callTestAPI('/test/ui/downloader/start-download', 'POST', {}) as { started: boolean; version: string };
    expect(downloadResult.started).toBe(true);
    console.log(`Download started for version: ${downloadResult.version}`);

    console.log('Waiting for download to complete...');
    const downloadComplete = await waitForDownloadComplete(300000);
    expect(downloadComplete).toBe(true);
    console.log('Download completed');
  });

  test('step 4: wait for all backend services to start', async () => {
    console.log('Waiting for all services to start...');

    const ready = await waitForBackendReady(300000);
    expect(ready).toBe(true);

    console.log('Backend is ready!');
  });

  test('step 5: open superuser creation window via UI', async () => {
    console.log('Opening superuser creation window...');
    await callTestAPI('/test/ui/open-superuser', 'POST');

    const windowOpen = await waitForWindowOpen('superuser', 10000);
    expect(windowOpen).toBe(true);
    console.log('Superuser window opened');

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('step 6: fill superuser form via UI', async () => {
    console.log('Filling superuser form...');
    await callTestAPI('/test/ui/superuser/fill', 'POST', {
      username: SUPERUSER.username,
      email: SUPERUSER.email,
      password: SUPERUSER.password,
      confirmPassword: SUPERUSER.password,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Form filled');
  });

  test('step 7: submit superuser form via UI', async () => {
    console.log('Submitting superuser form...');
    await callTestAPI('/test/ui/superuser/submit', 'POST');

    await new Promise(resolve => setTimeout(resolve, 3000));

    const windows = await callTestAPI('/test/windows') as Record<string, boolean>;
    console.log('Windows state after submit:', windows);
  });

  test('step 8: navigate to login page', async () => {
    page = await context.newPage();

    console.log('Navigating to main app login page...');
    await page.goto(`${MAIN_APP_URL}/#/login`, { waitUntil: 'networkidle', timeout: 30000 });

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    expect(currentUrl).toContain('/login');
  });

  test('step 9: fill and submit login form', async () => {
    console.log('Looking for login form...');

    await page.waitForSelector('input[formcontrolname="username"], input[name="username"], #username', { timeout: 15000 });

    console.log('Filling login credentials...');
    await page.fill('input[formcontrolname="username"], input[name="username"], #username', SUPERUSER.username);
    await page.fill('input[formcontrolname="password"], input[name="password"], #password', SUPERUSER.password);

    console.log('Taking screenshot before login...');
    await page.screenshot({ path: 'test-results/before-login.png' });

    console.log('Clicking login button...');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    console.log('Taking screenshot after login...');
    await page.screenshot({ path: 'test-results/after-login.png' });

    const currentUrl = page.url();
    console.log(`After login, URL is: ${currentUrl}`);
  });

  test('step 10: verify successful login', async () => {
    const currentUrl = page.url();

    expect(currentUrl).not.toContain('/login');

    const accessToken = await page.evaluate(() => localStorage.getItem('ccvAccessToken'));
    console.log(`Access token found: ${accessToken ? 'Yes' : 'No'}`);

    expect(accessToken).toBeTruthy();
    console.log('Login successful!');
  });

  test('step 11: navigate to metadata section', async () => {
    console.log('Looking for navigation...');

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/main-app.png' });

    const navLink = page.locator('a[href*="metadata"], [routerlink*="metadata"], nav a').first();
    const isVisible = await navLink.isVisible().catch(() => false);

    if (isVisible) {
      console.log('Navigation link found, clicking...');
      await navLink.click();
      await page.waitForTimeout(2000);
    }

    console.log('Navigation test completed');
  });

  test('step 12: verify distribution info', async () => {
    const info = await callTestAPI('/test/distribution-info') as { backendExists: boolean; isPortable: boolean };

    expect(info.backendExists).toBe(true);
    expect(info.isPortable).toBe(true);

    console.log('Distribution info:', JSON.stringify(info, null, 2));
  });

  test('step 13: open management panel', async () => {
    console.log('Opening management panel...');
    await callTestAPI('/test/ui/open-management', 'POST');

    const windowOpen = await waitForWindowOpen('management', 10000);
    expect(windowOpen).toBe(true);
    console.log('Management panel opened');

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('step 14: create database backup', async () => {
    console.log('Creating database backup...');
    const result = await callTestAPI('/test/backup/create-database', 'POST') as { success: boolean; message?: string };

    expect(result.success).toBe(true);
    console.log('Database backup created');

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('step 15: create media backup', async () => {
    console.log('Creating media backup...');
    const result = await callTestAPI('/test/backup/create-media', 'POST') as { success: boolean; message?: string };

    expect(result.success).toBe(true);
    console.log('Media backup created');

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('step 16: list backups', async () => {
    console.log('Listing backups...');
    const backups = await callTestAPI('/test/backup/list') as { backups: Array<{ name: string; type: string; size: number }> };

    expect(backups.backups.length).toBeGreaterThan(0);

    const dbBackups = backups.backups.filter(b => b.type === 'database');
    const mediaBackups = backups.backups.filter(b => b.type === 'media');

    console.log(`Found ${dbBackups.length} database backups and ${mediaBackups.length} media backups`);
    expect(dbBackups.length).toBeGreaterThanOrEqual(1);
    expect(mediaBackups.length).toBeGreaterThanOrEqual(1);
  });

  test('step 17: restore database from backup', async () => {
    console.log('Restoring database from backup...');
    const result = await callTestAPI('/test/backup/restore-database', 'POST') as { success: boolean; message?: string };

    expect(result.success).toBe(true);
    console.log('Database restored');

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('step 18: restore media from backup', async () => {
    console.log('Restoring media from backup...');
    const result = await callTestAPI('/test/backup/restore-media', 'POST') as { success: boolean; message?: string };

    expect(result.success).toBe(true);
    console.log('Media restored');

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('step 19: verify backend still works after restore', async () => {
    console.log('Verifying backend still works after restore...');
    const ready = await waitForBackendReady(30000);
    expect(ready).toBe(true);
    console.log('Backend verified working after restore');
  });
});
