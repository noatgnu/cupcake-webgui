import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

export interface DownloadTask {
  title: string;
  description: string;
  execute: (window: BrowserWindow) => Promise<void>;
}

/**
 * Generic downloader window manager
 * Can be used for any download task (backend, valkey, etc.)
 */
export class DownloaderManager {
  private downloaderWindow: BrowserWindow | null = null;
  private currentTask: DownloadTask | null = null;
  private isCancelled: boolean = false;

  constructor() {
    this.setupIPC();
  }

  private setupIPC(): void {
    ipcMain.on('downloader-cancel', () => {
      this.isCancelled = true;
      this.close();
    });
  }

  /**
   * Create and show downloader window
   */
  private createWindow(): BrowserWindow {
    this.downloaderWindow = new BrowserWindow({
      width: 480,
      height: 200,
      show: false,
      resizable: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: process.platform !== 'darwin',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'downloader-panel-preload.js')
      }
    });

    const htmlPath = path.join(__dirname, 'downloader-panel.html');
    this.downloaderWindow.loadFile(htmlPath);

    this.downloaderWindow.once('ready-to-show', () => {
      if (this.downloaderWindow && !this.downloaderWindow.isDestroyed()) {
        this.downloaderWindow.show();
        if (this.currentTask) {
          this.downloaderWindow.webContents.send('download-status', {
            message: this.currentTask.description,
            type: 'info'
          });
        }
      }
    });

    this.downloaderWindow.on('closed', () => {
      this.downloaderWindow = null;
      this.isCancelled = true;
    });

    return this.downloaderWindow;
  }

  /**
   * Start a download task
   */
  async startDownload(task: DownloadTask): Promise<void> {
    this.currentTask = task;
    this.isCancelled = false;

    const window = this.createWindow();

    if (window.webContents.isLoading()) {
      await new Promise<void>((resolve) => {
        window.webContents.once('did-finish-load', () => resolve());
      });
    }

    // Update title and description
    window.setTitle(task.title);
    window.webContents.executeJavaScript(`
      document.getElementById('download-title').textContent = '${task.title.replace(/'/g, "\\'")}';
    `).catch(() => {});

    window.webContents.send('download-status', {
      message: task.description,
      type: 'info'
    });

    try {
      await task.execute(window);
    } catch (error: any) {
      if (!this.isCancelled) {
        window.webContents.send('download-complete', false, error.message);
      }
      throw error;
    }
  }

  /**
   * Close downloader window
   */
  close(): void {
    if (this.downloaderWindow && !this.downloaderWindow.isDestroyed()) {
      this.downloaderWindow.close();
    }
    this.downloaderWindow = null;
    this.currentTask = null;
  }

  /**
   * Check if download is in progress
   */
  isDownloading(): boolean {
    return this.downloaderWindow !== null && !this.downloaderWindow.isDestroyed();
  }

  /**
   * Check if download was cancelled
   */
  wasCancelled(): boolean {
    return this.isCancelled;
  }
}