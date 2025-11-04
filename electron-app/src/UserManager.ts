import { BrowserWindow, ipcMain } from 'electron';
import { BackendManager } from './BackendManager';
import * as path from 'path';
import * as fs from 'fs';

export class UserManager {
  private backendManager: BackendManager;
  private userDataPath: string;
  private isDev: boolean;
  private debugWindow: BrowserWindow | null = null;
  private debugOutputInterval: NodeJS.Timeout | null = null;
  private commandHistoryPath: string;

  constructor(backendManager: BackendManager, userDataPath: string, isDev: boolean) {
    this.backendManager = backendManager;
    this.userDataPath = userDataPath;
    this.isDev = isDev;
    this.commandHistoryPath = path.join(userDataPath, 'management-command-history.json');
  }

  async checkAndHandleUsers(backendDir: string, pythonPath: string, parentWindow?: BrowserWindow): Promise<void> {
    try {
      const userCount = await this.getUserCount(backendDir, pythonPath);

      console.log(`[UserManager] Found ${userCount} users in database`);

      if (userCount === 0) {
        console.log('[UserManager] No users found, setting up superuser creation...');
        await this.showSuperuserCreationModal(backendDir, pythonPath, parentWindow);
      } else {
        console.log(`[UserManager] Found ${userCount} existing users, no action needed`);
      }
    } catch (error) {
      console.error('[UserManager] Error checking users:', error);
      throw error;
    }
  }

  private async getUserCount(backendDir: string, pythonPath: string): Promise<number> {
    const pythonCode = 'from django.contrib.auth.models import User; print(User.objects.count())';
    const output = await this.backendManager.runDjangoShellCommand(backendDir, pythonPath, pythonCode);

    // Parse the output to get user count
    const lines = output.trim().split('\n').filter(line => line.trim() !== '');
    const userCountStr = lines[lines.length - 1];
    const userCount = parseInt(userCountStr);

    return isNaN(userCount) ? 0 : userCount;
  }

