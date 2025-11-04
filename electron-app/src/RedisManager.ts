import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { execSync } from 'child_process';
import * as net from 'net';

export interface RedisManagerOptions {
  userDataPath: string;
  isDev: boolean;
  port?: number;
  configFile?: string;
}

export class RedisManager {
  private redisProcess: ChildProcess | null = null;
  private userDataPath: string;
  private isDev: boolean;
  private port: number;
  private configFile: string;
  private platform: string;
  private redisDir: string;
  private logCallback?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;

  constructor(options: RedisManagerOptions) {
    this.userDataPath = options.userDataPath;
    this.isDev = options.isDev;
    this.port = options.port || 6379;
    this.configFile = options.configFile || 'redis.conf';
    this.platform = os.platform();
    this.redisDir = path.join(this.userDataPath, 'redis');

    // Ensure redis directory exists
    fs.mkdirSync(this.redisDir, { recursive: true });
  }

  private async findAvailablePort(startPort: number = 6379): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(startPort, () => {
        const port = (server.address() as net.AddressInfo).port;
        server.close(() => resolve(port));
      });
      server.on('error', () => {
        this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
      });
    });
  }

  setLogCallback(callback: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void): void {
    this.logCallback = callback;
  }

  private log(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
    console.log(`[RedisManager] ${message}`);
    if (this.logCallback) {
      this.logCallback(message, type);
    }
  }

  private findExecutableInPath(executable: string): string | null {
    try {
      const command = this.platform === 'win32' ? 'where' : 'which';
      const result = execSync(`${command} ${executable}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
      });
      const path = result.trim().split('\n')[0]; // Take first result
      return path && fs.existsSync(path) ? path : null;
    } catch (error) {
      return null;
    }
  }

  private getRedisExecutablePath(): string {
    const platform = this.platform;

    if (this.isDev) {
      // Development mode - look for system Redis/Valkey
      if (platform === 'win32') {
        // Check for Memurai in PATH first
        const memuraiInPath = this.findExecutableInPath('memurai') || this.findExecutableInPath('memurai.exe');
        if (memuraiInPath) {
          return memuraiInPath;
        }

        // Fallback to bundled binary
        return path.join(this.redisDir, 'memurai.exe');
      } else {
        // Check for system Valkey or Redis
        const homeBin = path.join(os.homedir(), 'bin', 'valkey-server');
        const systemPaths = [homeBin, '/usr/local/bin/valkey-server', '/usr/bin/valkey-server', '/usr/local/bin/redis-server', '/usr/bin/redis-server'];
        for (const systemPath of systemPaths) {
          if (fs.existsSync(systemPath)) {
            return systemPath;
          }
        }

        // Fallback to bundled binary
        return path.join(this.redisDir, platform === 'darwin' ? 'valkey-server' : 'valkey-server');
      }
    } else {
      // Production mode - prioritize user data (downloaded), then resources (bundled)
      if (platform === 'win32') {
        // Windows: Check multiple locations in order of preference

        // 1. Check for downloaded Redis/Valkey binary in user data (highest priority)
        const userDataRedis = path.join(this.redisDir, 'redis-server.exe');
        const userDataValkey = path.join(this.redisDir, 'valkey-server.exe');
        if (fs.existsSync(userDataRedis)) {
          return userDataRedis;
        }
        if (fs.existsSync(userDataValkey)) {
          return userDataValkey;
        }

        // 2. Check for bundled Redis binary in resources
        const resourceRedis = path.join(process.resourcesPath, 'redis', 'windows', 'redis-server.exe');
        if (fs.existsSync(resourceRedis)) {
          return resourceRedis;
        }

        // 3. Check for Memurai in PATH
        const memuraiInPath = this.findExecutableInPath('memurai') || this.findExecutableInPath('memurai.exe');
        if (memuraiInPath) {
          return memuraiInPath;
        }

        // 4. Look for Redis in PATH
        const redisInPath = this.findExecutableInPath('redis-server') || this.findExecutableInPath('redis-server.exe');
        if (redisInPath) {
          return redisInPath;
        }

        // If nothing found, return user data path (will trigger download)
        return userDataRedis;
      } else {
        // Mac/Linux: Check user data first (downloaded), then resources (bundled)
        const userDataValkey = path.join(this.redisDir, 'valkey-server');
        if (fs.existsSync(userDataValkey)) {
          return userDataValkey;
        }

        // Fallback to resources
        const platformDir = platform === 'darwin' ? 'darwin' : 'linux';
        const resourceValkey = path.join(process.resourcesPath, 'redis', platformDir, 'valkey-server');
        if (fs.existsSync(resourceValkey)) {
          return resourceValkey;
        }

        // If nothing found, return user data path (will trigger download)
        return userDataValkey;
      }
    }
  }

  getRedisDir(): string {
    return this.redisDir;
  }

  private async createRedisConfig(): Promise<string> {
    const configPath = path.join(this.redisDir, this.configFile);
    const logPath = path.join(this.redisDir, 'redis.log');

    const config = `# Valkey configuration for Electron app
port ${this.port}
bind 127.0.0.1
protected-mode yes
daemonize no
loglevel notice
logfile "${logPath.replace(/\\/g, '/')}"
databases 16
save 900 1
save 300 10
save 60 10000
dbfilename dump.rdb
dir "${this.redisDir.replace(/\\/g, '/')}"
maxmemory-policy allkeys-lru
appendonly no
`;

    fs.writeFileSync(configPath, config);
    this.log(`Redis config created at ${configPath}`, 'success');
    return configPath;
  }

  async startRedis(): Promise<void> {
    if (this.redisProcess && !this.redisProcess.killed) {
      this.log('Redis server is already running', 'warning');
      return;
    }

    const executablePath = this.getRedisExecutablePath();
    this.log(`Checking for Redis executable at: ${executablePath}`, 'info');

    if (!fs.existsSync(executablePath)) {
      this.log(`Redis executable not found at: ${executablePath}`, 'error');

      // List files in redisDir to help debug
      if (fs.existsSync(this.redisDir)) {
        const files = fs.readdirSync(this.redisDir);
        this.log(`Files in Redis directory: ${files.join(', ')}`, 'info');
      } else {
        this.log(`Redis directory does not exist: ${this.redisDir}`, 'error');
      }

      if (this.platform === 'win32') {
        throw new Error('REDIS_NOT_FOUND_WINDOWS');
      } else if (this.platform === 'darwin') {
        throw new Error('REDIS_NOT_FOUND_MAC');
      } else {
        throw new Error('REDIS_NOT_FOUND_LINUX');
      }
    }

    // Find an available port
    this.port = await this.findAvailablePort(this.port);

    this.log(`Starting Redis server from ${executablePath}`, 'info');
    this.log(`Port: ${this.port}`, 'info');

    // Check executable permissions on Unix
    if (this.platform !== 'win32') {
      try {
        const stats = fs.statSync(executablePath);
        const isExecutable = (stats.mode & 0o111) !== 0;
        if (!isExecutable) {
          this.log(`Fixing permissions on ${executablePath}`, 'warning');
          fs.chmodSync(executablePath, '755');
        }
      } catch (error: any) {
        this.log(`Error checking permissions: ${error.message}`, 'error');
      }
    }

    return new Promise<void>((resolve, reject) => {
      this.redisProcess = spawn(executablePath, ['--port', this.port.toString(), '--bind', '127.0.0.1'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.redisDir
      });

      let resolved = false;
      let stderrOutput = '';

      this.redisProcess.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        this.log(`Redis stdout: ${output}`, 'info');

        // Check for Redis ready indicators
        if (!resolved && (
          output.includes('Ready to accept connections') ||
          output.includes('Server started') ||
          output.includes('The server is now ready to accept connections')
        )) {
          resolved = true;
          this.log('Redis server is ready', 'success');
          resolve();
        }
      });

      this.redisProcess.stderr?.on('data', (data) => {
        const output = data.toString().trim();
        stderrOutput += output + '\n';
        this.log(`Redis stderr: ${output}`, 'warning');

        // Some Redis messages go to stderr but are not errors
        if (!resolved && (
          output.includes('Ready to accept connections') ||
          output.includes('Server started') ||
          output.includes('The server is now ready to accept connections')
        )) {
          resolved = true;
          this.log('Redis server is ready', 'success');
          resolve();
        }
      });

      this.redisProcess.on('error', (error) => {
        this.log(`Redis process error: ${error.message}`, 'error');
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      this.redisProcess.on('exit', (code, signal) => {
        this.log(`Redis process exited with code ${code} and signal ${signal}`, code === 0 ? 'info' : 'error');

        if (stderrOutput) {
          this.log(`Redis stderr output before exit:\n${stderrOutput}`, 'error');
        }

        this.redisProcess = null;
        if (!resolved) {
          resolved = true;
          if (code === 0) {
            resolve();
          } else {
            const errorMsg = stderrOutput
              ? `Redis process exited with code ${code}. Error: ${stderrOutput.trim()}`
              : `Redis process exited with code ${code} and signal ${signal}`;
            reject(new Error(errorMsg));
          }
        }
      });

      // Set a timeout in case Redis doesn't output ready message
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (this.redisProcess && !this.redisProcess.killed) {
            this.log('Redis server started (timeout check)', 'success');
            resolve();
          } else {
            reject(new Error('Redis server failed to start within timeout'));
          }
        }
      }, 10000); // 10 second timeout
    });
  }

  async stopRedis(): Promise<void> {
    if (!this.redisProcess || this.redisProcess.killed) {
      this.log('Redis server is not running', 'info');
      return;
    }

    this.log('Stopping Redis server', 'info');

    return new Promise<void>((resolve) => {
      if (!this.redisProcess) {
        resolve();
        return;
      }

      const pid = this.redisProcess.pid;
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          this.log('Redis server stopped', 'success');
          this.redisProcess = null;
          resolve();
        }
      };

      this.redisProcess.on('exit', cleanup);

      // Try graceful shutdown first using redis-cli SHUTDOWN
      const serverPath = this.getRedisExecutablePath();
      const isWindows = process.platform === 'win32';
      const cliPath = isWindows
        ? serverPath.replace('redis-server.exe', 'redis-cli.exe')
        : serverPath.replace('valkey-server', 'valkey-cli');

      if (fs.existsSync(cliPath)) {
        try {
          const { execSync } = require('child_process');
          const command = isWindows
            ? `"${cliPath}" -p ${this.port} SHUTDOWN NOSAVE`
            : `"${cliPath}" -p ${this.port} SHUTDOWN NOSAVE`;
          execSync(command, { timeout: 2000, stdio: 'ignore' });
          this.log('Sent SHUTDOWN command to Redis/Valkey', 'info');
        } catch (error) {
          // SHUTDOWN command failed, fall back to SIGTERM
          this.log('SHUTDOWN command failed, using SIGTERM', 'warning');
        }
      }

      // Send SIGTERM as backup
      setTimeout(() => {
        if (this.redisProcess && !this.redisProcess.killed) {
          this.log('Sending SIGTERM to Redis', 'info');
          this.redisProcess.kill('SIGTERM');
        }
      }, 1000);

      // Force kill after 3 seconds if still running
      setTimeout(() => {
        if (this.redisProcess && !this.redisProcess.killed) {
          this.log('Force killing Redis server with SIGKILL', 'warning');
          this.redisProcess.kill('SIGKILL');

          // Extra safety: kill by PID if process object failed
          if (pid) {
            setTimeout(() => {
              try {
                process.kill(pid, 'SIGKILL');
              } catch (e) {
                // Process already dead
              }
              cleanup();
            }, 500);
          }
        }
      }, 3000);

      // Absolute timeout to prevent hanging
      setTimeout(() => {
        cleanup();
      }, 5000);
    });
  }

  isRunning(): boolean {
    return this.redisProcess !== null && !this.redisProcess.killed;
  }

  getRedisPid(): number | undefined {
    return this.redisProcess?.pid;
  }

  getConnectionInfo(): { host: string; port: number; url: string } {
    return {
      host: '127.0.0.1',
      port: this.port,
      url: `redis://127.0.0.1:${this.port}`
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple test to see if Redis is responding
      const { spawn } = require('child_process');
      const executablePath = this.getRedisExecutablePath();

      if (!fs.existsSync(executablePath)) {
        return false;
      }

      return new Promise<boolean>((resolve) => {
        const testProcess = spawn(executablePath.replace('server', 'cli'), ['ping'], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';
        testProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        testProcess.on('exit', (code) => {
          resolve(code === 0 && output.includes('PONG'));
        });

        setTimeout(() => {
          testProcess.kill();
          resolve(false);
        }, 3000);
      });
    } catch (error) {
      this.log(`Redis connection test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Method to get environment variables for Django
  getEnvironmentVariables(): Record<string, string> {
    const connectionInfo = this.getConnectionInfo();
    const envVars: Record<string, string> = {
      REDIS_HOST: connectionInfo.host,
      REDIS_PORT: connectionInfo.port.toString(),
      REDIS_URL: connectionInfo.url
    };

    // Add password if provided (optional)
    const password = process.env.REDIS_PASSWORD;
    if (password) {
      envVars.REDIS_PASSWORD = password;
    }

    return envVars;
  }

  // Kill any orphaned Redis/Valkey processes from previous runs
  async killOrphanedProcesses(): Promise<void> {
    try {
      const { execSync } = require('child_process');
      const isWindows = process.platform === 'win32';

      if (isWindows) {
        // Kill orphaned redis-server.exe processes
        try {
          execSync('taskkill /F /IM redis-server.exe', { stdio: 'ignore' });
          this.log('Killed orphaned redis-server.exe processes', 'info');
        } catch (e) {
          // No orphaned processes
        }
      } else {
        // Kill orphaned valkey-server processes
        try {
          execSync('pkill -9 valkey-server', { stdio: 'ignore' });
          this.log('Killed orphaned valkey-server processes', 'info');
        } catch (e) {
          // No orphaned processes
        }
      }
    } catch (error) {
      this.log(`Could not kill orphaned processes: ${error.message}`, 'warning');
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.stopRedis();
  }
}