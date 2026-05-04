import { Injectable, signal, Signal } from '@angular/core';
import { Events } from '@wailsio/runtime';
import * as App from '../../../../bindings/github.com/noatgnu/cupcake-webgui/cupcake-wails/app';

export interface BackendStatus {
  service: string;
  status: string;
  message: string;
}

export interface LogMessage {
  message: string;
  type: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  speed: number;
}

export interface DownloadComplete {
  success: boolean;
  message: string;
}

export interface PythonCandidate {
  command: string;
  version: string;
  path: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  version?: string;
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  publishedAt: string;
}

export interface DistributionInfo {
  distributionType: 'native' | 'portable' | '';
  backendSource: 'release' | 'git' | '';
  pythonPath: string;
  venvPath: string;
  isPortable: boolean;
  backendExists: boolean;
}

export interface CommandOutput {
  command: string;
  output: string;
  type: string;
}

export interface SyncSchemasOptions {
  force?: boolean;
}

export interface LoadColumnTemplatesOptions {
  clear?: boolean;
}

export interface LoadOntologiesOptions {
  noLimit?: boolean;
  limit?: number;
  types?: string[];
}

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  type: string;
}

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  latestName: string;
  publishedAt: string;
  hasPortable: boolean;
  message: string;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  previousVersion: string;
  newVersion: string;
  backupCreated: boolean;
}

type EventCallback = (event: { name: string; data: unknown }) => void;

const PLAYWRIGHT_MOCK_NAMESPACE = '__playwrightWailsMock__';

@Injectable({
  providedIn: 'root'
})
export class WailsService {
  readonly isWails = typeof window !== 'undefined' && '_wails' in window;
  private readonly isMockMode = typeof window !== 'undefined' &&
    (window as any)[PLAYWRIGHT_MOCK_NAMESPACE]?.enabled === true;

  private _backendStatus = signal<BackendStatus | null>(null);
  readonly backendStatus: Signal<BackendStatus | null> = this._backendStatus.asReadonly();

  private _backendLog = signal<LogMessage | null>(null);
  readonly backendLog: Signal<LogMessage | null> = this._backendLog.asReadonly();

  private _downloadProgress = signal<DownloadProgress | null>(null);
  readonly downloadProgress: Signal<DownloadProgress | null> = this._downloadProgress.asReadonly();

  private _downloadComplete = signal<DownloadComplete | null>(null);
  readonly downloadComplete: Signal<DownloadComplete | null> = this._downloadComplete.asReadonly();

  private _commandOutput = signal<CommandOutput | null>(null);
  readonly commandOutput: Signal<CommandOutput | null> = this._commandOutput.asReadonly();

  private _showPythonSelection = signal<boolean>(false);
  readonly showPythonSelection: Signal<boolean> = this._showPythonSelection.asReadonly();

  private _showBackendDownload = signal<boolean>(false);
  readonly showBackendDownload: Signal<boolean> = this._showBackendDownload.asReadonly();

  private _showValkeyDownload = signal<boolean>(false);
  readonly showValkeyDownload: Signal<boolean> = this._showValkeyDownload.asReadonly();

  private _showSuperuserCreation = signal<boolean>(false);
  readonly showSuperuserCreation: Signal<boolean> = this._showSuperuserCreation.asReadonly();

  private _logs = signal<LogMessage[]>([]);
  readonly logs: Signal<LogMessage[]> = this._logs.asReadonly();

  private _serviceStatuses = signal<Map<string, BackendStatus>>(new Map());
  readonly serviceStatuses: Signal<Map<string, BackendStatus>> = this._serviceStatuses.asReadonly();

  constructor() {
    this.setupEventListeners();
  }

  private onEvent(eventName: string, callback: EventCallback): void {
    if (this.isMockMode) {
      const mock = (window as any)[PLAYWRIGHT_MOCK_NAMESPACE];
      if (mock?.registerListener) {
        mock.registerListener(eventName, callback);
      }
    } else {
      Events.On(eventName, callback);
    }
  }

