import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserWindow, ipcMain, dialog } from 'electron';
import { RedisManager } from './RedisManager';

export interface BackendStatus {
  service: string;
  status: 'starting' | 'ready' | 'error';
  message: string;
}

export interface LogMessage {
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

interface ProcessTracking {
  pid: number;
  type: 'django' | 'rqworker' | 'redis';
  timestamp: number;
}

export class BackendManager {
  private backendProcess: ChildProcess | null = null;
  private rqWorkerProcess: ChildProcess | null = null;
  private backendPort: number = 8000;
  private userDataPath: string;
  private isDev: boolean;
  private splashWindow: BrowserWindow | null = null;
  private outputListeners: Array<(data: string) => void> = [];
  private redisManager: RedisManager;
  private pidFilePath: string;

  constructor(userDataPath: string, isDev: boolean) {
    this.userDataPath = userDataPath;
    this.isDev = isDev;
    this.pidFilePath = path.join(this.userDataPath, 'cupcake-processes.json');
    this.redisManager = new RedisManager({
      userDataPath: this.userDataPath,
      isDev: this.isDev
    });
    this.redisManager.setLogCallback((message, type) => {
      this.sendBackendLog(`redis: ${message}`, type || 'info');
    });
  }

  private getTrackedProcesses(): ProcessTracking[] {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        const data = fs.readFileSync(this.pidFilePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading PID file:', error);
    }
    return [];
  }

  private saveTrackedProcesses(processes: ProcessTracking[]): void {
    try {
      fs.writeFileSync(this.pidFilePath, JSON.stringify(processes, null, 2));
    } catch (error) {
      console.error('Error saving PID file:', error);
    }
  }

  private addTrackedProcess(pid: number, type: 'django' | 'rqworker' | 'redis'): void {
    const processes = this.getTrackedProcesses();
    processes.push({ pid, type, timestamp: Date.now() });
    this.saveTrackedProcesses(processes);
    console.log(`Tracked ${type} process with PID ${pid}`);
  }

  private removeTrackedProcess(pid: number): void {
    const processes = this.getTrackedProcesses().filter(p => p.pid !== pid);
    this.saveTrackedProcesses(processes);
  }

