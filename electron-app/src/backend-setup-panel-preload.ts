import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script for backend setup panel
 */

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

contextBridge.exposeInMainWorld('backendSetupAPI', {
  getStatus: (): Promise<BackendSetupStatus> => ipcRenderer.invoke('backend-setup-get-status'),

  downloadPortable: () => ipcRenderer.send('backend-setup-download-portable'),
  downloadSource: () => ipcRenderer.send('backend-setup-download-source'),
  downloadValkey: () => ipcRenderer.send('backend-setup-download-valkey'),
  changePython: () => ipcRenderer.send('backend-setup-change-python'),
  refresh: () => ipcRenderer.send('backend-setup-refresh'),

  onStatusUpdate: (callback: (status: BackendSetupStatus) => void) => {
    ipcRenderer.on('backend-setup-status-update', (_event, status) => callback(status));
  }
});