  private setupEventListeners(): void {

    this.onEvent('backend:status', (event) => {
      const status = event.data as unknown as BackendStatus;
      if (status) {
        this._backendStatus.set(status);
        const statuses = new Map(this._serviceStatuses());
        statuses.set(status.service, status);
        this._serviceStatuses.set(statuses);
      }
    });

    this.onEvent('backend:log', (event) => {
      const log = event.data as unknown as LogMessage;
      if (log) {
        this._backendLog.set(log);
        const currentLogs = this._logs();
        this._logs.set([...currentLogs.slice(-99), log]);
      }
    });

    this.onEvent('download:progress', (event) => {
      const progress = event.data as unknown as DownloadProgress;
      if (progress) {
        this._downloadProgress.set(progress);
      }
    });

    this.onEvent('download:complete', (event) => {
      const complete = event.data as unknown as DownloadComplete;
      if (complete) {
        this._downloadComplete.set(complete);
      }
    });

    this.onEvent('command:output', (event) => {
      const output = event.data as unknown as CommandOutput;
      if (output) {
        this._commandOutput.set(output);
      }
    });

    this.onEvent('show:python-selection', () => {
      this._showPythonSelection.set(true);
    });

    this.onEvent('show:backend-download', () => {
      this._showBackendDownload.set(true);
    });

    this.onEvent('show:valkey-download', () => {
      this._showValkeyDownload.set(true);
    });

    this.onEvent('show:superuser-creation', () => {
      this._showSuperuserCreation.set(true);
    });
  }

  async getAppVersion(): Promise<string> {
    if (!this.isWails) return '0.0.1';
    return App.GetAppVersion();
  }

  async getBackendPort(): Promise<number> {
    if (!this.isWails) return 8000;
    return App.GetBackendPort();
  }

  async isBackendReady(): Promise<boolean> {
    if (!this.isWails) return false;
    return App.IsBackendReady();
  }

  async detectPythonCandidates(): Promise<PythonCandidate[]> {
    if (!this.isWails) return [];
    const result = await App.DetectPythonCandidates();
    return result as unknown as PythonCandidate[];
  }

  async verifyPython(path: string): Promise<ValidationResult> {
    if (!this.isWails) return { valid: false, message: 'Wails not available' };
    const result = await App.VerifyPython(path);
    return result as unknown as ValidationResult;
  }

  async selectPython(path: string, createVenv: boolean): Promise<void> {
    if (!this.isWails) return;
    return App.SelectPython(path, createVenv);
  }

  async downloadPortableBackend(version: string): Promise<void> {
    if (!this.isWails) return;
    return App.DownloadPortableBackend(version);
  }

  async setupNativeBackend(pythonPath: string, branch: string): Promise<void> {
    if (!this.isWails) return;
    return App.SetupNativeBackend(pythonPath, branch);
  }

  async getDistributionInfo(): Promise<DistributionInfo> {
    if (!this.isWails) {
      return {
        distributionType: '',
        backendSource: '',
        pythonPath: '',
        venvPath: '',
        isPortable: false,
        backendExists: false
      };
    }
    const result = await App.GetDistributionInfo();
    return result as unknown as DistributionInfo;
  }

  async downloadValkey(): Promise<void> {
    if (!this.isWails) return;
    return App.DownloadValkey();
  }

  async createSuperuser(username: string, email: string, password: string): Promise<void> {
    if (!this.isWails) return;
    return App.CreateSuperuser(username, email, password);
  }

  async listUsers(): Promise<string[]> {
    if (!this.isWails) return [];
    return App.ListUsers();
  }

  async resetPassword(username: string, newPassword: string): Promise<void> {
    if (!this.isWails) return;
    return App.ResetPassword(username, newPassword);
  }

  closePasswordResetWindow(): void {
    if (!this.isWails) return;
    App.ClosePasswordResetWindow();
  }

  async runSyncSchemas(options: SyncSchemasOptions = {}): Promise<void> {
    if (!this.isWails) return;
    return App.RunSyncSchemas({ force: options.force ?? false });
  }

  async runLoadColumnTemplates(options: LoadColumnTemplatesOptions = {}): Promise<void> {
    if (!this.isWails) return;
    return App.RunLoadColumnTemplates({ clear: options.clear ?? false });
  }

  async runLoadOntologies(options: LoadOntologiesOptions = {}): Promise<void> {
    if (!this.isWails) return;
    return App.RunLoadOntologies({
      noLimit: options.noLimit ?? true,
      limit: options.limit ?? 0,
      types: options.types ?? []
    });
  }

  async runLoadAllOntologies(options: LoadOntologiesOptions = {}): Promise<void> {
    if (!this.isWails) return;
    return App.RunLoadAllOntologies({
      noLimit: options.noLimit ?? true,
      limit: options.limit ?? 0,
      types: options.types ?? []
    });
  }

  async getAvailableReleases(): Promise<ReleaseInfo[]> {
    if (!this.isWails) return [];
    const result = await App.GetAvailableReleases();
    return result as unknown as ReleaseInfo[];
  }

  async openFile(title: string): Promise<string> {
    if (!this.isWails) return '';
    return App.OpenFile(title);
  }

  async openDirectory(title: string): Promise<string> {
    if (!this.isWails) return '';
    return App.OpenDirectory(title);
  }

