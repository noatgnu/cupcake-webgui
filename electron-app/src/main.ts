import { app, BrowserWindow, Menu, shell, dialog, ipcMain, net } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PythonManager, Config, PythonCandidate, ValidationResult } from './PythonManager';
import { BackendManager, BackendStatus, LogMessage } from './BackendManager';
import { UserManager } from './UserManager';
import { DownloaderManager, DownloadTask } from './DownloaderManager';
import { BackendDownloader } from './BackendDownloader';
import { BackendSetupManager } from './BackendSetupManager';
import { ValkeyDownloader } from './ValkeyDownloader';

// Set environment variable to indicate we're running in Electron
process.env.IS_ELECTRON_ENVIRONMENT = 'true';

// Keep a global reference of the window objects
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let backendPort: number = 8000;
let backendReady: boolean = false;
let splashReady: boolean = false;
let pythonPath: string | null = null;
let venvPath: string | null = null;

function getVenvPath(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!venvPath) {
      reject(new Error('Virtual environment path not available'));
    } else {
      resolve(venvPath);
    }
  });
}

// Configuration storage paths
const userDataPath: string = app.getPath('userData');
const configPath: string = path.join(userDataPath, 'cupcake-config.json');

// Initialize Python Manager
const pythonManager = new PythonManager();

// Initialize Backend Manager
const isDev: boolean = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const backendManager = new BackendManager(userDataPath, isDev);

// Initialize User Manager
const userManager = new UserManager(backendManager, userDataPath, isDev);

// Initialize Downloader Manager
const downloaderManager = new DownloaderManager();

// Initialize Backend Setup Manager
const backendSetupManager = new BackendSetupManager(
  userDataPath,
  isDev,
  () => {
    const config = pythonManager.loadConfig();
    const pythonPath = config.pythonPath;
    return {
      version: config.pythonVersion,
      path: pythonPath
    };
  },
  async (pythonPath: string) => {
    // Set Python configuration when portable backend is installed
    const config = pythonManager.loadConfig();
    config.pythonPath = pythonPath;

    // Detect and store Python version
    try {
      const result = await pythonManager.verifyPython(pythonPath);
      config.pythonVersion = result.version;
      console.log('Detected portable Python version:', result.version);
    } catch (error) {
      console.error('Failed to detect Python version:', error);
    }

    pythonManager.saveConfig(config);
    console.log('Python configuration updated to portable backend:', pythonPath);
  }
);

// Configuration
const allowSelfSignedCerts: boolean = isDev || process.argv.includes('--allow-self-signed');

// Allow self-signed certificates when needed
if (allowSelfSignedCerts) {
  console.log('Allowing self-signed certificates...');
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('ignore-ssl-errors');
  app.commandLine.appendSwitch('ignore-certificate-errors-spki-list');
  app.commandLine.appendSwitch('ignore-urlfetcher-cert-requests');
}

// Helper function to send status updates to splash screen and main window
function sendBackendStatus(service: string, status: 'starting' | 'ready' | 'error', message: string): void {
  console.log(`[${service}] ${status}: ${message}`);
  const backendStatus: BackendStatus = { service, status, message };

  if (splashWindow && !splashWindow.isDestroyed() && splashReady) {
    splashWindow.webContents.send('backend-status', backendStatus);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('backend-status-change', backendStatus);
  }
}

// Helper function to send log messages to splash screen
function sendBackendLog(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
  console.log(`[LOG] ${message}`);
  if (splashWindow && !splashWindow.isDestroyed() && splashReady) {
    const logMessage: LogMessage = { message, type };
    splashWindow.webContents.send('backend-log', logMessage);
  }
}


async function createVirtualEnvironmentWithLogging(pythonCmd: string): Promise<string> {
  sendBackendStatus('venv', 'starting', 'Creating virtual environment...');
  sendBackendLog('Creating virtual environment in user data directory...');

  try {
    const venvPython = await pythonManager.createVirtualEnvironment(pythonCmd);
    sendBackendStatus('venv', 'ready', 'Virtual environment created');
    sendBackendLog(`Virtual environment created successfully`, 'success');
    return venvPython;
  } catch (error) {
    sendBackendStatus('venv', 'error', `Virtual environment creation failed: ${error.message}`);
    throw error;
  }
}

