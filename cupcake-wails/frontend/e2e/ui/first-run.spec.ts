import { test, expect } from '@playwright/test';
import * as mcp from '../helpers/mcp-client';
import { ADMIN } from '../helpers/admin';

const BACKEND_READY_TIMEOUT = 20 * 60 * 1000;

test.describe.configure({ mode: 'serial' });

test.describe('First run: portable backend setup through the real Wails windows', () => {
  test('MCP server exposes the UI automation tools', async () => {
    const tools = await mcp.listTools();
    for (const tool of ['windows_list', 'js_eval', 'dom_query', 'mouse_click', 'keyboard_type', 'call_bound_method']) {
      expect(tools).toContain(tool);
    }
  });

  test('splash and backend downloader windows open on a clean install', async () => {
    expect(await mcp.waitForWindow('splash', 60000)).toBe(true);
    expect(await mcp.waitForWindow('downloader', 60000)).toBe(true);
    expect(await mcp.getUrl('downloader')).toContain('downloader?type=backend');
  });

  test('downloader lists portable releases', async () => {
    expect(await mcp.waitForElement('.mode-row', 30000, 'downloader')).toBe(true);
    expect(await mcp.clickByText('.mode-row', 'Portable', 'downloader')).toBe(true);
    expect(await mcp.waitForElement('.version-section .select-row', 60000, 'downloader')).toBe(true);
    expect(await mcp.elementExists('.version-section .select-row.active', 'downloader')).toBe(true);
  });

  test('downloading the portable backend starts all services', async () => {
    test.setTimeout(BACKEND_READY_TIMEOUT + 60000);

    await mcp.click('.panel-footer .btn-primary', 'downloader');
    expect(await mcp.waitForElement('.progress-section, .success-bar', 30000, 'downloader')).toBe(true);
    expect(await mcp.elementExists('.error-bar', 'downloader')).toBe(false);

    let downloadError: string | undefined;
    const settled = await mcp.waitFor(async () => {
      downloadError = await mcp.elementText('.error-bar .error-text', 'downloader').catch(() => undefined);
      return !!downloadError || (await mcp.callBoundMethod('main.App.IsBackendReady'));
    }, BACKEND_READY_TIMEOUT, 5000);
    expect(downloadError).toBeUndefined();
    expect(settled).toBe(true);
  });

  test('main window replaces the splash window', async () => {
    expect(await mcp.waitForWindow('main', 60000)).toBe(true);
    expect(await mcp.waitForWindowClosed('splash', 30000)).toBe(true);
  });

  test('backend API answers on the reported port', async () => {
    const port: number = await mcp.callBoundMethod('main.App.GetBackendPort');
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'wrong' }),
    });
    expect(response.status).toBe(401);
  });

  test('superuser window creates the admin account', async () => {
    test.setTimeout(180000);

    expect(await mcp.waitForWindow('superuser', 120000)).toBe(true);
    expect(await mcp.waitForElement('#username', 30000, 'superuser')).toBe(true);

    await mcp.fill('#username', ADMIN.username, 'superuser');
    await mcp.fill('#email', ADMIN.email, 'superuser');
    await mcp.fill('#password', ADMIN.password, 'superuser');
    await mcp.fill('#confirmPassword', ADMIN.password, 'superuser');
    await mcp.click('.panel-footer .btn-primary', 'superuser');

    expect(await mcp.waitForElement('.msg-bar.success', 120000, 'superuser')).toBe(true);
    expect(await mcp.waitForWindowClosed('superuser', 30000)).toBe(true);
  });

  test('admin can log in through the main window', async () => {
    test.setTimeout(180000);

    expect(await mcp.waitForElement('#username', 120000, 'main')).toBe(true);

    await mcp.fill('#username', ADMIN.username, 'main');
    await mcp.fill('#password', ADMIN.password, 'main');
    await mcp.click('button[type="submit"]', 'main');

    const loggedIn = await mcp.waitFor(
      () => mcp.evaluate("return !!localStorage.getItem('ccvAccessToken');", 'main'),
      60000,
      1000,
    );
    expect(loggedIn).toBe(true);

    const leftLogin = await mcp.waitFor(async () => !(await mcp.getUrl('main')).includes('/login'), 30000, 1000);
    expect(leftLogin).toBe(true);
  });
});
