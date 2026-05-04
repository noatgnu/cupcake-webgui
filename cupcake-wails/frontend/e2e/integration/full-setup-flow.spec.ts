import { test, expect, chromium, Browser, Page, BrowserContext } from '@playwright/test';
import { launchWailsApp } from './wails-launcher';
import { ChildProcess } from 'child_process';
import * as http from 'http';

const BACKEND_URL = 'http://localhost:8000';
const TEST_API_URL = 'http://localhost:9999';
const SETUP_TIMEOUT = 600000;
const SUPERUSER = {
  username: 'integrationtest',
  email: 'integration@test.com',
  password: 'IntegrationTest123!',
};

let wailsProcess: ChildProcess;
let cleanupFn: () => Promise<void>;
let testDataDir: string;

async function callTestAPI(path: string, method = 'GET', body?: any): Promise<any> {
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
      const result = await callTestAPI('/test/health');
      if (result.status === 'ok') return true;
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
      const result = await callTestAPI('/test/backend-ready');
      if (result.ready) return true;
    } catch {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return false;
}

test.describe.configure({ mode: 'serial', timeout: SETUP_TIMEOUT });

test.describe('Full Integration: Complete Setup to Main App', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    console.log('Launching Wails app with clean environment...');

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

    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({ ignoreHTTPSErrors: true });
  });

  test.afterAll(async () => {
    console.log('Cleaning up...');
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (cleanupFn) await cleanupFn().catch(() => {});
  });

  test('step 1: wails app and test API are running', async () => {
    expect(wailsProcess.pid).toBeDefined();
    expect(wailsProcess.killed).toBe(false);

    const health = await callTestAPI('/test/health');
    expect(health.status).toBe('ok');

    console.log(`Wails process PID: ${wailsProcess.pid}`);
  });

  test('step 2: detect Python candidates', async () => {
    const candidates = await callTestAPI('/test/python-candidates');
    console.log(`Found ${candidates.length} Python candidates`);

    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);

    for (const candidate of candidates) {
      console.log(`  - ${candidate.path} (${candidate.version})`);
    }
  });

  test('step 3: get available releases', async () => {
    const releases = await callTestAPI('/test/available-releases');
    console.log(`Found ${releases.length} releases`);

    expect(Array.isArray(releases)).toBe(true);
    expect(releases.length).toBeGreaterThan(0);
  });

  test('step 4: download portable backend', async () => {
    console.log('Starting portable backend download...');

    const releases = await callTestAPI('/test/available-releases');
    console.log('Available releases:', releases.map((r: any) => r.tag).join(', '));

    const latestRelease = releases[0];
    console.log(`Downloading version: ${latestRelease.tag}`);

    await callTestAPI('/test/download-portable', 'POST', {
      version: latestRelease.tag,
    });

    console.log('Portable backend download started, waiting for services to start...');
  });

  test('step 5: wait for backend services to start', async () => {
    console.log('Waiting for all services to start (this may take several minutes)...');

    const maxWaitTime = 300000;
    const startTime = Date.now();
    let ready = false;

    while (Date.now() - startTime < maxWaitTime) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      try {
        const result = await callTestAPI('/test/backend-ready');
        if (result.ready) {
          ready = true;
          console.log('Backend is ready!');
          break;
        }
      } catch {
        // Ignore
      }

      if (elapsed % 30 === 0) {
        console.log(`Waiting... ${elapsed}s elapsed`);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    expect(ready).toBe(true);
  });

  test('step 6: backend API is accessible', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/v1/users/auth_config/`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    console.log('Backend auth config:', JSON.stringify(data));
  });

  test('step 7: create superuser via UI', async () => {
    page = await context.newPage();

    console.log('Navigating to main app to trigger superuser creation modal...');
    await page.goto(BACKEND_URL, { waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForTimeout(2000);

    const superuserModal = page.locator('.modal-overlay, [class*="superuser"], [class*="admin-account"]');
    const modalVisible = await superuserModal.isVisible().catch(() => false);

    if (modalVisible) {
      console.log('Superuser creation modal detected, filling form...');

      await page.fill('#username, input[id="username"]', SUPERUSER.username);
      await page.fill('#email, input[id="email"]', SUPERUSER.email);
      await page.fill('#password, input[id="password"]', SUPERUSER.password);
      await page.fill('#confirmPassword, input[id="confirmPassword"]', SUPERUSER.password);

      await page.click('button:has-text("Create Account"), button:has-text("Create")');

      await page.waitForTimeout(3000);
      console.log(`Superuser created via UI: ${SUPERUSER.username}`);
    } else {
      console.log('No superuser modal visible, creating via Test API...');
      const result = await callTestAPI('/test/create-superuser', 'POST', {
        username: SUPERUSER.username,
        email: SUPERUSER.email,
        password: SUPERUSER.password,
      });
      expect(result.success).toBe(true);
      console.log(`Superuser created via API: ${SUPERUSER.username}`);
    }
  });

  test('step 8: login via backend API', async ({ request }) => {
    console.log('Testing login through Django REST API...');

    const response = await request.post(`${BACKEND_URL}/api/v1/auth/login/`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        username: SUPERUSER.username,
        password: SUPERUSER.password,
      },
    });

    console.log(`Login API response: ${response.status()}`);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    console.log(`Login response keys: ${Object.keys(data).join(', ')}`);

    expect(data.access_token || data.access).toBeTruthy();
    expect(data.refresh_token || data.refresh).toBeTruthy();

    console.log('Login API test successful - tokens received');
  });

  test('step 9: verify authenticated user info', async ({ request }) => {
    console.log('Getting auth token...');

    const loginResponse = await request.post(`${BACKEND_URL}/api/v1/auth/login/`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        username: SUPERUSER.username,
        password: SUPERUSER.password,
      },
    });

    const loginData = await loginResponse.json();
    const accessToken = loginData.access_token || loginData.access;

    console.log('Fetching current user info...');
    const userResponse = await request.get(`${BACKEND_URL}/api/v1/users/current/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    console.log(`User info response: ${userResponse.status()}`);
    expect(userResponse.ok()).toBe(true);

    const userData = await userResponse.json();
    console.log(`Logged in as: ${userData.username}`);
    expect(userData.username).toBe(SUPERUSER.username);
  });

  test('step 10: authenticated API - list metadata tables', async ({ request }) => {
    const loginResponse = await request.post(`${BACKEND_URL}/api/v1/auth/login/`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        username: SUPERUSER.username,
        password: SUPERUSER.password,
      },
    });

    const loginData = await loginResponse.json();
    const accessToken = loginData.access_token || loginData.access;

    console.log('Fetching metadata tables...');
    const response = await request.get(`${BACKEND_URL}/api/v1/metadata-tables/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    console.log(`Metadata tables API response: ${response.status()}`);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    console.log(`Metadata tables found: ${data.results ? data.results.length : 0}`);
  });

  test('step 11: list column templates via API', async ({ request }) => {
    const loginResponse = await request.post(`${BACKEND_URL}/api/v1/auth/login/`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        username: SUPERUSER.username,
        password: SUPERUSER.password,
      },
    });

    const loginData = await loginResponse.json();
    const accessToken = loginData.access_token || loginData.access;

    console.log('Fetching column templates...');
    const response = await request.get(`${BACKEND_URL}/api/v1/metadata-column-templates/?limit=10`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    console.log(`Column templates API response: ${response.status()}`);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    console.log(`Column templates found: ${data.results ? data.results.length : data.count || 0}`);
  });

  test('step 12: distribution info is correct', async () => {
    const info = await callTestAPI('/test/distribution-info');

    expect(info.backendExists).toBe(true);
    expect(info.isPortable).toBe(true);
    expect(info.distributionType).toBe('portable');

    console.log('Distribution info:', JSON.stringify(info, null, 2));
  });
});
