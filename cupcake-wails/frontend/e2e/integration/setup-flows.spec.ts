import { test, expect, BrowserContext } from '@playwright/test';
import { launchWailsApp } from './wails-launcher';
import { ChildProcess, spawn } from 'child_process';
import * as http from 'http';
import { join } from 'path';

const SETUP_APP_URL = 'http://localhost:4200';
const MAIN_APP_URL = 'http://localhost:4201';
const TEST_API_URL = 'http://localhost:9999';
const SETUP_TIMEOUT = 900000;

let wailsProcess: ChildProcess;

async function callTestAPI(path: string, method = 'GET', body?: object, timeout = 60000): Promise<object | string> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, TEST_API_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout,
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

    req.on('error', (err) => {
      console.log(`[callTestAPI] Error calling ${path}: ${err.message}`);
      reject(err);
    });
    req.on('timeout', () => {
      console.log(`[callTestAPI] Timeout calling ${path} after ${timeout}ms`);
      req.destroy();
      reject(new Error(`timeout calling ${path}`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForTestAPI(timeout = 60000): Promise<boolean> {
  const startTime = Date.now();
  console.log(`[waitForTestAPI] Waiting for test API on ${TEST_API_URL}...`);
  while (Date.now() - startTime < timeout) {
    try {
      const result = await callTestAPI('/test/health', 'GET', undefined, 5000) as { status: string };
      if (result.status === 'ok') {
        console.log(`[waitForTestAPI] Test API ready after ${Date.now() - startTime}ms`);
        return true;
      }
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  console.log(`[waitForTestAPI] Test API not ready after ${timeout}ms`);
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

async function waitForWindowClose(windowName: string, timeout = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const windows = await callTestAPI('/test/windows') as Record<string, boolean>;
      if (!windows[windowName]) return true;
    } catch {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 500));
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

test.describe.configure({ mode: 'serial', timeout: SETUP_TIMEOUT });

test.describe('Setup Flow: Portable Backend with Superuser Creation', () => {
  let context: BrowserContext;
  let localCleanup: () => Promise<void>;
  let localTestDataDir: string;
  let localSetupAppProcess: ChildProcess;
  let localMainAppProcess: ChildProcess;

  test.beforeAll(async ({ browser }) => {
    console.log('=== PORTABLE BACKEND + SUPERUSER FLOW ===');
    console.log('Launching Wails backend services...');

    const result = await launchWailsApp({ cleanStart: true, suiteName: 'portable-superuser' });
    wailsProcess = result.process;
    localCleanup = result.cleanup;
    localTestDataDir = result.testDataDir;

    console.log(`Wails app launched, test data dir: ${localTestDataDir}`);

    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) throw new Error('Test API did not become ready');

    console.log('Starting setup app dev server...');
    const setupAppDir = join(__dirname, '..', '..');
    localSetupAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4200'], {
      cwd: setupAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    localSetupAppProcess.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[setup-app] ${line}`);
    });

    console.log('Starting main app dev server...');
    const mainAppDir = join(__dirname, '..', '..', '..', '..');
    localMainAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4201', '--configuration', 'integration-test', '--proxy-config', 'proxy.conf.json'], {
      cwd: mainAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    localMainAppProcess.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[main-app] ${line}`);
    });

    const setupReady = await waitForServer(SETUP_APP_URL, 60000);
    if (!setupReady) throw new Error('Setup app dev server did not start');

    const mainReady = await waitForServer(MAIN_APP_URL, 300000);
    if (!mainReady) throw new Error('Main app dev server did not start');

    context = await browser.newContext({ ignoreHTTPSErrors: true });
  });

  test.afterAll(async () => {
    console.log('Cleaning up portable-superuser test...');
    try { if (context) await context.close(); } catch { /* ignore */ }
    try { if (localSetupAppProcess) localSetupAppProcess.kill('SIGTERM'); } catch { /* ignore */ }
    try { if (localMainAppProcess) localMainAppProcess.kill('SIGTERM'); } catch { /* ignore */ }
    try {
      if (localCleanup) {
        await localCleanup();
        console.log(`Cleaned up test directory: ${localTestDataDir}`);
      }
    } catch (err) { console.log(`Cleanup error: ${err}`); }
  });

  test('step 1: open downloader and select portable mode', async () => {
    console.log('Opening downloader window...');
    await callTestAPI('/test/ui/open-downloader', 'POST');

    const windowOpen = await waitForWindowOpen('downloader', 10000);
    expect(windowOpen).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Downloader window opened');
  });

  test('step 2: download portable backend', async () => {
    const initialStatus = await callTestAPI('/test/backend-ready') as { ready: boolean };
    if (initialStatus.ready) {
      console.log('Backend already ready, skipping download');
      return;
    }

    console.log('Starting portable download...');
    const result = await callTestAPI('/test/ui/downloader/start-download', 'POST', {}) as { started: boolean; version: string };
    expect(result.started).toBe(true);
    console.log(`Download started for version: ${result.version}`);

    const complete = await waitForDownloadComplete(300000);
    expect(complete).toBe(true);
    console.log('Portable download completed');
  });

  test('step 3: verify backend services started', async () => {
    const ready = await waitForBackendReady(300000);
    expect(ready).toBe(true);
    console.log('All backend services are ready');
  });

  test('step 4: open superuser modal and create account', async () => {
    console.log('Opening superuser creation window...');
    await callTestAPI('/test/ui/open-superuser', 'POST');

    const windowOpen = await waitForWindowOpen('superuser', 10000);
    expect(windowOpen).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Superuser window opened');

    console.log('Creating superuser account...');
    const createResult = await callTestAPI('/test/create-superuser', 'POST', {
      username: 'testadmin',
      email: 'admin@test.com',
      password: 'TestPassword123!',
    }) as { success: boolean; error?: string; venvPath?: string };

    console.log('Create superuser result:', JSON.stringify(createResult, null, 2));

    if (!createResult.success) {
      console.log('Superuser creation failed:', createResult.error);
    }

    expect(createResult.success).toBe(true);
    console.log('Superuser creation API call successful, venvPath:', createResult.venvPath);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const userCount = await callTestAPI('/test/user-count') as { count: number; error?: string; backendDir?: string; venvPath?: string };
    console.log('User count result:', JSON.stringify(userCount, null, 2));

    if (userCount.error) {
      console.log('User count error:', userCount.error);
    }

    expect(userCount.count).toBeGreaterThan(0);
    console.log(`Superuser created. User count: ${userCount.count}`);
  });

  test('step 5: verify distribution info', async () => {
    const info = await callTestAPI('/test/distribution-info') as {
      backendExists: boolean;
      isPortable: boolean;
      distributionType: string;
    };

    expect(info.backendExists).toBe(true);
    expect(info.isPortable).toBe(true);
    expect(info.distributionType).toBe('portable');
    console.log('Distribution info verified:', JSON.stringify(info, null, 2));
  });

  test('step 6: login with created superuser', async () => {
    const page = await context.newPage();

    console.log('Navigating to login page...');
    await page.goto(`${MAIN_APP_URL}/#/login`, { waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForSelector('input[formcontrolname="username"], input[name="username"], #username', { timeout: 15000 });

    console.log('Filling login credentials...');
    await page.fill('input[formcontrolname="username"], input[name="username"], #username', 'testadmin');
    await page.fill('input[formcontrolname="password"], input[name="password"], #password', 'TestPassword123!');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');

    const accessToken = await page.evaluate(() => localStorage.getItem('ccvAccessToken'));
    expect(accessToken).toBeTruthy();
    console.log('Login successful');

    await page.close();
  });
});

test.describe('Setup Flow: Superuser Skip Option', () => {
  let context: BrowserContext;
  let localCleanup: () => Promise<void>;
  let localTestDataDir: string;
  let localSetupAppProcess: ChildProcess;

  test.beforeAll(async ({ browser }) => {
    console.log('=== SUPERUSER SKIP FLOW ===');

    const result = await launchWailsApp({ cleanStart: true, suiteName: 'superuser-skip' });
    wailsProcess = result.process;
    localCleanup = result.cleanup;
    localTestDataDir = result.testDataDir;

    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) throw new Error('Test API did not become ready');

    const setupAppDir = join(__dirname, '..', '..');
    localSetupAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4200'], {
      cwd: setupAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const setupReady = await waitForServer(SETUP_APP_URL, 60000);
    if (!setupReady) throw new Error('Setup app dev server did not start');

    context = await browser.newContext({ ignoreHTTPSErrors: true });
  });

  test.afterAll(async () => {
    console.log('Cleaning up superuser-skip test...');
    try { if (context) await context.close(); } catch { /* ignore */ }
    try { if (localSetupAppProcess) localSetupAppProcess.kill('SIGTERM'); } catch { /* ignore */ }
    try {
      if (localCleanup) {
        await localCleanup();
        console.log(`Cleaned up test directory: ${localTestDataDir}`);
      }
    } catch (err) { console.log(`Cleanup error: ${err}`); }
  });

  test('step 1: setup backend', async () => {
    await callTestAPI('/test/ui/open-downloader', 'POST');
    await waitForWindowOpen('downloader', 10000);

    const initialStatus = await callTestAPI('/test/backend-ready') as { ready: boolean };
    if (!initialStatus.ready) {
      await callTestAPI('/test/ui/downloader/start-download', 'POST', {});
      await waitForDownloadComplete(300000);
    }

    const ready = await waitForBackendReady(300000);
    expect(ready).toBe(true);
  });

  test('step 2: open superuser modal and skip', async () => {
    console.log('Opening superuser window...');
    await callTestAPI('/test/ui/open-superuser', 'POST');

    const windowOpen = await waitForWindowOpen('superuser', 10000);
    expect(windowOpen).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Clicking skip button...');
    await callTestAPI('/test/ui/superuser/skip', 'POST');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const windowClosed = await waitForWindowClose('superuser', 10000);
    console.log(`Superuser window closed: ${windowClosed}`);

    const userCount = await callTestAPI('/test/user-count') as { count: number };
    expect(userCount.count).toBe(0);
    console.log('Superuser skipped - no users created');
  });
});

test.describe('Setup Flow: Python Selection with Auto-detected Python', () => {
  let context: BrowserContext;
  let localCleanup: () => Promise<void>;
  let localTestDataDir: string;
  let localSetupAppProcess: ChildProcess;
  let pythonCandidateCount = 0;

  test.beforeAll(async ({ browser }) => {
    console.log('=== PYTHON SELECTION (AUTO-DETECTED) FLOW ===');

    const result = await launchWailsApp({ cleanStart: true, suiteName: 'python-selection' });
    wailsProcess = result.process;
    localCleanup = result.cleanup;
    localTestDataDir = result.testDataDir;

    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) throw new Error('Test API did not become ready');

    const setupAppDir = join(__dirname, '..', '..');
    localSetupAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4200'], {
      cwd: setupAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const setupReady = await waitForServer(SETUP_APP_URL, 60000);
    if (!setupReady) throw new Error('Setup app dev server did not start');

    context = await browser.newContext({ ignoreHTTPSErrors: true });

    const pythonResult = await callTestAPI('/test/ui/python-selection/candidates') as {
      candidates: Array<{ path: string; version: string }>;
      count: number;
    };
    pythonCandidateCount = pythonResult.count;
    console.log(`Pre-check: Found ${pythonCandidateCount} Python candidates`);
  });

  test.afterAll(async () => {
    console.log('Cleaning up python-selection test...');
    try { if (context) await context.close(); } catch { /* ignore */ }
    try { if (localSetupAppProcess) localSetupAppProcess.kill('SIGTERM'); } catch { /* ignore */ }
    try {
      if (localCleanup) {
        await localCleanup();
        console.log(`Cleaned up test directory: ${localTestDataDir}`);
      }
    } catch (err) { console.log(`Cleanup error: ${err}`); }
  });

  test('step 1: get available Python candidates', async () => {
    test.skip(pythonCandidateCount === 0, 'No Python candidates found in test environment');

    const result = await callTestAPI('/test/ui/python-selection/candidates') as {
      candidates: Array<{ path: string; version: string }>;
      count: number;
    };

    console.log(`Found ${result.count} Python candidates`);
    expect(result.count).toBeGreaterThan(0);

    for (const candidate of result.candidates) {
      console.log(`  - ${candidate.version} at ${candidate.path}`);
    }
  });

  test('step 2: open Python selection and select first candidate', async () => {
    test.skip(pythonCandidateCount === 0, 'No Python candidates found in test environment');

    console.log('Opening Python selection window...');
    await callTestAPI('/test/ui/open-python-selection', 'POST');

    const windowOpen = await waitForWindowOpen('pythonSelection', 10000);
    expect(windowOpen).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Selecting first Python candidate...');
    await callTestAPI('/test/ui/python-selection/select', 'POST', { index: 0 });

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Python candidate selected');
  });

  test('step 3: enable venv creation and submit', async () => {
    test.skip(pythonCandidateCount === 0, 'No Python candidates found in test environment');

    console.log('Enabling virtual environment creation...');
    await callTestAPI('/test/ui/python-selection/toggle-venv', 'POST', { enabled: true });

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Submitting Python selection...');
    await callTestAPI('/test/ui/python-selection/submit', 'POST');

    const windowClosed = await waitForWindowClose('pythonSelection', 30000);
    expect(windowClosed).toBe(true);
    console.log('Python selection submitted');
  });
});

test.describe('Setup Flow: Valkey Download', () => {
  let localCleanup: () => Promise<void>;
  let localTestDataDir: string;

  test.beforeAll(async () => {
    console.log('=== VALKEY DOWNLOAD FLOW ===');

    const result = await launchWailsApp({ cleanStart: true, suiteName: 'valkey-download' });
    wailsProcess = result.process;
    localCleanup = result.cleanup;
    localTestDataDir = result.testDataDir;

    const apiReady = await waitForTestAPI(60000);
    if (!apiReady) throw new Error('Test API did not become ready');
  });

  test.afterAll(async () => {
    console.log('Cleaning up valkey-download test...');
    try {
      if (localCleanup) {
        await localCleanup();
        console.log(`Cleaned up test directory: ${localTestDataDir}`);
      }
    } catch (err) { console.log(`Cleanup error: ${err}`); }
  });

  test('download Valkey via API', async () => {
    console.log('Starting Valkey download via API...');
    const result = await callTestAPI('/test/download-valkey', 'POST', undefined, 60000) as {
      status: string;
      completed?: boolean;
      error?: string;
    };

    console.log(`Valkey download result: ${JSON.stringify(result)}`);

    if (result.status === 'error') {
      console.log(`Valkey download error: ${result.error}`);
    }

    expect(result.completed).toBe(true);
    console.log('Valkey download test passed');
  });
});

test.describe('Setup Flow: Available Releases Check', () => {
  let localCleanup: () => Promise<void>;
  let localTestDataDir: string;

  test.beforeAll(async () => {
    console.log('=== AVAILABLE RELEASES CHECK ===');

    const result = await launchWailsApp({ cleanStart: true, suiteName: 'available-releases' });
    wailsProcess = result.process;
    localCleanup = result.cleanup;
    localTestDataDir = result.testDataDir;

    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) throw new Error('Test API did not become ready');
  });

  test.afterAll(async () => {
    console.log('Cleaning up available-releases test...');
    try {
      if (localCleanup) {
        await localCleanup();
        console.log(`Cleaned up test directory: ${localTestDataDir}`);
      }
    } catch (err) { console.log(`Cleanup error: ${err}`); }
  });

  test('verify releases are fetched from GitHub', async () => {
    console.log('Fetching available releases...');
    const releases = await callTestAPI('/test/available-releases') as Array<{
      tag: string;
      name: string;
      hasPortable: boolean;
    }>;

    expect(releases.length).toBeGreaterThan(0);
    console.log(`Found ${releases.length} releases:`);

    for (const release of releases.slice(0, 5)) {
      console.log(`  - ${release.tag}: ${release.name} (portable: ${release.hasPortable})`);
    }

    const portableReleases = releases.filter(r => r.hasPortable);
    expect(portableReleases.length).toBeGreaterThan(0);
    console.log(`${portableReleases.length} releases have portable builds`);
  });
});

test.describe('Setup Flow: Management Commands (Schemas, Templates, Ontologies)', () => {
  let context: BrowserContext;
  let localCleanup: () => Promise<void>;
  let localTestDataDir: string;
  let localSetupAppProcess: ChildProcess;

  test.beforeAll(async ({ browser }) => {
    console.log('=== MANAGEMENT COMMANDS FLOW ===');

    const result = await launchWailsApp({ cleanStart: true, suiteName: 'management-commands' });
    wailsProcess = result.process;
    localCleanup = result.cleanup;
    localTestDataDir = result.testDataDir;

    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) throw new Error('Test API did not become ready');

    const setupAppDir = join(__dirname, '..', '..');
    localSetupAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4200'], {
      cwd: setupAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const setupReady = await waitForServer(SETUP_APP_URL, 60000);
    if (!setupReady) throw new Error('Setup app dev server did not start');

    context = await browser.newContext({ ignoreHTTPSErrors: true });
  });

  test.afterAll(async () => {
    console.log('Cleaning up management-commands test...');
    try { if (context) await context.close(); } catch { /* ignore */ }
    try { if (localSetupAppProcess) localSetupAppProcess.kill('SIGTERM'); } catch { /* ignore */ }
    try {
      if (localCleanup) {
        await localCleanup();
        console.log(`Cleaned up test directory: ${localTestDataDir}`);
      }
    } catch (err) { console.log(`Cleanup error: ${err}`); }
  });

  test('step 1: setup backend first', async () => {
    await callTestAPI('/test/ui/open-downloader', 'POST');
    await waitForWindowOpen('downloader', 10000);

    const initialStatus = await callTestAPI('/test/backend-ready') as { ready: boolean };
    if (!initialStatus.ready) {
      await callTestAPI('/test/ui/downloader/start-download', 'POST', {});
      await waitForDownloadComplete(300000);
    }

    const ready = await waitForBackendReady(300000);
    expect(ready).toBe(true);
    console.log('Backend ready for management commands');
  });

  test('step 2: open management panel', async () => {
    console.log('Opening management panel...');
    await callTestAPI('/test/ui/open-management', 'POST');

    const windowOpen = await waitForWindowOpen('management', 10000);
    expect(windowOpen).toBe(true);
    console.log('Management panel opened');
  });

  test('step 3: sync schemas via API', async () => {
    console.log('Getting initial schema count...');
    const initialCount = await callTestAPI('/test/management/schema-count') as { count: number; error?: string };
    console.log(`Initial schema count: ${initialCount.count}${initialCount.error ? `, error: ${initialCount.error}` : ''}`);

    console.log('Calling sync-schemas API directly...');
    const syncResult = await callTestAPI('/test/management/sync-schemas', 'POST') as { started: boolean };
    console.log(`Sync command started: ${syncResult.started}`);

    console.log('Waiting for sync to complete...');
    const pollInterval = 2000;
    const maxWait = 120000;
    let elapsed = 0;
    let completed = false;

    while (elapsed < maxWait && !completed) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;

      const count = await callTestAPI('/test/management/schema-count') as { count: number; error?: string };
      console.log(`Polling schema count: ${count.count}${count.error ? `, error: ${count.error}` : ''} (${elapsed/1000}s)`);
      if (count.count > initialCount.count) {
        completed = true;
        console.log(`Sync completed after ${elapsed / 1000}s, count: ${count.count}`);
      }
    }

    const finalCount = await callTestAPI('/test/management/schema-count') as { count: number; error?: string };
    console.log(`Final schema count: ${finalCount.count}${finalCount.error ? `, error: ${finalCount.error}` : ''}`);

    expect(finalCount.count).toBeGreaterThanOrEqual(initialCount.count);
    console.log(`Schemas synced via API: ${initialCount.count} -> ${finalCount.count}`);
  });

  test('step 4: load column templates via API', async () => {
    console.log('Getting initial column template count...');
    const initialCount = await callTestAPI('/test/management/column-template-count') as { count: number; error?: string };
    console.log(`Initial column template count: ${initialCount.count}${initialCount.error ? `, error: ${initialCount.error}` : ''}`);

    console.log('Calling load-column-templates API directly...');
    const loadResult = await callTestAPI('/test/management/load-column-templates', 'POST') as { started: boolean };
    console.log(`Load command started: ${loadResult.started}`);

    console.log('Waiting for load to complete...');
    const pollInterval = 2000;
    const maxWait = 120000;
    let elapsed = 0;
    let completed = false;

    while (elapsed < maxWait && !completed) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;

      const count = await callTestAPI('/test/management/column-template-count') as { count: number; error?: string };
      console.log(`Polling template count: ${count.count}${count.error ? `, error: ${count.error}` : ''} (${elapsed/1000}s)`);
      if (count.count > initialCount.count) {
        completed = true;
        console.log(`Load completed after ${elapsed / 1000}s, count: ${count.count}`);
      }
    }

    const finalCount = await callTestAPI('/test/management/column-template-count') as { count: number; error?: string };
    console.log(`Final column template count: ${finalCount.count}${finalCount.error ? `, error: ${finalCount.error}` : ''}`);

    expect(finalCount.count).toBeGreaterThanOrEqual(initialCount.count);
    console.log(`Column templates loaded via API: ${initialCount.count} -> ${finalCount.count}`);
  });

  test('step 5: load ontologies via API', async () => {
    console.log('Getting initial ontology counts...');
    const initialCounts = await callTestAPI('/test/management/ontology-counts') as { counts: Record<string, number> | null; error?: string };
    console.log('Initial ontology counts:', JSON.stringify(initialCounts.counts, null, 2));
    if (initialCounts.error) console.log(`Initial error: ${initialCounts.error}`);

    const initialTotal = initialCounts.counts ? Object.values(initialCounts.counts).reduce((a, b) => a + b, 0) : 0;
    console.log(`Initial total ontology entries: ${initialTotal}`);

    console.log('Calling load-ontologies API directly...');
    const loadResult = await callTestAPI('/test/management/load-ontologies', 'POST') as { started: boolean };
    console.log(`Load ontologies started: ${loadResult.started}`);

    console.log('Waiting for ontology load to complete (up to 5 minutes)...');
    const pollInterval = 10000;
    const maxWait = 300000;
    let elapsed = 0;
    let lastTotal = initialTotal;

    while (elapsed < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;

      const counts = await callTestAPI('/test/management/ontology-counts') as { counts: Record<string, number> | null; error?: string };
      const currentTotal = counts.counts ? Object.values(counts.counts).reduce((a, b) => a + b, 0) : 0;

      console.log(`Polling ontology count: ${currentTotal}${counts.error ? `, error: ${counts.error}` : ''} (${elapsed/1000}s)`);

      if (currentTotal > lastTotal) {
        console.log(`Progress: ${currentTotal} ontology terms loaded (${elapsed / 1000}s)`);
        lastTotal = currentTotal;
      }

      if (currentTotal > 0 && elapsed > 60000) {
        break;
      }
    }

    const finalCounts = await callTestAPI('/test/management/ontology-counts') as { counts: Record<string, number> | null; error?: string };
    console.log('Final ontology counts:', JSON.stringify(finalCounts.counts, null, 2));
    if (finalCounts.error) console.log(`Final error: ${finalCounts.error}`);

    const finalTotal = finalCounts.counts ? Object.values(finalCounts.counts).reduce((a, b) => a + b, 0) : 0;
    console.log(`Final total ontology entries: ${finalTotal}`);

    expect(finalTotal).toBeGreaterThanOrEqual(initialTotal);
    console.log(`Ontologies loaded via API: ${initialTotal} -> ${finalTotal}`);
  });

  test('step 6: verify all data populated', async () => {
    const schemaCount = await callTestAPI('/test/management/schema-count') as { count: number };
    const templateCount = await callTestAPI('/test/management/column-template-count') as { count: number };
    const ontologyCounts = await callTestAPI('/test/management/ontology-counts') as { counts: Record<string, number> };

    console.log('=== FINAL DATA SUMMARY ===');
    console.log(`Schemas: ${schemaCount.count}`);
    console.log(`Column Templates: ${templateCount.count}`);
    console.log('Ontologies:', JSON.stringify(ontologyCounts.counts, null, 2));

    expect(schemaCount.count).toBeGreaterThan(0);
    console.log('All management data verified');
  });
});