// Helper function to get backend directory path
function getBackendPath(): string {
  // Backend is always in userdata directory
  return path.join(userDataPath, 'backend');
}

// Check if backend exists and prompt for download if needed
async function checkAndDownloadBackend(): Promise<boolean> {
  const backendPath = getBackendPath();
  const backendDownloader = new BackendDownloader();

  if (backendDownloader.backendExists(backendPath)) {
    console.log('Backend already exists at:', backendPath);
    return true;
  }

  console.log('Backend not found at:', backendPath);

  const choice = dialog.showMessageBoxSync(splashWindow, {
    type: 'question',
    buttons: ['Download Portable (with Python)', 'Download Source Only', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Backend Not Found',
    message: 'Backend files are not installed. Would you like to download them?',
    detail: 'Portable: Includes pre-configured Python environment (recommended)\nSource: Requires you to set up Python environment manually'
  });

  if (choice === 2) {
    return false;
  }

  const isPortable = choice === 0;

  try {
    if (isPortable) {
      const releases = await backendDownloader.getAvailableReleases();
      if (releases.length === 0) {
        dialog.showErrorBox('No Releases', 'No backend releases found on GitHub.');
        return false;
      }

      const latestRelease = releases[0];
      sendBackendLog(`Downloading backend version ${latestRelease.tag}...`, 'info');

      const task: DownloadTask = {
        title: 'Downloading Backend',
        description: `Downloading Cupcake Vanilla Backend ${latestRelease.tag}`,
        execute: async (window) => {
          const downloader = new BackendDownloader(window);
          await downloader.downloadPortable({
            version: latestRelease.tag,
            isPortable: true,
            pythonVersion: '3.11',
            destPath: backendPath
          });
        }
      };

      await downloaderManager.startDownload(task);
    } else {
      const task: DownloadTask = {
        title: 'Cloning Backend',
        description: 'Cloning Cupcake Vanilla Backend from GitHub',
        execute: async (window) => {
          const downloader = new BackendDownloader(window);
          await downloader.downloadSource(backendPath);
        }
      };

      await downloaderManager.startDownload(task);
    }

    sendBackendLog('Backend downloaded successfully', 'success');
    return true;
  } catch (error: any) {
    console.error('Backend download error:', error);
    sendBackendLog(`Backend download failed: ${error.message}`, 'error');
    dialog.showErrorBox('Download Failed', `Failed to download backend: ${error.message}`);
    return false;
  }
}

async function installDependenciesWithLogging(backendDir: string, venvPython: string): Promise<void> {
  sendBackendStatus('dependencies', 'starting', 'Installing Python dependencies...');
  sendBackendLog('Installing dependencies in virtual environment...');

  const requirementsPath = path.join(backendDir, 'requirements.txt');

  if (fs.existsSync(requirementsPath)) {
    sendBackendLog('Found requirements.txt, installing dependencies with pip...');
    try {
      await pythonManager.installDependencies(venvPython, requirementsPath);
      sendBackendStatus('dependencies', 'ready', 'Dependencies installation completed');
      sendBackendLog('All dependencies installed successfully with pip', 'success');
    } catch (error) {
      sendBackendStatus('dependencies', 'error', `Dependency installation error: ${error.message}`);
      throw error;
    }
  } else {
    sendBackendStatus('dependencies', 'error', 'requirements.txt not found');
    throw new Error('requirements.txt not found');
  }
}



// Classify process output messages based on content
function classifyProcessOutput(output: string, isStderr: boolean = false): string {
  const lowerOutput = output.toLowerCase();

  // Always treat actual errors as errors
  if (lowerOutput.includes('error:') ||
      lowerOutput.includes('exception') ||
      lowerOutput.includes('traceback') ||
      lowerOutput.includes('failed') ||
      lowerOutput.includes('critical:')) {
    return 'error';
  }

  // Django-specific informational messages that go to stderr but are not errors
  if (lowerOutput.includes('watching for file changes') ||
      lowerOutput.includes('performing system checks') ||
      lowerOutput.includes('system check identified no issues') ||
      lowerOutput.includes('starting development server') ||
      lowerOutput.includes('quit the server') ||
      lowerOutput.includes('django version') ||
      lowerOutput.includes('autoreload')) {
    return 'info';
  }

  // RQ-specific informational messages that go to stderr but are not errors
  if (lowerOutput.includes('worker started') ||
      lowerOutput.includes('listening on') ||
      lowerOutput.includes('worker rq:worker:') ||
      lowerOutput.includes('cleaned registry') ||
      lowerOutput.includes('worker registered successfully')) {
    return 'info';
  }

  // Warning indicators
  if (lowerOutput.includes('warning:') ||
      lowerOutput.includes('deprecated') ||
      lowerOutput.includes('ignore')) {
    return 'warning';
  }

  // Success indicators
  if (lowerOutput.includes('successfully') ||
      lowerOutput.includes('completed') ||
      lowerOutput.includes('ready') ||
      lowerOutput.includes('started')) {
    return 'success';
  }

  // Default classification: stderr messages that don't match patterns above are warnings
  return isStderr ? 'warning' : 'info';
}





// Create splash window
function createSplashWindow(): void {
  console.log('Creating splash window...');

  splashWindow = new BrowserWindow({
    width: 600,
    height: 500,
    show: false,
    alwaysOnTop: false,
    resizable: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform !== 'darwin',
    icon: path.join(__dirname, '..', 'public', 'cupcake_logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'splash-preload.js')
    }
  });

  const splashPath = path.join(__dirname, 'splash.html');
  splashWindow.loadFile(splashPath);

  splashWindow.once('ready-to-show', async () => {
    console.log('Splash window ready to show');
    splashReady = true;
    splashWindow.show();

    // Set up BackendManager with splash window
    backendManager.setSplashWindow(splashWindow);

    // Check if backend exists, download if needed
    const backendAvailable = await checkAndDownloadBackend();
    if (!backendAvailable) {
      sendBackendLog('Backend download cancelled or failed', 'error');
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      app.quit();
      return;
    }

    // Check if we have a portable backend (includes venv)
    const backendPath = getBackendPath();
    const backendDownloader = new BackendDownloader();
    const isPortableBackend = backendDownloader.isPortableBackend(backendPath);

    if (isPortableBackend) {
      // Portable backend - use bundled Python
      const portablePython = path.join(
        backendPath,
        'python',
        process.platform === 'win32' ? 'python.exe' : 'bin/python3'
      );
      if (fs.existsSync(portablePython)) {
        sendBackendLog('Using portable backend with bundled Python', 'success');
        initializeBackend(false, portablePython);
        return;
      }
    }

    // Check if we have valid saved configuration
    const hasValidConfig = await pythonManager.isConfigurationValid();
    if (hasValidConfig) {
      // Use saved configuration and start services directly
      const config = pythonManager.loadConfig();
      sendBackendLog(`Using saved Python: ${config.pythonPath}`, 'success');
      initializeBackend(false, config.pythonPath);
    } else {
      // Show Python selection dialog
      showPythonSelectionDialog();
    }
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
    if (!mainWindow) {
      app.quit();
    }
  });
}

// Python selection window
let pythonSelectionWindow: BrowserWindow | null = null;
let pythonCandidatesCache: PythonCandidate[] = [];

// Setup Python selection IPC handlers
function setupPythonSelectionIPC(): void {
  ipcMain.handle('python-selection-get-candidates', async () => {
    return pythonCandidatesCache;
  });

  ipcMain.on('python-selection-select', (_event, pythonPath: string) => {
    if (pythonSelectionWindow) {
      pythonSelectionWindow.close();
      pythonSelectionWindow = null;
    }
    sendBackendLog(`Selected Python: ${pythonPath}`, 'success');
    showEnvironmentSetupDialog(pythonPath);
  });

  ipcMain.on('python-selection-download-portable', async () => {
    if (pythonSelectionWindow) {
      pythonSelectionWindow.close();
      pythonSelectionWindow = null;
    }

    // Check if backend already exists
    const backendPath = getBackendPath();
    const backendDownloader = new BackendDownloader();

    if (backendDownloader.backendExists(backendPath)) {
      // Backend exists, ask if user wants to replace it
      const choice = dialog.showMessageBoxSync(splashWindow, {
        type: 'warning',
        buttons: ['Replace with Portable', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Backend Already Exists',
        message: 'Backend files already exist. Replace with portable backend?',
        detail: 'Warning: This will delete the existing backend and download a new portable version with bundled Python.\n\nExisting backend location:\n' + backendPath
      });

      if (choice === 1) {
        // User canceled, show Python selection again
        showPythonSelectionDialog();
        return;
      }
    }

    // Download portable backend
    try {
      const releases = await backendDownloader.getAvailableReleases();
      if (releases.length === 0) {
        dialog.showErrorBox('No Releases', 'No backend releases found on GitHub.');
        showPythonSelectionDialog();
        return;
      }

      const latestRelease = releases[0];
      sendBackendLog(`Downloading portable backend version ${latestRelease.tag}...`, 'info');

      const task: DownloadTask = {
        title: 'Downloading Backend',
        description: `Downloading Cupcake Vanilla Backend ${latestRelease.tag}`,
        execute: async (window) => {
          const downloader = new BackendDownloader(window);
          await downloader.downloadPortable({
            version: latestRelease.tag,
            isPortable: true,
            pythonVersion: '3.11',
            destPath: backendPath
          });
        }
      };

      await downloaderManager.startDownload(task);

      // Backend downloaded successfully, use portable Python
      const portablePython = path.join(
        backendPath,
        'python',
        process.platform === 'win32' ? 'python.exe' : 'bin/python3'
      );

      if (fs.existsSync(portablePython)) {
        sendBackendLog('Using portable backend with bundled Python', 'success');
        initializeBackend(false, portablePython);
      } else {
        dialog.showErrorBox('Error', 'Portable Python not found after download. Please try again.');
        showPythonSelectionDialog();
      }
    } catch (error: any) {
      console.error('Backend download error:', error);
      dialog.showErrorBox('Download Failed', `Failed to download portable backend: ${error.message}`);
      showPythonSelectionDialog();
    }
  });

  ipcMain.on('python-selection-browse', async () => {
    const result = dialog.showOpenDialogSync(pythonSelectionWindow, {
      title: 'Select Python Executable',
      filters: [
        { name: 'Python Executable', extensions: process.platform === 'win32' ? ['exe'] : [''] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result && result.length > 0) {
      const pythonPath = result[0];
      sendBackendLog(`Verifying selected Python: ${pythonPath}`, 'info');

      const verification = await pythonManager.verifyPython(pythonPath);
      if (verification.valid) {
        // Send custom Python to the window
        if (pythonSelectionWindow && !pythonSelectionWindow.isDestroyed()) {
          pythonSelectionWindow.webContents.send('python-selection-custom', pythonPath, verification.version, true);
        }
      } else {
        dialog.showErrorBox('Invalid Python', `The selected Python installation is not valid or is older than 3.11.\n\nFound: ${verification.version}\nRequired: Python 3.11+`);
      }
    }
  });

  ipcMain.on('python-selection-cancel', () => {
    if (pythonSelectionWindow) {
      pythonSelectionWindow.close();
      pythonSelectionWindow = null;
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  });
}

// Show Python selection dialog
async function showPythonSelectionDialog(): Promise<void> {
  sendBackendLog('Detecting Python installations...', 'info');
  pythonCandidatesCache = await pythonManager.detectPythonCandidates();

  if (pythonSelectionWindow && !pythonSelectionWindow.isDestroyed()) {
    pythonSelectionWindow.focus();
    return;
  }

  pythonSelectionWindow = new BrowserWindow({
    width: 520,
    height: 450,
    modal: true,
    parent: splashWindow,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform !== 'darwin',
    icon: path.join(__dirname, '..', 'public', 'cupcake_logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'python-selection-panel-preload.js')
    }
  });

  const htmlPath = path.join(__dirname, 'python-selection-panel.html');
  pythonSelectionWindow.loadFile(htmlPath);

  pythonSelectionWindow.once('ready-to-show', () => {
    if (pythonSelectionWindow && !pythonSelectionWindow.isDestroyed()) {
      pythonSelectionWindow.show();
    }
  });

  pythonSelectionWindow.on('closed', () => {
    pythonSelectionWindow = null;
  });
}

// Show environment setup dialog
function showEnvironmentSetupDialog(selectedPython: string): void {
  const choice = dialog.showMessageBoxSync(splashWindow, {
    type: 'question',
    buttons: ['Create Virtual Environment', 'Use Existing Virtual Environment', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Python Environment Setup',
    message: 'Choose how to set up the Python environment for Cupcake Vanilla:',
    detail: `Using Python: ${selectedPython}\n\nA virtual environment is recommended to avoid conflicts with your system Python packages.`
  });

  if (choice === 0) {
    // Create new virtual environment
    initializeBackend(true, selectedPython);
  } else if (choice === 1) {
    // Use existing virtual environment
    initializeBackend(false, selectedPython);
  } else {
    // Cancel - close splash window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  }
}

// Main window creation
function createWindow(): void {
  console.log('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '..', 'public', 'cupcake_logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev,
      preload: path.join(__dirname, 'main-preload.js')
    }
  });

  // Load Angular application based on environment
  let startUrl: string;
  if (isDev) {
    // Development: Use built files (built with electron configuration)
    const indexPath = path.join(__dirname, '..', '..', 'dist', 'cupcake-vanilla-ng', 'browser', 'index.html');
    startUrl = 'file://' + indexPath;
  } else {
    // Production: Use packaged files in resources
    const indexPath = path.join(process.resourcesPath, 'web-dist', 'browser', 'index.html');
    startUrl = 'file://' + indexPath;
  }
  console.log(`Loading main application from: ${startUrl}`);

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    backendReady = true;

    // Check for Django users and show superuser creation modal if needed
    try {
      const config = pythonManager.loadConfig();
      const backendDir = getBackendPath();
      if (config.pythonPath && venvPath) {
        // Use UserManager to handle user checking and superuser creation
        await userManager.checkAndHandleUsers(backendDir, config.pythonPath, mainWindow);
      }
    } catch (error) {
      console.error('Error checking users:', error);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Send window state changes to renderer
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-change', 'maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-change', 'unmaximized');
  });
}

// Initialize backend services
async function initializeBackend(createNewVenv: boolean = true, selectedPython: string | null = null): Promise<void> {
  try {
    sendBackendLog('Initializing Cupcake Vanilla backend services...', 'info');

    // Step 1: Use selected Python
    if (!selectedPython) {
      sendBackendStatus('python', 'error', 'No Python selected');
      dialog.showErrorBox('Python Not Selected', 'Please select a Python installation to continue.');
      return;
    }

    pythonPath = selectedPython;
    sendBackendStatus('python', 'ready', `Using Python: ${pythonPath}`);

    // Save the selected Python to configuration
    const config = pythonManager.loadConfig();
    config.pythonPath = pythonPath;
    pythonManager.saveConfig(config);

    // Get correct backend directory path based on environment
    const backendDir = getBackendPath();

    // Verify backend directory exists
    if (!fs.existsSync(backendDir)) {
      throw new Error(`Backend directory not found: ${backendDir}`);
    }

    sendBackendLog(`Using backend directory: ${backendDir}`, 'info');

    // Step 2: Handle virtual environment
    const backendDownloader = new BackendDownloader();
    const isPortable = backendDownloader.isPortableBackend(backendDir);

    if (isPortable) {
      // Portable backend has venv bundled
      venvPath = pythonPath;
      sendBackendStatus('venv', 'ready', 'Using portable virtual environment');
      sendBackendLog('Using bundled portable virtual environment', 'success');
    } else if (createNewVenv) {
      venvPath = await createVirtualEnvironmentWithLogging(pythonPath);
    } else {
      venvPath = pythonManager.checkVirtualEnvironment();
      if (!venvPath) {
        sendBackendStatus('venv', 'error', 'No existing virtual environment found');
        dialog.showErrorBox('Virtual Environment Not Found', 'No existing virtual environment found. Please create one first.');
        return;
      }
      sendBackendStatus('venv', 'ready', 'Using existing virtual environment');
      sendBackendLog('Using existing virtual environment', 'success');
    }

    // Step 3: Install dependencies (skip for portable)
    if (!isPortable) {
      await installDependenciesWithLogging(backendDir, venvPath);
      sendBackendLog('All dependencies installed successfully', 'success');
    } else {
      sendBackendLog('Skipping dependency installation for portable backend', 'info');
      sendBackendStatus('dependencies', 'ready', 'Dependencies pre-installed in portable backend');
    }
    console.log('[DEBUG] Dependencies completed, starting migrations...');
    console.log("test")
    // Step 4: Run migrations using BackendManager
    console.log('[DEBUG] About to run migrations...');
    await backendManager.runMigrations(backendDir, venvPath);
    sendBackendLog('Database migrations completed successfully', 'success');
    console.log('[DEBUG] Migrations completed, starting static files...');

    // Step 5: Collect static files
    console.log('[DEBUG] About to collect static files...');
    await backendManager.collectStaticFiles(backendDir, venvPath);
    console.log('[DEBUG] Static files completed, starting Redis server...');

    // Step 6: Kill any orphaned Django/RQ processes
    console.log('[DEBUG] Cleaning up orphaned processes...');
    await backendManager.killOrphanedDjangoProcesses();

    // Step 7: Start Redis server
    console.log('[DEBUG] About to start Redis server...');
    try {
      await backendManager.startRedisServer();
      console.log('[DEBUG] Redis server started, starting Django server...');
    } catch (error) {
      const isRedisNotFound = error.message === 'REDIS_NOT_FOUND_WINDOWS' ||
                              error.message === 'REDIS_NOT_FOUND_MAC' ||
                              error.message === 'REDIS_NOT_FOUND_LINUX';

      if (isRedisNotFound) {
        const platform = process.platform;
        const platformName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'Mac' : 'Linux';
        console.log(`[DEBUG] Redis/Valkey not found on ${platformName}, prompting for download...`);

        const choice = dialog.showMessageBoxSync(splashWindow, {
          type: 'question',
          buttons: ['Download Valkey', 'Cancel'],
          title: 'Redis/Valkey Not Found',
          message: 'Redis/Valkey server is required but not installed.',
          detail: `Would you like to download and install Valkey for ${platformName}?`
        });

        if (choice === 0) {
          const redisDir = backendManager.getRedisManager().getRedisDir();
          console.log(`[DEBUG] Valkey will be downloaded to: ${redisDir}`);

          const task: DownloadTask = {
            title: 'Downloading Valkey',
            description: `Downloading Valkey for ${platformName}`,
            execute: async (window) => {
              const downloader = new ValkeyDownloader(window);
              console.log(`[DEBUG] Starting Valkey download to: ${redisDir}`);
              await downloader.downloadValkey(redisDir);
              console.log(`[DEBUG] Valkey download completed`);
            }
          };

          await downloaderManager.startDownload(task);
          console.log('[DEBUG] Download task completed');

          // Retry starting Redis after download
          console.log('[DEBUG] Retrying Redis startup after download...');
          await backendManager.startRedisServer();
          console.log('[DEBUG] Redis server started successfully after download, starting Django server...');
        } else {
          throw new Error('Redis/Valkey is required to run the application');
        }
      } else {
        throw error;
      }
    }

    // Step 8: Start Django server
    console.log('[DEBUG] About to start Django server...');
    await backendManager.startDjangoServer(backendDir, venvPath);
    console.log('[DEBUG] Django server started, starting RQ worker...');

    // Step 9: Start RQ worker
    console.log('[DEBUG] About to start RQ worker...');
    await backendManager.startRQWorker(backendDir, venvPath);
    console.log('[DEBUG] RQ worker started, all services ready!');

    // All services ready - auto-transition to main app
    sendBackendLog('All services started successfully!', 'success');

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        console.log('Auto-transitioning to main application...');
        splashWindow.close();
        createWindow();
      }
    }, 1500);

  } catch (error) {
    console.error('Backend initialization error:', error);
    sendBackendLog(`Backend initialization error: ${error.message}`, 'error');
    dialog.showErrorBox('Backend Error', `Failed to start backend services: ${error.message}`);
  }
}

// Handle splash continue button
ipcMain.on('splash-continue', () => {
  console.log('Manual continue requested from splash screen');
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    createWindow();
  }
});

// Handle splash window controls
ipcMain.on('splash-minimize', () => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.minimize();
  }
});