  async logToFile(message: string): Promise<void> {
    if (!this.isWails) return;
    return App.LogToFile(message);
  }

  async getLogFilePath(): Promise<string> {
    if (!this.isWails) return '';
    return App.GetLogFilePath();
  }

  async getSchemaCount(): Promise<number> {
    if (!this.isWails) return 0;
    return App.GetSchemaCount();
  }

  async getColumnTemplateCount(): Promise<number> {
    if (!this.isWails) return 0;
    return App.GetColumnTemplateCount();
  }

  async getOntologyCounts(): Promise<Record<string, number>> {
    if (!this.isWails) return {};
    const result = await App.GetOntologyCounts();
    return result as Record<string, number>;
  }

  getServiceStatus(service: string): BackendStatus | undefined {
    return this._serviceStatuses().get(service);
  }

  clearLogs(): void {
    this._logs.set([]);
  }

  dismissPythonSelection(): void {
    this._showPythonSelection.set(false);
    if (this.isWails) {
      App.ClosePythonSelectionWindow();
    }
  }

  dismissBackendDownload(): void {
    this._showBackendDownload.set(false);
    if (this.isWails) {
      App.CloseDownloaderWindow();
    }
  }

  dismissValkeyDownload(): void {
    this._showValkeyDownload.set(false);
    if (this.isWails) {
      App.CloseDownloaderWindow();
    }
  }

  dismissSuperuserCreation(): void {
    this._showSuperuserCreation.set(false);
    if (this.isWails) {
      App.CloseSuperuserWindow();
    }
  }

  async openManagementPanel(): Promise<void> {
    if (!this.isWails) return;
    return App.OpenManagementPanel();
  }

  async openDebugPanel(): Promise<void> {
    if (!this.isWails) return;
    return App.OpenDebugPanel();
  }

  async closeManagementPanel(): Promise<void> {
    if (!this.isWails) return;
    return App.CloseManagementWindow();
  }

  async closeDebugPanel(): Promise<void> {
    if (!this.isWails) return;
    return App.CloseDebugWindow();
  }

  resetDownloadProgress(): void {
    this._downloadProgress.set(null);
    this._downloadComplete.set(null);
  }

  async createDatabaseBackup(): Promise<void> {
    if (!this.isWails) return;
    return App.CreateDatabaseBackup();
  }

  async createMediaBackup(): Promise<void> {
    if (!this.isWails) return;
    return App.CreateMediaBackup();
  }

  async createFullBackup(): Promise<void> {
    if (!this.isWails) return;
    return App.CreateFullBackup();
  }

  async restoreDatabase(): Promise<void> {
    if (!this.isWails) return;
    return App.RestoreDatabase();
  }

  async restoreMedia(): Promise<void> {
    if (!this.isWails) return;
    return App.RestoreMedia();
  }

  async listBackups(): Promise<BackupInfo[]> {
    if (!this.isWails) return [];
    const result = await App.ListBackups();
    return result as unknown as BackupInfo[];
  }

  async deleteBackup(backupPath: string): Promise<void> {
    if (!this.isWails) return;
    return App.DeleteBackup(backupPath);
  }

  async openBackupFolder(): Promise<void> {
    if (!this.isWails) return;
    return App.OpenBackupFolder();
  }

  async getBackupDirectory(): Promise<string> {
    if (!this.isWails) return '';
    return App.GetBackupDirectory();
  }

  async getDefaultBackupDirectory(): Promise<string> {
    if (!this.isWails) return '';
    return App.GetDefaultBackupDirectory();
  }

  async setBackupDirectory(dir: string): Promise<void> {
    if (!this.isWails) return;
    return App.SetBackupDirectory(dir);
  }

  async resetBackupDirectory(): Promise<void> {
    if (!this.isWails) return;
    return App.ResetBackupDirectory();
  }

  async selectBackupDirectory(): Promise<string> {
    if (!this.isWails) return '';
    return App.SelectBackupDirectory();
  }

  async checkForBackendUpdates(): Promise<UpdateInfo | null> {
    if (!this.isWails) return null;
    return App.CheckForBackendUpdates();
  }

  async updateBackend(version: string, createBackup: boolean): Promise<UpdateResult | null> {
    if (!this.isWails) return null;
    return App.UpdateBackend(version, createBackup);
  }

  async getCurrentBackendVersion(): Promise<string> {
    if (!this.isWails) return 'unknown';
    return App.GetCurrentBackendVersion();
  }

  async rollbackBackend(): Promise<void> {
    if (!this.isWails) return;
    return App.RollbackBackend();
  }

  async importInitialDatabase(): Promise<void> {
    if (!this.isWails) return;
    return App.ImportInitialDatabase();
  }
}