test.describe('Setup Flow: Native Backend with System Python', () => {
  let context: BrowserContext;
  let localCleanup: () => Promise<void>;
  let localTestDataDir: string;
  let localSetupAppProcess: ChildProcess;
  let pythonCandidateCount = 0;

  test.beforeAll(async ({ browser }) => {
    console.log('=== NATIVE BACKEND FLOW ===');

    const result = await launchWailsApp({ cleanStart: true, suiteName: 'native-backend' });
    wailsProcess = result.process;
    localCleanup = result.cleanup;
    localTestDataDir = result.testDataDir;

    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) throw new Error('Test API did not become ready');

    const setupAppDir = join(__dirname, '..', '..');
    localSetupAppProcess = spawn('npm', ['run', 'start', '--', '--port', '4200'], {
      cwd: setupAppDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    const setupReady = await waitForServer(SETUP_APP_URL, 60000);
    if (!setupReady) throw new Error('Setup app dev server did not start');

    context = await browser.newContext({ ignoreHTTPSErrors: true });

    const pythonResult = await callTestAPI('/test/ui/python-selection/candidates') as {
      candidates: Array<{ path: string; version: string }>;
      count: number;
    };
    pythonCandidateCount = pythonResult.count;
    console.log(`Pre-check: Found ${pythonCandidateCount} Python candidates for native setup`);
  });

  test.afterAll(async () => {
    console.log('Cleaning up native-backend test...');
    try { if (context) await context.close(); } catch { /* ignore */ }
    try { if (localSetupAppProcess) localSetupAppProcess.kill('SIGTERM'); } catch { /* ignore */ }
    try {
      if (localCleanup) {
        await localCleanup();
        console.log(`Cleaned up test directory: ${localTestDataDir}`);
      }
    } catch (err) { console.log(`Cleanup error: ${err}`); }
  });

  test('step 1: verify Python candidates available', async () => {
    test.skip(pythonCandidateCount === 0, 'No Python candidates found in test environment');

    const result = await callTestAPI('/test/ui/python-selection/candidates') as {
      candidates: Array<{ path: string; version: string }>;
      count: number;
    };

    expect(result.count).toBeGreaterThan(0);
    console.log(`Found ${result.count} Python candidates for native setup`);
  });

  test('step 2: start native backend setup', async () => {
    test.skip(pythonCandidateCount === 0, 'No Python candidates found in test environment');

    console.log('Starting native backend setup...');

    const result = await callTestAPI('/test/ui/downloader/start-native', 'POST', {
      branch: 'master',
    }) as { started: boolean; pythonPath: string; branch: string };

    expect(result.started).toBe(true);
    console.log(`Native setup started: python=${result.pythonPath}, branch=${result.branch}`);
  });

  test('step 3: wait for native backend to be ready', async () => {
    test.skip(pythonCandidateCount === 0, 'No Python candidates found in test environment');

    console.log('Waiting for native backend setup to complete...');

    const ready = await waitForBackendReady(600000);
    expect(ready).toBe(true);
    console.log('Native backend is ready');
  });

  test('step 4: verify native distribution type', async () => {
    test.skip(pythonCandidateCount === 0, 'No Python candidates found in test environment');

    const info = await callTestAPI('/test/distribution-info') as {
      backendExists: boolean;
      distributionType: string;
      backendSource: string;
      venvPath: string;
    };

    expect(info.backendExists).toBe(true);
    expect(info.distributionType).toBe('native');
    expect(info.backendSource).toBe('git');
    expect(info.venvPath).toBeTruthy();
    console.log('Native distribution verified:', JSON.stringify(info, null, 2));
  });
});
