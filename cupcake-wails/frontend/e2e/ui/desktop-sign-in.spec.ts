import { expect, test } from '@playwright/test';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

import { IsolatedApp, launchIsolated, listeningAddresses, processRunning, provisionBackend } from '../helpers/isolated-app';
import * as mcp from '../helpers/mcp-client';
import { captureWindow } from '../helpers/screenshots';

const BINARY = process.env['WAILS_APP_BINARY'] ?? '';
const BACKEND_SOURCE = process.env['CUPCAKE_BACKEND_SOURCE'] ?? '';
const BACKEND_PYTHON = process.env['CUPCAKE_BACKEND_PYTHON'] ?? '';
const CONFIG_HOME = process.env['APP_CONFIG_HOME'] ?? join(process.cwd(), 'test-results', 'desktop-sign-in-home');
const DISPLAY = Number(process.env['APP_DISPLAY'] ?? 97);
const WAILS_CONFIG = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'wails.json'), 'utf8'));
const APP_NAME: string = WAILS_CONFIG.name;
const MAIN_TITLE: string = WAILS_CONFIG.info.productName;
const LINEUP = `${APP_NAME}-desktop`;
const STARTUP_TIMEOUT = 10 * 60 * 1000;
const DECOY = `cupcake-decoy-${process.pid}`;
const OWNER = { username: 'bench-owner', email: 'owner@lab.example.org', password: 'correct-horse-battery' };

test.describe.configure({ mode: 'serial' });
test.skip(!BINARY || !BACKEND_SOURCE || !BACKEND_PYTHON, 'set WAILS_APP_BINARY, CUPCAKE_BACKEND_SOURCE and CUPCAKE_BACKEND_PYTHON');

let app: IsolatedApp;
let listeningBefore = new Set<string>();

async function start(decoys = false): Promise<void> {
  app = launchIsolated(BINARY, CONFIG_HOME, DISPLAY, decoys ? DECOY : '');
  expect(await mcp.waitFor(async () => {
    try {
      return await mcp.callBoundMethod('main.App.IsBackendReady');
    } catch {
      return false;
    }
  }, STARTUP_TIMEOUT, 3000)).toBe(true);
  expect(await mcp.waitForWindow('main', 60000)).toBe(true);
}

async function mainState(): Promise<{ hash: string; signedIn: boolean }> {
  return mcp.evaluate(
    `return { hash: location.hash, signedIn: !!localStorage.getItem('ccvAccessToken') && !location.hash.includes('login') };`,
    'main',
  );
}

async function reloadMain(): Promise<void> {
  await mcp.evaluate('location.reload(); return true;', 'main').catch(() => undefined);
  await mcp.waitFor(async () => {
    try {
      return (await mcp.evaluate('return document.readyState;', 'main')) === 'complete';
    } catch {
      return false;
    }
  }, 30000, 500);
}

async function captureClean(window: string, title: string, name: string, caption: string): Promise<void> {
  await mcp.evaluate(
    `const cursor = document.getElementById('__wails-mcp-cursor'); if (cursor) cursor.style.display = 'none'; document.activeElement?.blur?.(); return true;`,
    window,
  );
  await new Promise(resolve => setTimeout(resolve, 800));
  captureWindow(DISPLAY, title, LINEUP, name, caption);
}

function refreshTokenDays(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return (payload.exp - payload.iat) / 86400;
}

