import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DownloaderManager } from './DownloaderManager';
import { BackendDownloader } from './BackendDownloader';
import { ValkeyDownloader } from './ValkeyDownloader';
import { downloadPortableBackend, downloadBackendSource, downloadValkey, getLatestBackendVersion } from './DownloadHelpers';

export interface BackendSetupStatus {
  backend: {
    exists: boolean;
    isPortable: boolean;
    path: string;
    version?: string;
  };
  valkey: {
    exists: boolean;
    path: string;
    version?: string;
  };
  python: {
    version?: string;
    path?: string;
  };
}

export class BackendSetupManager {
  private setupWindow: BrowserWindow | null = null;
  private downloaderManager: DownloaderManager;
  private backendPath: string;
  private valkeyPath: string;

  constructor(
    private userDataPath: string,
    private isDev: boolean,
    private getPythonInfo: () => { version?: string; path?: string },
    private setPythonConfig?: (pythonPath: string) => Promise<void>
  ) {
    this.downloaderManager = new DownloaderManager();
    this.backendPath = this.getBackendPath();
    this.valkeyPath = path.join(userDataPath, 'valkey');
    this.setupIPC();
  }

  private getBackendPath(): string {
    return path.join(this.userDataPath, 'backend');
  }

  private setupIPC(): void {
    ipcMain.handle('backend-setup-get-status', async () => {
      return this.getStatus();
    });

    ipcMain.on('backend-setup-download-portable', async () => {
      await this.handleDownloadPortable();
    });

    ipcMain.on('backend-setup-download-source', async () => {
      await this.handleDownloadSource();
    });

    ipcMain.on('backend-setup-download-valkey', async () => {
      await this.handleDownloadValkey();
    });

    ipcMain.on('backend-setup-change-python', () => {
      this.handleChangePython();
    });

    ipcMain.on('backend-setup-refresh', () => {
      this.sendStatusUpdate();
    });
  }

  private async getStatus(): Promise<BackendSetupStatus> {
    const backendDownloader = new BackendDownloader();
    const valkeyDownloader = new ValkeyDownloader();
    const pythonInfo = this.getPythonInfo();

    const backendExists = backendDownloader.backendExists(this.backendPath);
    const isPortable = backendDownloader.isPortableBackend(this.backendPath);
    const valkeyExists = valkeyDownloader.valkeyExists(this.valkeyPath);

    return {
      backend: {
        exists: backendExists,
        isPortable: isPortable,
        path: this.backendPath,
        version: undefined
      },
      valkey: {
        exists: valkeyExists,
        path: this.valkeyPath,
        version: valkeyExists ? '8.1.3' : undefined
      },
      python: pythonInfo
    };
  }

  private sendStatusUpdate(): void {
    if (this.setupWindow && !this.setupWindow.isDestroyed()) {
      this.getStatus().then(status => {
        this.setupWindow.webContents.send('backend-setup-status-update', status);
      });
    }
  }

