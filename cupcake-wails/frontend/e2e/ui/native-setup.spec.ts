import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import * as mcp from '../helpers/mcp-client';

const BACKEND_READY_TIMEOUT = 25 * 60 * 1000;

interface DistributionInfo {
  distributionType: string;
  backendSource: string;
  pythonPath: string;
  venvPath: string;
  isPortable: boolean;
  backendExists: boolean;
}

test.describe.configure({ mode: 'serial' });

test.describe('First run: native backend provisioned with uv-managed Python', () => {
  test('backend downloader opens on a clean install', async () => {
    expect(await mcp.waitForWindow('downloader', 60000)).toBe(true);
    expect(await mcp.waitForElement('.mode-row', 30000, 'downloader')).toBe(true);
  });

  test('native mode offers the uv-managed Python first and selects it', async () => {
    expect(await mcp.clickByText('.mode-row', 'Native', 'downloader')).toBe(true);
    expect(await mcp.waitForElement('.python-section .select-row', 60000, 'downloader')).toBe(true);
    expect(await mcp.waitForElement('.branch-section .select-row.active', 60000, 'downloader')).toBe(true);

    const firstPython = await mcp.elementText('.python-section .select-row', 'downloader');
    expect(firstPython).toContain('Installed by uv');
    expect(await mcp.elementText('.python-section .select-row.active', 'downloader')).toContain('Installed by uv');
  });

  test('provisioning installs Python with uv and starts all services', async () => {
    test.setTimeout(BACKEND_READY_TIMEOUT + 60000);

    await mcp.click('.panel-footer .btn-primary', 'downloader');
    expect(await mcp.waitForElement('.progress-section, .success-bar', 30000, 'downloader')).toBe(true);

    let downloadError: string | undefined;
    const settled = await mcp.waitFor(async () => {
      downloadError = await mcp.elementText('.error-bar .error-text', 'downloader').catch(() => undefined);
      return !!downloadError || (await mcp.callBoundMethod('main.App.IsBackendReady'));
    }, BACKEND_READY_TIMEOUT, 5000);
    expect(downloadError).toBeUndefined();
    expect(settled).toBe(true);
  });

  test('configuration records a native install built on the uv-managed interpreter', async () => {
    const info: DistributionInfo = await mcp.callBoundMethod('main.App.GetDistributionInfo');
    expect(info.distributionType).toBe('native');
    expect(info.isPortable).toBe(false);
    expect(info.backendExists).toBe(true);
    expect(info.venvPath).toBeTruthy();

    const logPath: string = await mcp.callBoundMethod('main.App.GetLogFilePath');
    const readyLine = readFileSync(logPath, 'utf8')
      .split('\n')
      .find(line => line.includes('[PythonManager]') && line.includes('ready at'));
    expect(readyLine, 'uv should report where it installed Python').toBeTruthy();
    expect(readyLine!.replace(/\\/g, '/')).toContain('/uv/python/');
  });

  test('main window opens and the backend API answers', async () => {
    expect(await mcp.waitForWindow('main', 60000)).toBe(true);

    const port: number = await mcp.callBoundMethod('main.App.GetBackendPort');
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'wrong' }),
    });
    expect(response.status).toBe(401);
  });
});
