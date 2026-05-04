import { spawn, ChildProcess, execSync } from 'child_process';
import { platform } from 'os';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import * as http from 'http';

interface WailsLauncherOptions {
  binaryPath?: string;
  timeout?: number;
  cleanStart?: boolean;
  testDataDir?: string;
  devMode?: boolean;
  suiteName?: string;
}

interface LaunchResult {
  process: ChildProcess;
  testDataDir: string;
  cdpPort: number;
  devUrl: string;
  cleanup: () => Promise<void>;
  waitForBackend: (timeout?: number) => Promise<boolean>;
}

const DEFAULT_TIMEOUT = 300000;

export function getBinaryPath(): string {
  const envPath = process.env['WAILS_APP_BINARY'];
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const projectRoot = join(__dirname, '..', '..', '..');
  const goos = platform() === 'win32' ? 'windows' : platform() === 'darwin' ? 'darwin' : 'linux';
  const goarch = process.arch === 'x64' ? 'amd64' : process.arch;
  const ext = goos === 'windows' ? '.exe' : '';
  const binaryName = `cupcake-vanilla${ext}`;

  const possiblePaths = [
    join(projectRoot, 'build', 'bin', `${goos}-${goarch}`, binaryName),
    join(projectRoot, 'build', 'bin', binaryName),
    join(projectRoot, binaryName),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  throw new Error(
    `Wails binary not found. Build it first with: ./build.sh release\n` +
    `Searched paths:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}`
  );
}

function getTestDataDir(suiteName?: string): string {
  const baseDir = process.env['HOME'] || process.env['USERPROFILE'] || '/tmp';
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const suffix = suiteName ? `-${suiteName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}` : '';
  return join(baseDir, `.cupcake-test-${uniqueId}${suffix}`);
}

function cleanTestEnvironment(testDataDir: string): void {
  if (existsSync(testDataDir)) {
    try {
      rmSync(testDataDir, { recursive: true, force: true });
    } catch {
      if (platform() === 'win32') {
        execSync(`rmdir /s /q "${testDataDir}"`, { stdio: 'ignore' });
      } else {
        execSync(`rm -rf "${testDataDir}"`, { stdio: 'ignore' });
      }
    }
  }
  mkdirSync(testDataDir, { recursive: true });
}

async function waitForPort(port: number, timeout: number): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { host: 'localhost', port, path: '/api/v1/health', method: 'GET', timeout: 2000 },
          (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`Status ${res.statusCode}`));
            }
            res.resume();
          }
        );
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('timeout')));
        req.end();
      });
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return false;
}