  private async showSuperuserCreationModal(backendDir: string, pythonPath: string, parentWindow?: BrowserWindow): Promise<void> {
    return new Promise<void>((resolve) => {
      let promptWindow: BrowserWindow | null = new BrowserWindow({
        width: 500,
        height: 650,
        modal: true,
        parent: parentWindow,
        show: false,
        resizable: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: process.platform !== 'darwin',
        icon: path.join(__dirname, '..', 'public', 'cupcake_logo.png'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'superuser-modal-preload.js')
        }
      });

      // Load HTML from file
      const htmlPath = path.join(__dirname, 'superuser-modal.html');
      promptWindow.loadFile(htmlPath);

      promptWindow.once('ready-to-show', () => {
        promptWindow.show();
      });

      // Handle superuser creation
      ipcMain.once('create-superuser', async (event, userData) => {
        try {
          await this.createSuperuser(backendDir, pythonPath, userData.username, userData.email, userData.password);
          event.reply('superuser-created', true, 'Superuser created successfully');

          // After successful superuser creation, check for schemas and column templates
          setTimeout(async () => {
            if (promptWindow && !promptWindow.isDestroyed()) {
              promptWindow.close();
            }
            await this.showManagementPanelIfNeeded(backendDir, pythonPath, parentWindow);
          }, 1000);
        } catch (error) {
          event.reply('superuser-created', false, error.message);
        }
      });

      // Handle cancel
      ipcMain.once('cancel-superuser', () => {
        if (promptWindow && !promptWindow.isDestroyed()) {
          promptWindow.close();
        }
      });

      // Handle close window
      ipcMain.once('close-superuser-window', () => {
        if (promptWindow && !promptWindow.isDestroyed()) {
          promptWindow.close();
        }
      });

      promptWindow.on('closed', () => {
        promptWindow = null;
        resolve();
      });
    });
  }

  private async createSuperuser(backendDir: string, pythonPath: string, username: string, email: string, password: string): Promise<void> {
    const pythonCode = `
from django.contrib.auth.models import User
try:
    user = User.objects.create_superuser('${username}', '${email}', '${password}')
    print(f'Superuser "${username}" created successfully')
except Exception as e:
    print(f'Error creating superuser: {e}')
    exit(1)
`;

    const output = await this.backendManager.runDjangoShellCommand(backendDir, pythonPath, pythonCode);

    if (!output.includes('created successfully')) {
      throw new Error(`Failed to create superuser: ${output}`);
    }

    console.log(`[UserManager] Superuser "${username}" created successfully`);
  }

  private async showManagementPanelIfNeeded(backendDir: string, pythonPath: string, parentWindow?: BrowserWindow): Promise<void> {
    try {
      const needsSchemas = !(await this.backendManager.checkSchemas(backendDir, pythonPath));
      const needsColumnTemplates = !(await this.backendManager.checkColumnTemplates(backendDir, pythonPath));

      if (needsSchemas || needsColumnTemplates) {
        await this.showManagementPanel(backendDir, pythonPath, needsSchemas, needsColumnTemplates, parentWindow);
      }
    } catch (error) {
      console.error('[UserManager] Error checking management requirements:', error);
    }
  }

  async showManagementPanel(backendDir: string, pythonPath: string, needsSchemas: boolean, needsColumnTemplates: boolean, parentWindow?: BrowserWindow): Promise<void> {
    return new Promise<void>((resolve) => {
      let managementWindow: BrowserWindow | null = new BrowserWindow({
        width: 600,
        height: 500,
        modal: true,
        parent: parentWindow,
        show: false,
        resizable: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: process.platform !== 'darwin',
        icon: path.join(__dirname, '..', 'public', 'cupcake_logo.png'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'management-panel-preload.js')
        }
      });

      const htmlPath = path.join(__dirname, 'management-panel.html');
      managementWindow.loadFile(htmlPath);

      managementWindow.once('ready-to-show', async () => {
        managementWindow.show();
        const commandHistory = this.loadCommandHistory();

        // Fetch counts in parallel
        const [schemasCount, templatesCount, ontologyCounts] = await Promise.all([
          this.backendManager.getSchemaCount(backendDir, pythonPath).catch(() => 0),
          this.backendManager.getColumnTemplateCount(backendDir, pythonPath).catch(() => 0),
          this.backendManager.getOntologyCounts(backendDir, pythonPath).catch(() => ({
            mondo: 0, uberon: 0, ncbi: 0, chebi: 0, psims: 0, cell: 0, total: 0
          }))
        ]);

        const counts = {
          schemas: schemasCount,
          templates: templatesCount,
          ontologies: ontologyCounts
        };

        managementWindow.webContents.send('setup-panel', { needsSchemas, needsColumnTemplates, commandHistory, counts });
      });

      // Handle schema initialization
      ipcMain.on('run-sync-schemas', async (event) => {
        try {
          event.reply('command-progress', 'sync-schemas', 'running', 'Running sync_schemas command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'sync_schemas',
            [],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'sync-schemas', output, type);
            }
          );
          const successMessage = 'Schema synchronization completed successfully';
          event.reply('command-progress', 'sync-schemas', 'completed', successMessage);
          this.recordCommandExecution('sync-schemas', true, successMessage);
        } catch (error) {
          const errorMessage = `Schema synchronization failed: ${error.message}`;
          event.reply('command-progress', 'sync-schemas', 'error', errorMessage);
          this.recordCommandExecution('sync-schemas', false, errorMessage);
        }
      });

      // Handle column template initialization
      ipcMain.on('run-load-column-templates', async (event) => {
        try {
          event.reply('command-progress', 'load-column-templates', 'running', 'Running load_column_templates command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'load_column_templates',
            [],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'load-column-templates', output, type);
            }
          );
          const successMessage = 'Column templates loaded successfully';
          event.reply('command-progress', 'load-column-templates', 'completed', successMessage);
          this.recordCommandExecution('load-column-templates', true, successMessage);
        } catch (error) {
          const errorMessage = `Column templates loading failed: ${error.message}`;
          event.reply('command-progress', 'load-column-templates', 'error', errorMessage);
          this.recordCommandExecution('load-column-templates', false, errorMessage);
        }
      });

      // Handle skip
      ipcMain.on('skip-management', () => {
        if (managementWindow && !managementWindow.isDestroyed()) {
          managementWindow.close();
        }
      });

      // Handle load_ms_mod
      ipcMain.on('run-load-ms-mod', async (event) => {
        try {
          event.reply('command-progress', 'load-ms-mod', 'running', 'Running load_ms_mod command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'load_ms_mod',
            [],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'load-ms-mod', output, type);
            }
          );
          const successMessage = 'MS modifications loaded successfully';
          event.reply('command-progress', 'load-ms-mod', 'completed', successMessage);
          this.recordCommandExecution('load-ms-mod', true, successMessage);
        } catch (error) {
          const errorMessage = `MS modifications loading failed: ${error.message}`;
          event.reply('command-progress', 'load-ms-mod', 'error', errorMessage);
          this.recordCommandExecution('load-ms-mod', false, errorMessage);
        }
      });

      // Handle load_ms_term
      ipcMain.on('run-load-ms-term', async (event) => {
        try {
          event.reply('command-progress', 'load-ms-term', 'running', 'Running load_ms_term command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'load_ms_term',
            [],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'load-ms-term', output, type);
            }
          );
          const successMessage = 'MS terms loaded successfully';
          event.reply('command-progress', 'load-ms-term', 'completed', successMessage);
          this.recordCommandExecution('load-ms-term', true, successMessage);
        } catch (error) {
          const errorMessage = `MS terms loading failed: ${error.message}`;
          event.reply('command-progress', 'load-ms-term', 'error', errorMessage);
          this.recordCommandExecution('load-ms-term', false, errorMessage);
        }
      });

      // Handle load_species
      ipcMain.on('run-load-species', async (event) => {
        try {
          event.reply('command-progress', 'load-species', 'running', 'Running load_species command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'load_species',
            [],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'load-species', output, type);
            }
          );
          const successMessage = 'Species data loaded successfully';
          event.reply('command-progress', 'load-species', 'completed', successMessage);
          this.recordCommandExecution('load-species', true, successMessage);
        } catch (error) {
          const errorMessage = `Species data loading failed: ${error.message}`;
          event.reply('command-progress', 'load-species', 'error', errorMessage);
          this.recordCommandExecution('load-species', false, errorMessage);
        }
      });

      // Handle load_subcellular_location
      ipcMain.on('run-load-subcellular-location', async (event) => {
        try {
          event.reply('command-progress', 'load-subcellular-location', 'running', 'Running load_subcellular_location command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'load_subcellular_location',
            [],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'load-subcellular-location', output, type);
            }
          );
          const successMessage = 'Subcellular location data loaded successfully';
          event.reply('command-progress', 'load-subcellular-location', 'completed', successMessage);
          this.recordCommandExecution('load-subcellular-location', true, successMessage);
        } catch (error) {
          const errorMessage = `Subcellular location data loading failed: ${error.message}`;
          event.reply('command-progress', 'load-subcellular-location', 'error', errorMessage);
          this.recordCommandExecution('load-subcellular-location', false, errorMessage);
        }
      });

      // Handle load_tissue
      ipcMain.on('run-load-tissue', async (event) => {
        try {
          event.reply('command-progress', 'load-tissue', 'running', 'Running load_tissue command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'load_tissue',
            [],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'load-tissue', output, type);
            }
          );
          const successMessage = 'Tissue data loaded successfully';
          event.reply('command-progress', 'load-tissue', 'completed', successMessage);
          this.recordCommandExecution('load-tissue', true, successMessage);
        } catch (error) {
          const errorMessage = `Tissue data loading failed: ${error.message}`;
          event.reply('command-progress', 'load-tissue', 'error', errorMessage);
          this.recordCommandExecution('load-tissue', false, errorMessage);
        }
      });

      // Handle load_ontologies
      ipcMain.on('run-load-ontologies', async (event) => {
        try {
          event.reply('command-progress', 'load-ontologies', 'running', 'Running load_ontologies --no-limit command...');
          await this.backendManager.runManagementCommand(
            backendDir,
            pythonPath,
            'load_ontologies',
            ['--no-limit'],
            (output, isError) => {
              const type = isError ? 'error' : 'info';
              event.reply('command-output', 'load-ontologies', output, type);
            }
          );
          const successMessage = 'Ontologies loaded successfully';
          event.reply('command-progress', 'load-ontologies', 'completed', successMessage);
          this.recordCommandExecution('load-ontologies', true, successMessage);
        } catch (error) {
          const errorMessage = `Ontologies loading failed: ${error.message}`;
          event.reply('command-progress', 'load-ontologies', 'error', errorMessage);
          this.recordCommandExecution('load-ontologies', false, errorMessage);
        }
      });

      // Handle close window
      ipcMain.on('close-management-window', () => {
        if (managementWindow && !managementWindow.isDestroyed()) {
          managementWindow.close();
        }
      });

      managementWindow.on('closed', () => {
        // Clean up IPC handlers
        ipcMain.removeAllListeners('run-sync-schemas');
        ipcMain.removeAllListeners('run-load-column-templates');
        ipcMain.removeAllListeners('skip-management');
        ipcMain.removeAllListeners('run-load-ms-mod');
        ipcMain.removeAllListeners('run-load-ms-term');
        ipcMain.removeAllListeners('run-load-species');
        ipcMain.removeAllListeners('run-load-subcellular-location');
        ipcMain.removeAllListeners('run-load-tissue');
        ipcMain.removeAllListeners('run-load-ontologies');
        ipcMain.removeAllListeners('close-management-window');

        managementWindow = null;
        resolve();
      });
    });
  }

  showDebugPanel(parentWindow?: BrowserWindow): void {
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      this.debugWindow.show();
      return;
    }

    this.debugWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      modal: false,
      show: false,
      alwaysOnTop: false,
      focusable: true,
      title: 'Debug Panel - Live Backend Output',
      icon: path.join(__dirname, '..', 'public', 'cupcake_logo.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'debug-panel-preload.js'),
        webSecurity: this.isDev ? false : true
      },
      titleBarStyle: 'default',
      backgroundColor: '#1e1e1e'
    });

    this.debugWindow.loadFile(path.join(__dirname, 'debug-panel.html'));

    this.debugWindow.once('ready-to-show', () => {
      if (this.debugWindow && !this.debugWindow.isDestroyed()) {
        this.debugWindow.show();
        this.setupDebugHandlers();
      }
    });

    this.debugWindow.on('closed', () => {
      this.cleanupDebugHandlers();
      this.debugWindow = null;
    });

    if (this.isDev) {
      this.debugWindow.webContents.openDevTools();
    }
  }

  private setupDebugHandlers(): void {
    // Handle debug panel IPC events
    ipcMain.on('start-debug-output', () => {
      console.log('[UserManager] Starting debug output streaming...');
      this.startDebugOutputStreaming();
    });

    ipcMain.on('stop-debug-output', () => {
      console.log('[UserManager] Stopping debug output streaming...');
      this.stopDebugOutputStreaming();
    });

    ipcMain.on('clear-debug-output', () => {
      console.log('[UserManager] Clearing debug output...');
      // No specific action needed - the frontend handles clearing
    });

    ipcMain.on('export-debug-logs', (event, data) => {
      console.log('[UserManager] Exporting debug logs...');
      // Could implement file save dialog here if needed
    });

    // Subscribe to backend output
    this.backendManager.onOutput((data) => {
      if (this.debugWindow && !this.debugWindow.isDestroyed()) {
        this.debugWindow.webContents.send('backend-output', data);
      }
    });

    // Send initial connection status
    if (this.debugWindow && !this.debugWindow.isDestroyed()) {
      const status = this.backendManager.isRunning() ? 'connected' : 'disconnected';
      this.debugWindow.webContents.send('debug-connection-status', status);
    }
  }

  private cleanupDebugHandlers(): void {
    ipcMain.removeAllListeners('start-debug-output');
    ipcMain.removeAllListeners('stop-debug-output');
    ipcMain.removeAllListeners('clear-debug-output');
    ipcMain.removeAllListeners('export-debug-logs');
    this.stopDebugOutputStreaming();
  }

  private startDebugOutputStreaming(): void {
    if (this.debugOutputInterval) {
      clearInterval(this.debugOutputInterval);
    }

    // Send periodic status updates
    this.debugOutputInterval = setInterval(() => {
      if (this.debugWindow && !this.debugWindow.isDestroyed()) {
        const status = this.backendManager.isRunning() ? 'connected' : 'disconnected';
        this.debugWindow.webContents.send('debug-connection-status', status);
      }
    }, 5000);

    console.log('[UserManager] Debug output streaming started');
  }

  private stopDebugOutputStreaming(): void {
    if (this.debugOutputInterval) {
      clearInterval(this.debugOutputInterval);
      this.debugOutputInterval = null;
    }
    console.log('[UserManager] Debug output streaming stopped');
  }

  private loadCommandHistory(): Record<string, any> {
    try {
      if (fs.existsSync(this.commandHistoryPath)) {
        const data = fs.readFileSync(this.commandHistoryPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[UserManager] Error loading command history:', error);
    }
    return {};
  }

  private saveCommandHistory(history: Record<string, any>): void {
    try {
      fs.writeFileSync(this.commandHistoryPath, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('[UserManager] Error saving command history:', error);
    }
  }

  private recordCommandExecution(command: string, success: boolean, message: string): void {
    const history = this.loadCommandHistory();
    history[command] = {
      lastRun: new Date().toISOString(),
      success: success,
      message: message
    };
    this.saveCommandHistory(history);
  }
}