  private async handleDownloadPortable(): Promise<void> {
    try {
      const version = await getLatestBackendVersion();
      if (!version) {
        dialog.showErrorBox('Error', 'Could not fetch available backend versions');
        return;
      }

      const backendDownloader = new BackendDownloader();
      const backendExists = backendDownloader.backendExists(this.backendPath);

      let confirmMessage = `Download portable backend ${version}?`;
      let confirmDetail = 'This will download a portable backend with Python environment included.';

      if (backendExists) {
        confirmMessage = `Replace existing backend with ${version}?`;
        confirmDetail = 'Warning: This will delete the existing backend and all its data.\n\nThe existing backend will be removed before downloading the new version.';
      }

      const choice = dialog.showMessageBoxSync(this.setupWindow, {
        type: backendExists ? 'warning' : 'question',
        buttons: backendExists ? ['Replace', 'Cancel'] : ['Download', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: backendExists ? 'Replace Backend' : 'Download Portable Backend',
        message: confirmMessage,
        detail: confirmDetail
      });

      if (choice === 0) {
        await downloadPortableBackend(this.downloaderManager, version, '3.11', this.backendPath);

        // Set Python path to the portable Python
        const portablePython = path.join(
          this.backendPath,
          'python',
          process.platform === 'win32' ? 'python.exe' : 'bin/python3'
        );

        console.log('Checking for portable Python at:', portablePython);
        if (fs.existsSync(portablePython)) {
          console.log('Portable Python found, updating configuration...');
          if (this.setPythonConfig) {
            await this.setPythonConfig(portablePython);
            console.log('Python configuration updated successfully');
          }
        } else {
          console.error('Portable Python not found at expected path:', portablePython);
        }

        // Refresh status after config is updated
        this.sendStatusUpdate();

        dialog.showMessageBox(this.setupWindow, {
          type: 'info',
          buttons: ['OK'],
          title: 'Download Complete',
          message: 'Portable backend installed successfully',
          detail: 'The backend has been installed with a bundled Python environment.'
        });
      }
    } catch (error: any) {
      dialog.showErrorBox('Download Failed', error.message);
    }
  }

  private async handleDownloadSource(): Promise<void> {
    try {
      const backendDownloader = new BackendDownloader();
      const backendExists = backendDownloader.backendExists(this.backendPath);

      let confirmMessage = 'Clone backend source from GitHub?';
      let confirmDetail = 'This will clone the latest backend source code. You will need to set up Python manually.';

      if (backendExists) {
        confirmMessage = 'Replace existing backend with source code?';
        confirmDetail = 'Warning: This will delete the existing backend and all its data.\n\nThe existing backend will be removed before cloning the source code.';
      }

      const choice = dialog.showMessageBoxSync(this.setupWindow, {
        type: backendExists ? 'warning' : 'question',
        buttons: backendExists ? ['Replace', 'Cancel'] : ['Clone', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: backendExists ? 'Replace Backend' : 'Clone Backend Source',
        message: confirmMessage,
        detail: confirmDetail
      });

      if (choice === 0) {
        await downloadBackendSource(this.downloaderManager, this.backendPath);
        this.sendStatusUpdate();
      }
    } catch (error: any) {
      dialog.showErrorBox('Clone Failed', error.message);
    }
  }

  private async handleDownloadValkey(): Promise<void> {
    try {
      const isWindows = process.platform === 'win32';
      const serverName = isWindows ? 'Redis' : 'Valkey';
      const versionInfo = isWindows
        ? 'Redis 5.0.14.1 (Windows port by tporadowski)\n\nFor the latest Redis version, consider Memurai:\nhttps://www.memurai.com/'
        : 'Valkey 8.1.3 (Linux binaries)';

      const choice = dialog.showMessageBoxSync(this.setupWindow, {
        type: 'question',
        buttons: ['Download', 'Cancel'],
        defaultId: 0,
        title: `Download ${serverName}`,
        message: `Download ${serverName} binaries?`,
        detail: versionInfo
      });

      if (choice === 0) {
        await downloadValkey(this.downloaderManager, this.valkeyPath);
        this.sendStatusUpdate();
      }
    } catch (error: any) {
      dialog.showErrorBox('Download Failed', error.message);
    }
  }

  private handleChangePython(): void {
    dialog.showMessageBox(this.setupWindow, {
      type: 'info',
      buttons: ['OK'],
      title: 'Change Python',
      message: 'Python configuration',
      detail: 'Please restart the application to change Python configuration.'
    });
  }

  showSetupPanel(parentWindow?: BrowserWindow): void {
    if (this.setupWindow && !this.setupWindow.isDestroyed()) {
      this.setupWindow.focus();
      return;
    }

    this.setupWindow = new BrowserWindow({
      width: 600,
      height: 550,
      modal: true,
      parent: parentWindow,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: process.platform !== 'darwin',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'backend-setup-panel-preload.js')
      }
    });

    const htmlPath = path.join(__dirname, 'backend-setup-panel.html');
    this.setupWindow.loadFile(htmlPath);

    this.setupWindow.once('ready-to-show', () => {
      if (this.setupWindow && !this.setupWindow.isDestroyed()) {
        this.setupWindow.show();
        this.sendStatusUpdate();
      }
    });

    this.setupWindow.on('closed', () => {
      this.setupWindow = null;
    });
  }
}