export async function launchWailsApp(options: WailsLauncherOptions = {}): Promise<LaunchResult> {
  const binaryPath = options.binaryPath || getBinaryPath();
  const testDataDir = options.testDataDir || getTestDataDir(options.suiteName);

  if (!existsSync(binaryPath)) {
    throw new Error(`Wails binary not found at: ${binaryPath}`);
  }

  if (options.cleanStart !== false) {
    cleanTestEnvironment(testDataDir);
  }

  const configDir = join(testDataDir, '.config', 'cupcake-vanilla');
  mkdirSync(configDir, { recursive: true });

  const cdpPort = 9222;

  const env = {
    ...process.env,
    HOME: testDataDir,
    XDG_CONFIG_HOME: join(testDataDir, '.config'),
    CUPCAKE_TEST_MODE: 'true',
    DISPLAY: process.env['DISPLAY'] || ':0',
    WEBKIT_INSPECTOR_SERVER: `127.0.0.1:${cdpPort}`,
  };

  const logDir = join(__dirname, '..', '..', 'test-results');
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, 'wails-integration.log');

  const wailsProcess = spawn(binaryPath, [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: platform() !== 'win32',
  });

  const logs: string[] = [];
  logs.push(`[${new Date().toISOString()}] Starting Wails app: ${binaryPath}`);
  logs.push(`[${new Date().toISOString()}] Test data dir: ${testDataDir}`);

  wailsProcess.stdout?.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logs.push(`[stdout] ${line}`);
      writeFileSync(logFile, logs.join('\n'));
    }
  });

  wailsProcess.stderr?.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logs.push(`[stderr] ${line}`);
      writeFileSync(logFile, logs.join('\n'));
    }
  });

  wailsProcess.on('error', (err) => {
    logs.push(`[error] Process error: ${err.message}`);
    writeFileSync(logFile, logs.join('\n'));
  });

  wailsProcess.on('exit', (code, signal) => {
    logs.push(`[exit] Process exited with code ${code}, signal ${signal}`);
    writeFileSync(logFile, logs.join('\n'));
  });

  const cleanup = async (): Promise<void> => {
    logs.push(`[${new Date().toISOString()}] Cleaning up...`);

    if (wailsProcess.pid) {
      if (platform() === 'win32') {
        try {
          execSync(`taskkill /F /T /PID ${wailsProcess.pid}`, { stdio: 'ignore' });
        } catch {
          // Ignore
        }
      } else {
        try {
          process.kill(-wailsProcess.pid, 'SIGTERM');
        } catch {
          try {
            wailsProcess.kill('SIGTERM');
          } catch {
            // Ignore
          }
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    logs.push(`[${new Date().toISOString()}] Removing test data directory: ${testDataDir}`);
    try {
      if (existsSync(testDataDir)) {
        rmSync(testDataDir, { recursive: true, force: true });
        logs.push(`[${new Date().toISOString()}] Test data directory removed successfully`);
      }
    } catch (err) {
      logs.push(`[${new Date().toISOString()}] Warning: Failed to remove test data directory: ${err}`);
      if (platform() === 'win32') {
        try {
          execSync(`rmdir /s /q "${testDataDir}"`, { stdio: 'ignore' });
        } catch {
          // Ignore
        }
      } else {
        try {
          execSync(`rm -rf "${testDataDir}"`, { stdio: 'ignore' });
        } catch {
          // Ignore
        }
      }
    }

    writeFileSync(logFile, logs.join('\n'));
  };

  const waitForBackend = async (timeout = DEFAULT_TIMEOUT): Promise<boolean> => {
    logs.push(`[${new Date().toISOString()}] Waiting for backend to be ready...`);
    const result = await waitForPort(8000, timeout);
    logs.push(`[${new Date().toISOString()}] Backend ready: ${result}`);
    writeFileSync(logFile, logs.join('\n'));
    return result;
  };

  process.on('exit', () => {
    cleanup().catch(() => {});
  });
  process.on('SIGINT', () => {
    cleanup().catch(() => {});
  });
  process.on('SIGTERM', () => {
    cleanup().catch(() => {});
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    process: wailsProcess,
    testDataDir,
    cdpPort,
    devUrl: `http://localhost:${cdpPort}`,
    cleanup,
    waitForBackend,
  };
}

export async function createSuperuserViaApi(
  backendUrl: string,
  username: string,
  email: string,
  password: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ username, email, password });
    const url = new URL('/api/v1/auth/create-superuser/', backendUrl);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 8000,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      },
      (res) => {
        resolve(res.statusCode === 201 || res.statusCode === 200);
        res.resume();
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(postData);
    req.end();
  });
}

export async function loginViaApi(
  backendUrl: string,
  username: string,
  password: string
): Promise<{ success: boolean; token?: string }> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ username, password });
    const url = new URL('/api/v1/auth/login/', backendUrl);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 8000,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              resolve({ success: true, token: json.access_token || json.access || json.token || json.key });
            } catch {
              resolve({ success: false });
            }
          } else {
            resolve({ success: false });
          }
        });
      }
    );

    req.on('error', () => resolve({ success: false }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
    req.write(postData);
    req.end();
  });
}