  private clearTrackedProcesses(): void {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        fs.unlinkSync(this.pidFilePath);
      }
    } catch (error) {
      console.error('Error clearing PID file:', error);
    }
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  private getProcessCommandLine(pid: number): string {
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        const result = execSync(`wmic process where ProcessId=${pid} get CommandLine`, { encoding: 'utf8' });
        return result.trim();
      } else {
        const result = execSync(`ps -p ${pid} -o args=`, { encoding: 'utf8' });
        return result.trim();
      }
    } catch (error) {
      return '';
    }
  }

  setSplashWindow(splashWindow: BrowserWindow) {
    this.splashWindow = splashWindow;
  }

  private sendBackendStatus(service: string, status: 'starting' | 'ready' | 'error', message: string): void {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      this.splashWindow.webContents.send('backend-status', { service, status, message });
    }
  }

  private sendBackendLog(message: string, type: string = 'info'): void {
    if (this.splashWindow && !this.splashWindow.isDestroyed()) {
      this.splashWindow.webContents.send('backend-log', { message, type });
    }
  }

  private getDjangoEnvironment(): NodeJS.ProcessEnv {
    const redisEnv = this.redisManager.getEnvironmentVariables();
    return {
      ...process.env,
      DJANGO_SETTINGS_MODULE: 'cupcake_vanilla.settings_electron',
      ELECTRON_APP_DATA: this.userDataPath,
      ELECTRON_STATIC_ROOT: path.join(this.userDataPath, 'static'),
      ELECTRON_MEDIA_ROOT: path.join(this.userDataPath, 'media'),
      ELECTRON_DEBUG: this.isDev ? 'true' : 'false',
      ENABLE_CUPCAKE_MACARON: 'true',
      ENABLE_CUPCAKE_MINT_CHOCOLATE: 'false',
      ENABLE_CUPCAKE_SALTED_CARAMEL: 'true',
      ENABLE_CUPCAKE_RED_VELVET: 'true',
      PYTHONUNBUFFERED: '1',
      ...redisEnv
    };
  }

  private getCommandAndArgs(backendDir: string, venvPython: string, scriptArgs: string[]): { command: string; args: string[] } {
    const runScript = process.platform === 'win32' ? 'run.bat' : 'run.sh';
    const runScriptPath = path.join(backendDir, runScript);

    if (fs.existsSync(runScriptPath)) {
      if (process.platform === 'win32') {
        return {
          command: 'cmd.exe',
          args: ['/c', runScriptPath, ...scriptArgs]
        };
      } else {
        return {
          command: runScriptPath,
          args: scriptArgs
        };
      }
    } else {
      return {
        command: venvPython,
        args: scriptArgs
      };
    }
  }

  private classifyProcessOutput(output: string, isStderr: boolean = false): 'info' | 'warning' | 'error' | 'success' {
    const lowerOutput = output.toLowerCase();

    if (lowerOutput.includes('error:') ||
        lowerOutput.includes('exception') ||
        lowerOutput.includes('traceback') ||
        lowerOutput.includes('failed') ||
        lowerOutput.includes('critical:')) {
      return 'error';
    }

    if (lowerOutput.includes('watching for file changes') ||
        lowerOutput.includes('performing system checks') ||
        lowerOutput.includes('system check identified no issues') ||
        lowerOutput.includes('starting development server') ||
        lowerOutput.includes('quit the server') ||
        lowerOutput.includes('django version') ||
        lowerOutput.includes('autoreload') ||
        lowerOutput.includes('listening at:') ||
        lowerOutput.includes('using worker:') ||
        lowerOutput.includes('booting worker') ||
        lowerOutput.includes('application startup complete') ||
        lowerOutput.includes('started server process') ||
        lowerOutput.includes('waiting for application startup')) {
      return 'info';
    }

    if (lowerOutput.includes('worker') && lowerOutput.includes('started with pid') ||
        lowerOutput.includes('*** listening on') ||
        lowerOutput.includes('worker rq:worker:') ||
        lowerOutput.includes('cleaning registries') ||
        lowerOutput.includes('subscribing to channel') ||
        lowerOutput.includes('worker registered successfully')) {
      return 'info';
    }

    if (lowerOutput.includes('warning:') ||
        lowerOutput.includes('deprecated') ||
        lowerOutput.includes('ignore')) {
      return 'warning';
    }

    if (lowerOutput.includes('successfully') ||
        lowerOutput.includes('completed') ||
        lowerOutput.includes('ready') ||
        lowerOutput.includes('started')) {
      return 'success';
    }

    return isStderr ? 'warning' : 'info';
  }

  async runMigrations(backendDir: string, venvPython: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sendBackendStatus('migrations', 'starting', 'Running Django migrations...');
      this.sendBackendLog('Running Django migrations...');

      const { command, args } = this.getCommandAndArgs(backendDir, venvPython, ['manage.py', 'migrate']);

      const migrationsProcess = spawn(command, args, {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment()
      });

      migrationsProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        this.sendBackendLog(`migrations: ${output}`, 'info');
      });

      migrationsProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        const messageType = this.classifyProcessOutput(output, true);
        this.sendBackendLog(`migrations: ${output}`, messageType);
      });

      migrationsProcess.on('close', (code) => {
        if (code === 0) {
          this.sendBackendStatus('migrations', 'ready', 'Migrations completed');
          this.sendBackendLog('Django migrations completed successfully', 'success');
        } else {
          this.sendBackendLog(`Migrations failed with exit code ${code}`, 'error');
          this.sendBackendStatus('migrations', 'error', 'Migrations failed');
        }
        resolve();
      });

      migrationsProcess.on('error', (error) => {
        this.sendBackendLog(`Migrations error: ${error.message}`, 'error');
        this.sendBackendStatus('migrations', 'error', 'Migrations failed');
        resolve();
      });
    });
  }

  async runDjangoShellCommand(backendDir: string, venvPython: string, pythonCode: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const { command, args } = this.getCommandAndArgs(backendDir, venvPython, ['manage.py', 'shell', '-c', pythonCode]);

      const shellProcess = spawn(command, args, {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment()
      });

      let output = '';
      let errorOutput = '';

      shellProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      shellProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      shellProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Django shell command failed with code ${code}: ${errorOutput}`));
        }
      });

      shellProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async startRedisServer(): Promise<void> {
    try {
      this.sendBackendStatus('redis', 'starting', 'Starting Redis server...');
      this.sendBackendLog('Cleaning up orphaned Redis/Valkey processes...');
      await this.redisManager.killOrphanedProcesses();
      this.sendBackendLog('Starting Redis server...');
      await this.redisManager.startRedis();

      const redisPid = this.redisManager.getRedisPid();
      if (redisPid) {
        this.addTrackedProcess(redisPid, 'redis');
      }

      this.sendBackendStatus('redis', 'ready', 'Redis server started successfully');
      this.sendBackendLog('Redis server ready', 'success');
    } catch (error) {
      if (error.message === 'REDIS_NOT_FOUND_WINDOWS') {
        throw new Error('REDIS_NOT_FOUND_WINDOWS');
      }
      this.sendBackendStatus('redis', 'error', `Redis server failed: ${error.message}`);
      this.sendBackendLog(`Redis server error: ${error.message}`, 'error');
      throw error;
    }
  }

  getRedisManager() {
    return this.redisManager;
  }

  async collectStaticFiles(backendDir: string, venvPython: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sendBackendStatus('collectstatic', 'starting', 'Collecting static files...');
      this.sendBackendLog('Running collectstatic to gather Django static files...');

      const collectStaticProcess = spawn(venvPython, ['manage.py', 'collectstatic', '--noinput'], {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment()
      });

      collectStaticProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        this.sendBackendLog(`collectstatic: ${output}`, 'info');
        this.sendBackendStatus('collectstatic', 'ready', 'Static files collected successfully');
      });

      collectStaticProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        const messageType = this.classifyProcessOutput(output, true);
        this.sendBackendLog(`collectstatic: ${output}`, messageType);
      });

      collectStaticProcess.on('close', (code) => {
        this.sendBackendLog('Static files collection completed', 'success');
        this.sendBackendStatus('collectstatic', 'ready', 'Static files collected');
        resolve();
      });

      collectStaticProcess.on('error', (error) => {
        this.sendBackendLog(`Static files collection error: ${error.message}`, 'error');
        resolve();
      });
    });
  }

  async startDjangoServer(backendDir: string, venvPython: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sendBackendStatus('django', 'starting', 'Starting Django server with Gunicorn...');
      this.sendBackendLog('Starting Django server with Gunicorn...');

      this.backendPort = 8000;

      const { command, args } = this.getCommandAndArgs(backendDir, venvPython, [
        '-m', 'gunicorn',
        'cupcake_vanilla.asgi_electron:application',
        '--bind', `127.0.0.1:${this.backendPort}`,
        '--worker-class', 'uvicorn.workers.UvicornWorker',
        '--workers', '1',
        '--timeout', '120',
        '--access-logfile', '-',
        '--error-logfile', '-'
      ]);

      this.backendProcess = spawn(command, args, {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment(),
        detached: process.platform !== 'win32'
      });

      if (this.backendProcess.pid) {
        this.addTrackedProcess(this.backendProcess.pid, 'django');
      }

      let serverStarted = false;

      this.backendProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        this.sendBackendLog(`gunicorn: ${output}`);
        this.notifyOutputListeners(`gunicorn: ${output}`);

        if (!serverStarted && (output.includes('Listening at:') || output.includes('Using worker:'))) {
          serverStarted = true;
          this.sendBackendStatus('django', 'ready', `Server running on port ${this.backendPort}`);
          this.sendBackendLog(`Gunicorn server ready on http://127.0.0.1:${this.backendPort}`, 'success');
          resolve();
        }
      });

      this.backendProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        const messageType = this.classifyProcessOutput(output, true);
        this.sendBackendLog(`gunicorn: ${output}`, messageType);
        this.notifyOutputListeners(`gunicorn: ${output}`);

        if (!serverStarted && (output.includes('Listening at:') || output.includes('Booting worker') || output.includes('Application startup complete'))) {
          serverStarted = true;
          this.sendBackendStatus('django', 'ready', `Server running on port ${this.backendPort}`);
          this.sendBackendLog(`Gunicorn server ready on http://127.0.0.1:${this.backendPort}`, 'success');
          resolve();
        }
      });

      this.backendProcess.on('close', (code) => {
        this.sendBackendLog(`Gunicorn server exited with code ${code}`, 'error');
        this.backendProcess = null;
      });

      this.backendProcess.on('error', (error) => {
        this.sendBackendStatus('django', 'error', `Server start error: ${error.message}`);
        this.sendBackendLog(`Gunicorn server error: ${error.message}`, 'error');
        resolve();
      });

      setTimeout(() => {
        if (!serverStarted) {
          serverStarted = true;
          this.sendBackendStatus('django', 'ready', `Server running on port ${this.backendPort}`);
          this.sendBackendLog(`Gunicorn server ready on http://127.0.0.1:${this.backendPort}`, 'success');
          resolve();
        }
      }, 5000);
    });
  }

  async startRQWorker(backendDir: string, venvPython: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sendBackendStatus('rq', 'starting', 'Starting RQ worker...');
      this.sendBackendLog('Starting RQ worker...');

      let hasOutput = false;
      let resolved = false;

      const { command, args } = this.getCommandAndArgs(backendDir, venvPython, ['manage.py', 'rqworker', 'high', 'default']);

      this.rqWorkerProcess = spawn(command, args, {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment(),
        detached: process.platform !== 'win32'
      });

      if (this.rqWorkerProcess.pid) {
        this.addTrackedProcess(this.rqWorkerProcess.pid, 'rqworker');
      }

      const timeout = setTimeout(() => {
        if (!resolved && this.rqWorkerProcess && !this.rqWorkerProcess.killed) {
          resolved = true;
          this.sendBackendStatus('rq', 'ready', 'RQ worker started');
          this.sendBackendLog('RQ worker ready (process running)', 'success');
          resolve();
        }
      }, 3000);

      this.rqWorkerProcess.stdout.on('data', (data) => {
        hasOutput = true;
        const output = data.toString().trim();
        const messageType = this.classifyProcessOutput(output, false);
        this.sendBackendLog(`rq stdout: ${output}`, messageType);

        if (!resolved && (
          output.includes('Worker started') ||
          output.includes('started with PID') ||
          output.includes('*** Listening on') ||
          output.includes('Listening on')
        )) {
          resolved = true;
          clearTimeout(timeout);
          this.sendBackendStatus('rq', 'ready', 'RQ worker started');
          this.sendBackendLog('RQ worker ready', 'success');
          resolve();
        }
      });

      this.rqWorkerProcess.stderr.on('data', (data) => {
        hasOutput = true;
        const output = data.toString().trim();
        const messageType = this.classifyProcessOutput(output, true);
        this.sendBackendLog(`rq stderr: ${output}`, messageType);

        if (!resolved && (
          output.includes('Worker started') ||
          output.includes('started with PID') ||
          output.includes('*** Listening on') ||
          output.includes('Listening on') ||
          output.includes('Worker rq:worker:') ||
          output.includes('Cleaning registries') ||
          output.includes('Subscribing to channel')
        )) {
          resolved = true;
          clearTimeout(timeout);
          this.sendBackendStatus('rq', 'ready', 'RQ worker started');
          this.sendBackendLog('RQ worker ready', 'success');
          resolve();
        }
      });

      this.rqWorkerProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          this.sendBackendLog(`RQ worker exited with code ${code}`, 'error');
          this.sendBackendStatus('rq', 'error', `RQ worker failed with code ${code}`);
        } else {
          this.sendBackendLog(`RQ worker exited with code ${code}`, 'warning');
        }
        this.rqWorkerProcess = null;
      });

      this.rqWorkerProcess.on('error', (error) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          this.sendBackendStatus('rq', 'error', `RQ worker error: ${error.message}`);
          this.sendBackendLog(`RQ worker error: ${error.message}`, 'error');
        }
        resolve();
      });
    });
  }

  async killOrphanedDjangoProcesses(): Promise<void> {
    const trackedProcesses = this.getTrackedProcesses();
    let killedCount = 0;

    for (const tracked of trackedProcesses) {
      if (this.isProcessRunning(tracked.pid)) {
        const cmdline = this.getProcessCommandLine(tracked.pid);

        const isCupcakeProcess =
          cmdline.includes('cupcake_vanilla') ||
          cmdline.includes('manage.py rqworker') ||
          cmdline.includes('gunicorn') ||
          cmdline.includes('valkey-server') ||
          cmdline.includes('redis-server');

        if (isCupcakeProcess) {
          console.log(`Killing tracked ${tracked.type} process PID ${tracked.pid}`);
          try {
            if (process.platform === 'win32') {
              process.kill(tracked.pid, 'SIGKILL');
            } else {
              try {
                process.kill(-tracked.pid, 'SIGKILL');
              } catch (e) {
                process.kill(tracked.pid, 'SIGKILL');
              }
            }
            killedCount++;
          } catch (error) {
            console.log(`Process ${tracked.pid} already dead or cannot be killed`);
          }
        } else {
          console.log(`Skipping PID ${tracked.pid} - not a Cupcake process: ${cmdline.substring(0, 100)}`);
        }
      } else {
        console.log(`Process ${tracked.pid} is not running`);
      }
    }

    this.clearTrackedProcesses();

    if (killedCount > 0) {
      console.log(`Killed ${killedCount} orphaned process(es)`);
    } else {
      console.log('No orphaned processes found');
    }
  }

  async stopServices(): Promise<void> {
    if (this.backendProcess) {
      console.log('Stopping Django server...');
      const pid = this.backendProcess.pid;

      try {
        if (process.platform === 'win32') {
          this.backendProcess.kill('SIGTERM');
        } else {
          if (pid) {
            process.kill(-pid, 'SIGTERM');
          } else {
            this.backendProcess.kill('SIGTERM');
          }
        }
      } catch (error) {
        console.error('Error stopping Django server:', error.message);
      }

      this.backendProcess = null;
    }

    if (this.rqWorkerProcess) {
      console.log('Stopping RQ worker...');
      const pid = this.rqWorkerProcess.pid;

      try {
        if (process.platform === 'win32') {
          this.rqWorkerProcess.kill('SIGTERM');
        } else {
          if (pid) {
            process.kill(-pid, 'SIGTERM');
          } else {
            this.rqWorkerProcess.kill('SIGTERM');
          }
        }
      } catch (error) {
        console.error('Error stopping RQ worker:', error.message);
      }

      this.rqWorkerProcess = null;
    }

    if (this.redisManager.isRunning()) {
      console.log('Stopping Redis server...');
      await this.redisManager.stopRedis();
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.killOrphanedDjangoProcesses();
  }

  getBackendPort(): number {
    return this.backendPort;
  }

  async runManagementCommand(
    backendDir: string,
    venvPython: string,
    command: string,
    args: string[] = [],
    outputCallback?: (output: string, isError: boolean) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmdArgs = ['manage.py', command, ...args];
      const childProcess = spawn(venvPython, cmdArgs, {
        cwd: backendDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment()
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[${command.toUpperCase()}]`, output.trim());

        if (outputCallback) {
          outputCallback(output.trim(), false);
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`[${command.toUpperCase()}]`, output.trim());

        if (outputCallback) {
          outputCallback(output.trim(), true);
        }
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Management command ${command} failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async checkSchemas(backendDir: string, venvPython: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const pythonCode = `
from ccv.models import Schema
schema_count = Schema.objects.count()
print(f"SCHEMA_COUNT:{schema_count}")
`;

      const checkProcess = spawn(venvPython, ['manage.py', 'shell', '-c', pythonCode], {
        cwd: backendDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment()
      });

      let stdout = '';
      let stderr = '';

      checkProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      checkProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          const match = stdout.match(/SCHEMA_COUNT:(\d+)/);
          if (match) {
            const count = parseInt(match[1]);
            resolve(count > 0);
          } else {
            resolve(false);
          }
        } else {
          reject(new Error(`Schema check failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`));
        }
      });

      checkProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async checkColumnTemplates(backendDir: string, venvPython: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const pythonCode = `
from ccv.models import MetadataColumnTemplate
template_count = MetadataColumnTemplate.objects.count()
print(f"TEMPLATE_COUNT:{template_count}")
`;

      const templateProcess = spawn(venvPython, ['manage.py', 'shell', '-c', pythonCode], {
        cwd: backendDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.getDjangoEnvironment()
      });

      let stdout = '';
      let stderr = '';

      templateProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      templateProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      templateProcess.on('close', (code) => {
        if (code === 0) {
          const match = stdout.match(/TEMPLATE_COUNT:(\d+)/);
          if (match) {
            const count = parseInt(match[1]);
            resolve(count > 0);
          } else {
            resolve(false);
          }
        } else {
          reject(new Error(`Column template check failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`));
        }
      });

      templateProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  async getSchemaCount(backendDir: string, venvPython: string): Promise<number> {
    const pythonCode = `
from ccv.models import Schema
count = Schema.objects.filter(is_builtin=True, is_active=True).count()
print(count)
`;
    const output = await this.runDjangoShellCommand(backendDir, venvPython, pythonCode);
    return parseInt(output.trim()) || 0;
  }

  async getColumnTemplateCount(backendDir: string, venvPython: string): Promise<number> {
    const pythonCode = `
from ccv.models import MetadataColumnTemplate
count = MetadataColumnTemplate.objects.filter(is_system_template=True).count()
print(count)
`;
    const output = await this.runDjangoShellCommand(backendDir, venvPython, pythonCode);
    return parseInt(output.trim()) || 0;
  }

  async getOntologyCounts(backendDir: string, venvPython: string): Promise<{
    mondo: number;
    uberon: number;
    ncbi: number;
    chebi: number;
    psims: number;
    cell: number;
    total: number;
  }> {
    const pythonCode = `
from ccv.models import MondoDisease, UberonAnatomy, NCBITaxonomy, ChEBICompound, PSIMSOntology, CellOntology

mondo_count = MondoDisease.objects.count()
uberon_count = UberonAnatomy.objects.count()
ncbi_count = NCBITaxonomy.objects.count()
chebi_count = ChEBICompound.objects.count()
psims_count = PSIMSOntology.objects.count()
cell_count = CellOntology.objects.count()

print(f"{mondo_count}|{uberon_count}|{ncbi_count}|{chebi_count}|{psims_count}|{cell_count}")
`;
    const output = await this.runDjangoShellCommand(backendDir, venvPython, pythonCode);
    const parts = output.trim().split('|').map(p => parseInt(p) || 0);

    return {
      mondo: parts[0] || 0,
      uberon: parts[1] || 0,
      ncbi: parts[2] || 0,
      chebi: parts[3] || 0,
      psims: parts[4] || 0,
      cell: parts[5] || 0,
      total: parts.reduce((sum, count) => sum + count, 0)
    };
  }

  isRunning(): boolean {
    return this.backendProcess !== null && !this.backendProcess.killed;
  }

  onOutput(callback: (data: string) => void): void {
    this.outputListeners.push(callback);
  }

  private notifyOutputListeners(data: string): void {
    this.outputListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('[BackendManager] Error in output listener:', error);
      }
    });
  }

}
