import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import { BrowserWindow } from 'electron';

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  speed: number;
}

export interface DownloadStatus {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export class ValkeyDownloader {
  private readonly VALKEY_VERSION = '7.2.11';
  private readonly REDIS_WINDOWS_VERSION = '5.0.14.1';
  private lastDownloadTime: number = Date.now();
  private lastDownloadedBytes: number = 0;

  constructor(private window?: BrowserWindow) {}

  /**
   * Get the Ubuntu release name for Valkey distribution
   */
  private getUbuntuRelease(): string {
    // Default to noble (Ubuntu 24.04) for newer systems, jammy (Ubuntu 22.04) for older
    // User can override this if needed
    return 'noble';
  }

  /**
   * Check if platform is Windows
   */
  private isWindows(): boolean {
    return os.platform() === 'win32';
  }

  /**
   * Detect Linux distribution
   */
  private detectLinuxDistro(): { id: string; version: string } | null {
    if (os.platform() !== 'linux') {
      return null;
    }

    try {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf-8');
      const lines = osRelease.split('\n');
      let id = '';
      let version = '';

      for (const line of lines) {
        if (line.startsWith('ID=')) {
          id = line.split('=')[1].replace(/"/g, '').trim();
        } else if (line.startsWith('VERSION_ID=')) {
          version = line.split('=')[1].replace(/"/g, '').trim();
        }
      }

      return { id, version };
    } catch (error) {
      console.error('Failed to detect Linux distro:', error);
      return null;
    }
  }

  /**
   * Check if Redis is already installed on the system
   */
  private checkSystemRedis(destPath: string): boolean {
    const systemPaths = ['/usr/bin/redis-server', '/usr/local/bin/redis-server'];

    for (const systemPath of systemPaths) {
      if (fs.existsSync(systemPath)) {
        this.sendStatus({ message: `Found system Redis at ${systemPath}`, type: 'info' });

        try {
          fs.mkdirSync(destPath, { recursive: true });
          const destBinary = path.join(destPath, 'valkey-server');
          fs.copyFileSync(systemPath, destBinary);
          fs.chmodSync(destBinary, '755');
          this.sendStatus({ message: `Using system Redis from ${systemPath}`, type: 'success' });
          return true;
        } catch (error: any) {
          console.error('Failed to copy system Redis:', error);
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Install Redis/Valkey using system package manager
   */
  private async installViaPackageManager(destPath: string): Promise<boolean> {
    const distro = this.detectLinuxDistro();
    if (!distro) {
      this.sendStatus({ message: 'Cannot detect Linux distribution', type: 'error' });
      return false;
    }

    this.sendStatus({ message: `Detected ${distro.id} ${distro.version}`, type: 'info' });

    let installCmd = '';
    let packageName = 'redis-server';

    if (distro.id === 'ubuntu' || distro.id === 'debian') {
      installCmd = `pkexec apt-get install -y ${packageName}`;
    } else if (distro.id === 'fedora' || distro.id === 'rhel' || distro.id === 'centos') {
      packageName = 'redis';
      installCmd = `pkexec dnf install -y ${packageName}`;
    } else if (distro.id === 'arch' || distro.id === 'manjaro') {
      packageName = 'redis';
      installCmd = `pkexec pacman -S --noconfirm ${packageName}`;
    } else {
      this.sendStatus({ message: `Unsupported distribution: ${distro.id}`, type: 'error' });
      return false;
    }

    try {
      this.sendStatus({ message: `Installing ${packageName} via package manager...`, type: 'info' });
      this.sendStatus({ message: 'You will be prompted for your password', type: 'warning' });

      execSync(installCmd, { stdio: 'inherit' });

      this.sendStatus({ message: `${packageName} installed successfully`, type: 'success' });

      // Find the installed binary and copy to destPath
      const systemPaths = ['/usr/bin/redis-server', '/usr/local/bin/redis-server'];
      for (const systemPath of systemPaths) {
        if (fs.existsSync(systemPath)) {
          fs.mkdirSync(destPath, { recursive: true });
          const destBinary = path.join(destPath, 'valkey-server');
          fs.copyFileSync(systemPath, destBinary);
          fs.chmodSync(destBinary, '755');
          this.sendStatus({ message: `Copied binary to ${destBinary}`, type: 'success' });
          return true;
        }
      }

      this.sendStatus({ message: 'Package installed but binary not found', type: 'error' });
      return false;
    } catch (error: any) {
      this.sendStatus({ message: `Package manager install failed: ${error.message}`, type: 'error' });
      return false;
    }
  }

  /**
   * Get the download URL for Valkey/Redis
   */
  private getValkeyDownloadURL(): string {
    if (this.isWindows()) {
      // Windows uses Redis from tporadowski/redis repository
      return `https://github.com/tporadowski/redis/releases/download/v${this.REDIS_WINDOWS_VERSION}/Redis-x64-${this.REDIS_WINDOWS_VERSION}.zip`;
    } else {
      // Linux uses Valkey from download.valkey.io
      const ubuntuRelease = this.getUbuntuRelease();
      const filename = `valkey-${this.VALKEY_VERSION}-${ubuntuRelease}-x86_64.tar.gz`;
      return `https://download.valkey.io/releases/${filename}`;
    }
  }

  /**
   * Send progress update to renderer
   */
  private sendProgress(progress: DownloadProgress): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('download-progress', progress);
    }
  }

  /**
   * Send status update to renderer
   */
  private sendStatus(status: DownloadStatus): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('download-status', status);
    }
  }

  /**
   * Send completion notification to renderer
   */
  private sendComplete(success: boolean, message: string): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('download-complete', success, message);
    }
  }

