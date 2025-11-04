import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  platform: string;
  isElectron: boolean;

  // App information
  getAppVersion(): Promise<string>;
  getElectronVersion(): Promise<string>;

  // Window controls
  minimize(): void;
  maximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;

  // File operations
  showOpenDialog(options?: any): Promise<any>;
  showSaveDialog(options?: any): Promise<any>;
  showMessageBox(options: any): Promise<any>;
  downloadFile(url: string, filename?: string): Promise<string>;

  // Backend communication
  getBackendPort(): Promise<number>;
  isBackendReady(): Promise<boolean>;

  // Listeners for events from main process
  onBackendStatusChange(callback: (status: any) => void): () => void;
  onWindowStateChange(callback: (state: 'maximized' | 'unmaximized') => void): () => void;
}

const electronAPI: ElectronAPI = {
  platform: process.platform,
  isElectron: true,

  // App information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getElectronVersion: () => ipcRenderer.invoke('get-electron-version'),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // File operations
  showOpenDialog: (options?: any) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options?: any) => ipcRenderer.invoke('show-save-dialog', options),
  showMessageBox: (options: any) => ipcRenderer.invoke('show-message-box', options),
  downloadFile: (url: string, filename?: string) => ipcRenderer.invoke('download-file', url, filename),

  // Backend communication
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  isBackendReady: () => ipcRenderer.invoke('is-backend-ready'),

  // Event listeners
  onBackendStatusChange: (callback: (status: any) => void) => {
    const subscription = (_event: any, status: any) => callback(status);
    ipcRenderer.on('backend-status-change', subscription);
    return () => ipcRenderer.removeListener('backend-status-change', subscription);
  },

  onWindowStateChange: (callback: (state: 'maximized' | 'unmaximized') => void) => {
    const subscription = (_event: any, state: 'maximized' | 'unmaximized') => callback(state);
    ipcRenderer.on('window-state-change', subscription);
    return () => ipcRenderer.removeListener('window-state-change', subscription);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}