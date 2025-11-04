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

export interface BackendDownloadOptions {
  version: string;
  isPortable: boolean;
  pythonVersion: string;
  destPath: string;
}

export class BackendDownloader {
  private readonly GITHUB_REPO = 'noatgnu/cupcake_vanilla';
  private readonly BACKEND_REPO_URL = 'https://github.com/noatgnu/cupcake_vanilla.git';
  private readonly BACKEND_BRANCH = 'master';
  private lastDownloadTime: number = Date.now();
  private lastDownloadedBytes: number = 0;

  constructor(private window?: BrowserWindow) {}

  /**
   * Get the OS name for the portable distribution
   */
  private getOSName(): string {
    const platform = os.platform();
    switch (platform) {
      case 'linux':
        return 'linux';
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get the architecture for the portable distribution
   */
  private getArch(): string {
    const arch = os.arch();
    switch (arch) {
      case 'x64':
        return 'x86_64';
      case 'arm64':
        return 'aarch64';
      default:
        throw new Error(`Unsupported architecture: ${arch}`);
    }
  }

  /**
   * Get available releases from GitHub
   */
  async getAvailableReleases(): Promise<Array<{ tag: string; name: string; publishedAt: string }>> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.GITHUB_REPO}/releases`,
        method: 'GET',
        headers: {
          'User-Agent': 'Cupcake-Vanilla-Electron'
        }
      };

      https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const releases = JSON.parse(data);
            const formattedReleases = releases.map((release: any) => ({
              tag: release.tag_name,
              name: release.name || release.tag_name,
              publishedAt: release.published_at
            }));
            resolve(formattedReleases);
          } catch (error: any) {
            reject(new Error(`Failed to parse releases: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Failed to fetch releases: ${error.message}`));
      });
    });
  }

  /**
   * Get the download URL for a portable distribution
   */
  private getPortableDownloadURL(version: string, pythonVersion: string): string {
    const osName = this.getOSName();
    const arch = this.getArch();
    const cleanVersion = version.startsWith('v') ? version.substring(1) : version;
    const filename = `cupcake_vanilla-${cleanVersion}-${osName}-${arch}.tar.gz`;
    return `https://github.com/${this.GITHUB_REPO}/releases/download/${version}/${filename}`;
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
    const timeDiff = (now - this.lastDownloadTime) / 1000; // seconds
    const bytesDiff = downloadedBytes - this.lastDownloadedBytes;

    if (timeDiff >= 0.5) { // Update speed every 0.5 seconds
      this.currentSpeed = bytesDiff / timeDiff; // bytes per second
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
          return https.get(response.headers.location, handleResponse);
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

      https.get(url, handleResponse).on('error', (error) => {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(error);
      });
    });
  }

  /**
   * Extract tar.gz file with progress updates
   */
  private extractTarGz(archivePath: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sendStatus({ message: 'Preparing extraction...', type: 'info' });

      const tempExtractDir = path.join(os.tmpdir(), `cupcake_extract_${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });

      // Get archive size for progress calculation
      const archiveSize = fs.statSync(archivePath).size;
      let processedSize = 0;

      this.sendStatus({ message: 'Extracting archive...', type: 'info' });
      this.sendProgress({
        downloaded: 0,
        total: archiveSize,
        percentage: 0,
        speed: 0
      });

      const tar = spawn('tar', ['-xzf', archivePath, '-C', tempExtractDir], {
        stdio: ['ignore', 'pipe', 'pipe']
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

      tar.on('close', (code) => {
        clearInterval(progressInterval);

        if (code !== 0) {
          reject(new Error(`Extraction failed with code ${code}`));
          return;
        }

        this.sendStatus({ message: 'Installing backend...', type: 'info' });
        this.sendProgress({
          downloaded: archiveSize,
          total: archiveSize,
          percentage: 95,
          speed: 0
        });

        try {
          const contents = fs.readdirSync(tempExtractDir);
          const extractedDir = contents.find(name => name.startsWith('cupcake_vanilla-'));

          if (extractedDir) {
            const sourcePath = path.join(tempExtractDir, extractedDir);

            // Ensure parent directory exists
            const parentDir = path.dirname(destPath);
            fs.mkdirSync(parentDir, { recursive: true });

            // Remove existing destination if it exists
            if (fs.existsSync(destPath)) {
              fs.rmSync(destPath, { recursive: true, force: true });
            }

            // Move extracted content to destination
            fs.renameSync(sourcePath, destPath);
          }

          // Clean up temp directory
          fs.rmSync(tempExtractDir, { recursive: true, force: true });

          this.sendProgress({
            downloaded: archiveSize,
            total: archiveSize,
            percentage: 100,
            speed: 0
          });
          this.sendStatus({ message: 'Extraction complete', type: 'success' });
          resolve();
        } catch (error: any) {
          // Clean up temp directory on error
          if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
          }
          reject(error);
        }
      });

      tar.on('error', (error) => {
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
   * Clone backend repository from GitHub
   */
  private cloneRepository(destPath: string): void {
    this.sendStatus({ message: 'Cloning repository from GitHub...', type: 'info' });

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    execSync(`git clone -b ${this.BACKEND_BRANCH} ${this.BACKEND_REPO_URL} "${destPath}"`, {
      stdio: 'inherit'
    });

    this.sendStatus({ message: 'Repository cloned successfully', type: 'success' });
  }

  /**
   * Download portable backend distribution
   */
  async downloadPortable(options: BackendDownloadOptions): Promise<void> {
    // Check if destination exists and remove if needed
    if (fs.existsSync(options.destPath)) {
      this.sendStatus({ message: 'Removing existing backend...', type: 'info' });
      try {
        fs.rmSync(options.destPath, { recursive: true, force: true });
      } catch (error: any) {
        console.error('Failed to remove existing backend:', error);
        this.sendComplete(false, `Cannot remove existing backend: ${error.message}`);
        throw new Error(`Cannot remove existing backend. Please close any applications using it and try again.`);
      }
    }

    const url = this.getPortableDownloadURL(options.version, options.pythonVersion);
    const archivePath = path.join(os.tmpdir(), `cupcake_vanilla_${Date.now()}.tar.gz`);

    try {
      this.sendStatus({ message: `Downloading from: ${url}`, type: 'info' });
      console.log(`Downloading portable backend from: ${url}`);

      await this.downloadFile(url, archivePath);

      console.log(`Extracting to: ${options.destPath}`);
      await this.extractTarGz(archivePath, options.destPath);

      console.log('Portable backend downloaded and extracted successfully');
      this.sendComplete(true, 'Portable backend installed successfully');
    } catch (error: any) {
      console.error('Download error:', error);
      this.sendComplete(false, `Failed to download: ${error.message}`);
      throw error;
    } finally {
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }
    }
  }

  /**
   * Download source backend (clone repository)
   */
  async downloadSource(destPath: string): Promise<void> {
    // Check if destination exists and remove if needed
    if (fs.existsSync(destPath)) {
      this.sendStatus({ message: 'Removing existing backend...', type: 'info' });
      try {
        fs.rmSync(destPath, { recursive: true, force: true });
      } catch (error: any) {
        console.error('Failed to remove existing backend:', error);
        this.sendComplete(false, `Cannot remove existing backend: ${error.message}`);
        throw new Error(`Cannot remove existing backend. Please close any applications using it and try again.`);
      }
    }

    try {
      console.log(`Cloning backend repository to: ${destPath}`);
      this.cloneRepository(destPath);
      console.log('Backend repository cloned successfully');
      this.sendComplete(true, 'Backend source downloaded successfully');
    } catch (error: any) {
      console.error('Clone error:', error);
      this.sendComplete(false, `Failed to clone repository: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if backend exists at path
   */
  backendExists(backendPath: string): boolean {
    return fs.existsSync(backendPath) &&
           fs.existsSync(path.join(backendPath, 'manage.py'));
  }

  /**
   * Check if portable backend (has python directory)
   */
  isPortableBackend(backendPath: string): boolean {
    return this.backendExists(backendPath) &&
           fs.existsSync(path.join(backendPath, 'python'));
  }
}