  private currentSpeed: number = 0;

  /**
   * Calculate download speed
   */
  private calculateSpeed(downloadedBytes: number): number {
    const now = Date.now();
    const timeDiff = (now - this.lastDownloadTime) / 1000;
    const bytesDiff = downloadedBytes - this.lastDownloadedBytes;

    if (timeDiff >= 0.5) {
      this.currentSpeed = bytesDiff / timeDiff;
      this.lastDownloadTime = now;
      this.lastDownloadedBytes = downloadedBytes;
    }

    return this.currentSpeed;
  }

  /**
   * Download file from URL with progress tracking
   */
  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      this.lastDownloadTime = Date.now();
      this.lastDownloadedBytes = 0;

      const handleResponse = (response: any) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          const options = {
            headers: {
              'User-Agent': 'Cupcake-Vanilla-Electron'
            }
          };
          return https.get(redirectUrl, options, handleResponse);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        response.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          const speed = this.calculateSpeed(downloadedSize);

          if (totalSize > 0) {
            this.sendProgress({
              downloaded: downloadedSize,
              total: totalSize,
              percentage: Math.round((downloadedSize / totalSize) * 100),
              speed: speed
            });
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (error) => {
          fs.unlinkSync(destPath);
          reject(error);
        });
      };

      const options = {
        headers: {
          'User-Agent': 'Cupcake-Vanilla-Electron'
        }
      };