ipcMain.on('splash-close', async () => {
  console.log('Splash window close requested');
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  // Clean up and quit the application
  await backendManager.stopServices();
  app.quit();
});

// IPC handlers for main window ElectronAPI
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-electron-version', () => {
  return process.versions.electron;
});

ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return await dialog.showOpenDialog(mainWindow, options);
  }
  return await dialog.showOpenDialog(options);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return await dialog.showSaveDialog(mainWindow, options);
  }
  return await dialog.showSaveDialog(options);
});

ipcMain.handle('show-message-box', async (event, options) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return await dialog.showMessageBox(mainWindow, options);
  }
  return await dialog.showMessageBox(options);
});

ipcMain.handle('get-backend-port', () => {
  return backendPort;
});

ipcMain.handle('is-backend-ready', () => {
  return backendReady;
});

ipcMain.handle('download-file', async (event, url: string, filename?: string) => {
  try {
    // Get the main window to use for the download
    const window = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

    if (!window) {
      throw new Error('No window available for download');
    }

    // Default filename if none provided
    let downloadFilename = filename;
    if (!downloadFilename) {
      try {
        const urlPath = new URL(url).pathname;
        downloadFilename = path.basename(urlPath) || 'download.file';
      } catch {
        downloadFilename = 'download.file';
      }
    }

    // Show save dialog to let user choose location and filename
    const saveResult = await (dialog.showSaveDialog as any)(window, {
      defaultPath: path.join(app.getPath('downloads'), downloadFilename),
      filters: [
        { name: 'Tab-separated values', extensions: ['tsv'] }
      ]
    });

    // Handle both possible return types (string or object)
    let savePath: string;
    if (typeof saveResult === 'string') {
      savePath = saveResult;
    } else if (saveResult && typeof saveResult === 'object' && 'filePath' in saveResult) {
      if (saveResult.canceled) {
        throw new Error('Download cancelled by user');
      }
      savePath = saveResult.filePath;
    } else {
      throw new Error('Download cancelled by user or no save path selected');
    }

    if (!savePath) {
      throw new Error('Download cancelled by user or no save path selected');
    }

    // Use Electron's net module with session context for better reliability
    return new Promise((resolve, reject) => {
      console.log(`Starting download from ${url} to ${savePath}`);

      const request = net.request({
        method: 'GET',
        url: url,
        session: window.webContents.session
      });

      const chunks: Buffer[] = [];

      request.on('response', (response) => {
        console.log(`Response status: ${response.statusCode}`);
        console.log(`Response headers:`, response.headers);

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          console.log(`Received chunk: ${chunk.length} bytes, total: ${Buffer.concat(chunks).length} bytes`);
        });

        response.on('end', () => {
          clearTimeout(timeout);
          const buffer = Buffer.concat(chunks);
          console.log(`Download completed - Total bytes received: ${buffer.length}`);

          try {
            fs.writeFileSync(savePath, buffer);
            console.log(`File written successfully to: ${savePath}`);
            resolve(savePath);
          } catch (writeError: any) {
            console.error('File write error:', writeError);
            reject(new Error(`Failed to write file: ${writeError.message}`));
          }
        });

        response.on('error', (error: any) => {
          clearTimeout(timeout);
          console.error('Response error:', error);
          reject(new Error(`Download failed: ${error.message}`));
        });
      });

      request.on('error', (error: any) => {
        clearTimeout(timeout);
        console.error('Request error:', error);
        reject(new Error(`Request failed: ${error.message}`));
      });

      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('Request timeout - aborting');
        request.abort();
        reject(new Error('Download timeout after 60 seconds'));
      }, 60000);

      console.log('Sending request...');
      request.end();
    });
  } catch (error) {
    throw error;
  }
});