test.describe('Desktop app: local-only backend and sign-in choices', () => {
  test.beforeAll(() => {
    provisionBackend(CONFIG_HOME, BINARY, BACKEND_SOURCE, BACKEND_PYTHON);
  });

  test.afterAll(() => {
    app?.stop();
  });

  test('a first launch starts every service without touching other programs', async () => {
    test.setTimeout(STARTUP_TIMEOUT + 120000);
    listeningBefore = listeningAddresses();
    await start(true);
    for (const decoy of ['rqworker', 'valkey-server', 'uvicorn']) {
      expect(processRunning(`${decoy}.*${DECOY}`), `the ${decoy} decoy was stopped`).toBe(true);
    }
  });

  test('the backend, Redis and every other port the app opened listen only on this computer', async () => {
    const port: number = await mcp.callBoundMethod('main.App.GetBackendPort');
    const opened = [...listeningAddresses()].filter(address => !listeningBefore.has(address));
    expect(opened).toContain(`127.0.0.1:${port}`);
    expect(opened.length).toBeGreaterThanOrEqual(2);
    expect(opened.filter(address => !address.startsWith('127.0.0.1:') && !address.startsWith('[::1]:'))).toEqual([]);
    const records = JSON.parse(readFileSync(join(app.dataDir, 'processes.json'), 'utf8')) as { type: string }[];
    expect(records.map(record => record.type).sort()).toEqual(['django', 'redis', 'rqworker']);
  });

  test('the signing key is kept, readable only by its owner', () => {
    const key = join(app.dataDir, 'backend', 'cupcake-vanilla', 'secret_key');
    expect(statSync(key).mode & 0o777).toBe(0o600);
    expect(readFileSync(key, 'utf8').trim().length).toBeGreaterThanOrEqual(64);
  });

  test('creating the admin account and choosing automatic sign-in', async () => {
    expect(await mcp.waitForWindow('superuser', 60000)).toBe(true);
    await mcp.fill('#username', OWNER.username, 'superuser');
    await mcp.fill('#email', OWNER.email, 'superuser');
    await mcp.fill('#password', OWNER.password, 'superuser');
    await mcp.fill('#confirmPassword', OWNER.password, 'superuser');
    await mcp.click('#signInAutomatically', 'superuser');
    expect(await mcp.evaluate(`return document.querySelector('#signInAutomatically').checked;`, 'superuser')).toBe(true);
    await captureClean('superuser', 'Create Admin Account', 'first-run-admin-account', 'Creating the admin account on first launch, with automatic sign-in');
    await mcp.click('.panel-footer .btn-primary', 'superuser');
    expect(await mcp.waitForWindowClosed('superuser', 120000)).toBe(true);
    const settings = await mcp.callBoundMethod('main.App.GetSignInSettings');
    expect(settings).toEqual(expect.objectContaining({ mode: 'automatic', username: OWNER.username }));
  });

  test('the main window opens signed in', async () => {
    await reloadMain();
    expect(await mcp.waitFor(async () => (await mainState()).signedIn, 30000, 1000)).toBe(true);
    expect(await mcp.waitForElement('router-outlet + *', 30000, 'main')).toBe(true);
    await captureClean('main', MAIN_TITLE, 'main-signed-in-automatically', `${MAIN_TITLE} opened and signed in automatically`);
  });

  test('automatic sign-in survives restarting the app', async () => {
    test.setTimeout(STARTUP_TIMEOUT + 60000);
    app.stop();
    await start();
    expect(await mcp.waitFor(async () => (await mainState()).signedIn, 60000, 1000)).toBe(true);
  });

  test('switching to the login screen with a 7 day sign-in', async () => {
    await mcp.callBoundMethod('main.App.OpenSignInPanel');
    expect(await mcp.waitForWindow('sign-in', 30000)).toBe(true);
    expect(await mcp.waitForElement('.choice[data-mode="login"]', 30000, 'sign-in')).toBe(true);
    await mcp.click('.choice[data-mode="login"] input[type="radio"]', 'sign-in');
    await mcp.evaluate(
      `const select = document.querySelector('#sessionDays'); select.value = '7'; select.dispatchEvent(new Event('change', { bubbles: true })); return true;`,
      'sign-in',
    );
    await captureClean('sign-in', 'Sign-in', 'sign-in-window', 'Choosing the login screen and how long a sign-in lasts');
    await mcp.click('.panel-footer .btn-primary', 'sign-in');
    expect(await mcp.waitForElement('.msg-bar.success', 120000, 'sign-in')).toBe(true);
    const settings = await mcp.callBoundMethod('main.App.GetSignInSettings');
    expect(settings).toEqual(expect.objectContaining({ mode: 'login', sessionDays: 7 }));
    await mcp.click('.panel-footer .btn-outline', 'sign-in').catch(() => undefined);
    expect(await mcp.waitForWindowClosed('sign-in', 30000)).toBe(true);
  });

  test('the main window asks for a login, and a sign-in lasts exactly 7 days', async () => {
    await mcp.evaluate(`localStorage.removeItem('ccvAccessToken'); localStorage.removeItem('ccvRefreshToken'); return true;`, 'main');
    await reloadMain();
    expect(await mcp.waitForElement('#username', 60000, 'main')).toBe(true);
    await captureClean('main', MAIN_TITLE, 'main-login-screen', 'The login screen when automatic sign-in is off');
    await mcp.fill('#username', OWNER.username, 'main');
    await mcp.fill('#password', OWNER.password, 'main');
    await mcp.click('button[type="submit"]', 'main');
    expect(await mcp.waitFor(async () => (await mainState()).signedIn, 30000, 1000)).toBe(true);
    const refresh: string = await mcp.evaluate(`return localStorage.getItem('ccvRefreshToken');`, 'main');
    expect(refreshTokenDays(refresh)).toBeCloseTo(7, 3);
  });

  test('a sign-in from the login screen survives restarting the app', async () => {
    test.setTimeout(STARTUP_TIMEOUT + 60000);
    app.stop();
    await start();
    await reloadMain();
    expect(await mcp.waitFor(async () => (await mainState()).signedIn, 60000, 1000)).toBe(true);
    expect((await mainState()).hash).not.toContain('login');
  });
});
