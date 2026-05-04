import { test, expect } from '@playwright/test';
import { launchWailsApp } from './wails-launcher';
import { ChildProcess } from 'child_process';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

const TEST_API_URL = 'http://localhost:9999';
const SETUP_TIMEOUT = 600000;

let wailsProcess: ChildProcess;
let cleanupFn: () => Promise<void>;
let testDataDir: string;

async function callTestAPI(apiPath: string, method = 'GET', body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath, TEST_API_URL);
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
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });

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

test.describe.configure({ mode: 'serial', timeout: SETUP_TIMEOUT });

test.describe('Database Import / Export round-trip', () => {
  test.beforeAll(async () => {
    const result = await launchWailsApp({ cleanStart: true });
    wailsProcess = result.process;
    cleanupFn = result.cleanup;
    testDataDir = result.testDataDir;

    const apiReady = await waitForTestAPI(30000);
    if (!apiReady) {
      throw new Error('Test API did not become ready in time');
    }
  });

  test.afterAll(async () => {
    if (cleanupFn) await cleanupFn().catch(() => {});
  });

  test('test API is reachable', async () => {
    const health = await callTestAPI('/test/health');
    expect(health.status).toBe('ok');
  });

  test('seed: write a pre-built initial database file', async () => {
    const seedDir = path.join(os.tmpdir(), 'cupcake-import-test');
    const result = await callTestAPI('/test/backup/seed-initial-database', 'POST', {
      destPath: seedDir,
      content: 'SQLite format 3\x00integration-test-pre-built-db',
    });

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();
    expect(result.size).toBeGreaterThan(0);

    console.log(`Seeded pre-built database at: ${result.path} (${result.size} bytes)`);
  });

  test('import: load the pre-built database into the app', async () => {
    const seedDir = path.join(os.tmpdir(), 'cupcake-import-test');
    const seedPath = path.join(seedDir, 'test-initial.sqlite3');

    const result = await callTestAPI('/test/backup/import-initial-database', 'POST', {
      filePath: seedPath,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Initial database imported');
    console.log(`Import result backendDir: ${result.backendDir}`);
  });

  test('export: create a database backup after import', async () => {
    const listBefore = await callTestAPI('/test/backup/list');
    const countBefore = (listBefore.backups as any[]).filter(b => b.type === 'database').length;

    const backupResult = await callTestAPI('/test/backup/create-database', 'POST');
    expect(backupResult.success).toBe(true);

    const listAfter = await callTestAPI('/test/backup/list');
    const countAfter = (listAfter.backups as any[]).filter(b => b.type === 'database').length;

    expect(countAfter).toBeGreaterThan(countBefore);
    console.log(`Database backups: ${countBefore} -> ${countAfter}`);
  });

  test('list: exported backup appears in backup list', async () => {
    const listResult = await callTestAPI('/test/backup/list');
    expect(listResult.count).toBeGreaterThan(0);

    const dbBackups = (listResult.backups as any[]).filter(b => b.type === 'database');
    expect(dbBackups.length).toBeGreaterThan(0);

    const latest = dbBackups[0];
    expect(latest.name).toBeTruthy();
    expect(latest.path).toBeTruthy();
    expect(latest.size).toBeGreaterThan(0);
    console.log(`Latest backup: ${latest.name} (${latest.size} bytes)`);
  });

  test('import-from-export: re-import the exported backup into the app', async () => {
    const listResult = await callTestAPI('/test/backup/list');
    const dbBackups = (listResult.backups as any[]).filter(b => b.type === 'database');
    expect(dbBackups.length).toBeGreaterThan(0);

    const exportedBackup = dbBackups[0];
    console.log(`Re-importing from exported backup: ${exportedBackup.path}`);

    const importResult = await callTestAPI('/test/backup/import-initial-database', 'POST', {
      filePath: exportedBackup.path,
    });

    expect(importResult.success).toBe(true);
    expect(importResult.message).toBe('Initial database imported');
  });

  test('cleanup: delete the exported backup', async () => {
    const listResult = await callTestAPI('/test/backup/list');
    const dbBackups = (listResult.backups as any[]).filter(b => b.type === 'database');

    for (const backup of dbBackups) {
      const deleteResult = await callTestAPI('/test/backup/delete', 'POST', {
        path: backup.path,
      });
      expect(deleteResult.success).toBe(true);
    }

    const listAfter = await callTestAPI('/test/backup/list');
    const remaining = (listAfter.backups as any[]).filter(b => b.type === 'database');
    expect(remaining.length).toBe(0);
  });
});