// App event handlers
app.whenReady().then(() => {
  createMenu();
  setupPythonSelectionIPC();
  createSplashWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (backendReady) {
        createWindow();
      } else {
        createSplashWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isQuitting = false;

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;

    console.log('Application quitting, stopping backend services...');

    try {
      await backendManager.stopServices();
      console.log('Backend services stopped successfully');
    } catch (error) {
      console.error('Error stopping backend services:', error);
    }

    // Force quit after cleanup
    app.exit(0);
  }
});

// Management panel functions
async function openManagementPanel(): Promise<void> {
  console.log('[Management] Opening management panel...');

  if (!userManager || !backendManager) {
    console.log('[Management] UserManager or BackendManager not initialized');
    return;
  }

  if (!mainWindow) {
    console.log('[Management] Main window not available');
    return;
  }

  try {
    const backendDir = getBackendPath();
    console.log('[Management] Backend directory:', backendDir);

    // Use the global venvPath directly instead of the promise wrapper
    if (!venvPath) {
      throw new Error('Virtual environment path not available');
    }
    console.log('[Management] Virtual environment path:', venvPath);

    // Always allow access to management panel, regardless of setup status
    // Set both to false since we're not restricting access based on setup completion
    const needsSchemas = false;
    const needsColumnTemplates = false;

    console.log('[Management] Opening management panel with full access');

    await userManager.showManagementPanel(backendDir, venvPath, needsSchemas, needsColumnTemplates, mainWindow);
    console.log('[Management] Management panel opened successfully');
  } catch (error) {
    console.error('[Management] Error opening management panel:', error);
    dialog.showErrorBox('Management Panel Error', `Failed to open management panel: ${error.message}`);
  }
}

function openDebugPanel(): void {
  if (!userManager) {
    console.log('[Debug] UserManager not initialized');
    return;
  }

  try {
    userManager.showDebugPanel(mainWindow);
  } catch (error) {
    console.error('[Debug] Error opening debug panel:', error);
    dialog.showErrorBox('Debug Panel Error', `Failed to open debug panel: ${error.message}`);
  }
}

function openBackendSetup(): void {
  try {
    backendSetupManager.showSetupPanel(mainWindow);
  } catch (error: any) {
    console.error('[Backend Setup] Error opening backend setup panel:', error);
    dialog.showErrorBox('Backend Setup Error', `Failed to open backend setup panel: ${error.message}`);
  }
}


// Menu setup
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Management',
      submenu: [
        {
          label: 'Database Setup',
          click: () => openManagementPanel()
        },
        {
          label: 'Backend Setup',
          click: () => openBackendSetup()
        },
        { type: 'separator' },
        {
          label: 'Open User Data Folder',
          click: () => shell.openPath(userDataPath)
        },
        { type: 'separator' },
        {
          label: 'Debug Panel',
          click: () => openDebugPanel()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