      https.get(url, options, handleResponse).on('error', (error) => {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(error);
      });
    });
  }

  /**
   * Extract Valkey/Redis archive with progress updates
   */
  private extractValkey(archivePath: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sendStatus({ message: 'Preparing extraction...', type: 'info' });

      const tempExtractDir = path.join(os.tmpdir(), `valkey_extract_${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });

      // Get archive size for progress calculation
      const archiveSize = fs.statSync(archivePath).size;
      let processedSize = 0;

      this.sendStatus({ message: 'Extracting binaries...', type: 'info' });
      this.sendProgress({
        downloaded: 0,
        total: archiveSize,
        percentage: 0,
        speed: 0
      });

      // Determine extraction command based on file type
      const isZip = archivePath.endsWith('.zip');
      const extractCmd = isZip
        ? (this.isWindows() ? 'powershell' : 'unzip')
        : 'tar';

      const extractArgs = isZip
        ? (this.isWindows()
            ? ['-NoProfile', '-Command', `Expand-Archive -Path '${archivePath}' -DestinationPath '${tempExtractDir}' -Force`]
            : ['-q', archivePath, '-d', tempExtractDir])
        : ['-xzf', archivePath, '-C', tempExtractDir];

      const extractor = spawn(extractCmd, extractArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: this.isWindows()
      });

      let extractorOutput = '';
      let extractorError = '';

      extractor.stdout?.on('data', (data) => {
        extractorOutput += data.toString();
      });

      extractor.stderr?.on('data', (data) => {
        extractorError += data.toString();
        console.error(`Extraction stderr: ${data.toString()}`);
      });

      // Simulate progress based on time (tar doesn't provide progress output)
      const progressInterval = setInterval(() => {
        processedSize += archiveSize / 20; // Increment by ~5% each update
        if (processedSize > archiveSize * 0.95) {
          processedSize = archiveSize * 0.95; // Cap at 95% until complete
        }

        this.sendProgress({
          downloaded: processedSize,
          total: archiveSize,
          percentage: Math.round((processedSize / archiveSize) * 100),
          speed: 0
        });
      }, 500);

      extractor.on('close', (code) => {
        clearInterval(progressInterval);

        if (code !== 0) {
          console.error(`Extraction failed with code ${code}`);
          console.error(`Stdout: ${extractorOutput}`);
          console.error(`Stderr: ${extractorError}`);
          reject(new Error(`Extraction failed with code ${code}: ${extractorError}`));
          return;
        }

        console.log(`Extraction completed successfully to: ${tempExtractDir}`);

        this.sendStatus({ message: 'Installing binaries...', type: 'info' });
        this.sendProgress({
          downloaded: archiveSize,
          total: archiveSize,
          percentage: 95,
          speed: 0
        });

        try {
          const extractedContents = fs.readdirSync(tempExtractDir);
          console.log(`Extracted contents: ${extractedContents.join(', ')}`);

          // Ensure destination directory exists
          const parentDir = path.dirname(destPath);
          fs.mkdirSync(parentDir, { recursive: true });
          fs.mkdirSync(destPath, { recursive: true });
          console.log(`Created destination directory: ${destPath}`);

          // Recursively find and copy all executables
          const binaries: string[] = [];
          const copyExecutables = (sourceDir: string) => {
            const items = fs.readdirSync(sourceDir);

            for (const item of items) {
              const itemPath = path.join(sourceDir, item);
              const stat = fs.statSync(itemPath);

              if (stat.isDirectory()) {
                // Recursively search subdirectories
                copyExecutables(itemPath);
              } else if (stat.isFile()) {
                const ext = path.extname(item);
                // Include executables and config files
                if (ext === '' || ext === '.exe' || ext === '.conf' || ext === '.so' || ext === '.dll') {
                  const destBinaryPath = path.join(destPath, item);
                  fs.copyFileSync(itemPath, destBinaryPath);
                  console.log(`Copied: ${item} from ${itemPath} -> ${destBinaryPath}`);
                  binaries.push(item);

                  // Set executable permissions on Linux
                  if (!this.isWindows() && ext === '') {
                    fs.chmodSync(destBinaryPath, '755');
                  }
                }
              }
            }
          };

          copyExecutables(tempExtractDir);

          console.log(`Found and copied ${binaries.length} files: ${binaries.join(', ')}`);

          if (binaries.length === 0) {
            const errorMsg = `No executable files found in extracted archive`;
            console.error(errorMsg);
            this.sendStatus({ message: errorMsg, type: 'error' });
            reject(new Error(errorMsg));
            return;
          }

          const serverName = this.isWindows() ? 'Redis' : 'Valkey';
          this.sendStatus({ message: `Extracted ${binaries.length} ${serverName} files to ${destPath}`, type: 'success' });
          console.log(`Successfully extracted ${binaries.length} files to ${destPath}`);

          // Clean up temp directory
          fs.rmSync(tempExtractDir, { recursive: true, force: true });

          this.sendProgress({
            downloaded: archiveSize,
            total: archiveSize,
            percentage: 100,
            speed: 0
          });
          resolve();
        } catch (error: any) {
          // Clean up temp directory on error
          if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
          }
          reject(error);
        }
      });

      extractor.on('error', (error) => {
        clearInterval(progressInterval);
        // Clean up temp directory on error
        if (fs.existsSync(tempExtractDir)) {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
        reject(error);
      });
    });
  }

  /**
   * Download and install Valkey/Redis
   */
  async downloadValkey(destPath: string): Promise<void> {
    const serverName = this.isWindows() ? 'Redis' : 'Valkey';

    // Check if destination exists and remove if needed
    if (fs.existsSync(destPath)) {
      this.sendStatus({ message: `Removing existing ${serverName}...`, type: 'info' });
      try {
        fs.rmSync(destPath, { recursive: true, force: true });
      } catch (error: any) {
        console.error(`Failed to remove existing ${serverName}:`, error);
        this.sendComplete(false, `Cannot remove existing ${serverName}: ${error.message}`);
        throw new Error(`Cannot remove existing ${serverName}. Please close any applications using it and try again.`);
      }
    }

    // On Linux, check for system Redis first, then try package manager
    if (os.platform() === 'linux') {
      // First check if Redis is already installed
      if (this.checkSystemRedis(destPath)) {
        this.sendComplete(true, 'Using system Redis installation');
        return;
      }

      // If not found, try to install via package manager
      this.sendStatus({ message: 'Attempting to install Redis via package manager...', type: 'info' });
      const pkgMgrSuccess = await this.installViaPackageManager(destPath);

      if (pkgMgrSuccess) {
        this.sendComplete(true, 'Redis installed successfully via package manager');
        return;
      }

      // If package manager fails, fall back to download
      this.sendStatus({ message: 'Package manager install failed, falling back to download...', type: 'warning' });
    }

    const url = this.getValkeyDownloadURL();
    const fileExt = this.isWindows() ? '.zip' : '.tar.gz';
    const archivePath = path.join(os.tmpdir(), `valkey_${Date.now()}${fileExt}`);

    try {
      this.sendStatus({ message: `Downloading ${serverName} from: ${url}`, type: 'info' });
      console.log(`Downloading ${serverName} from: ${url}`);

      await this.downloadFile(url, archivePath);

      console.log(`Extracting to: ${destPath}`);
      await this.extractValkey(archivePath, destPath);

      console.log(`${serverName} downloaded and extracted successfully`);
      this.sendComplete(true, `${serverName} installed successfully`);
    } catch (error: any) {
      console.error(`${serverName} download error:`, error);
      this.sendComplete(false, `Failed to download ${serverName}: ${error.message}`);
      throw error;
    } finally {
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }
    }
  }

  /**
   * Check if Valkey/Redis is installed
   */
  valkeyExists(valkeyPath: string): boolean {
    // Check for valkey-server (Linux) or redis-server.exe (Windows)
    const valkeyServerPath = path.join(valkeyPath, 'valkey-server');
    const redisServerPath = path.join(valkeyPath, this.isWindows() ? 'redis-server.exe' : 'redis-server');

    return fs.existsSync(valkeyServerPath) || fs.existsSync(redisServerPath);
  }
}