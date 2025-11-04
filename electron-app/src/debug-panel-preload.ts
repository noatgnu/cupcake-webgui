import { contextBridge, ipcRenderer } from 'electron';

interface DebugElectronAPI {
  startDebugOutput: () => void;
  stopDebugOutput: () => void;
  clearDebugOutput: () => void;
  onBackendOutput: (callback: (event: any, data: string) => void) => void;
  onWorkerOutput: (callback: (event: any, data: string) => void) => void;
  onConnectionStatus: (callback: (event: any, status: 'connected' | 'disconnected' | 'connecting') => void) => void;
  exportLogs: (type: 'backend' | 'workers' | 'all', data: string) => void;
}

const debugAPI: DebugElectronAPI = {
  startDebugOutput: () => {
    console.log('Starting debug output...');
    ipcRenderer.send('start-debug-output');
  },

  stopDebugOutput: () => {
    console.log('Stopping debug output...');
    ipcRenderer.send('stop-debug-output');
  },

  clearDebugOutput: () => {
    console.log('Clearing debug output...');
    ipcRenderer.send('clear-debug-output');
  },

  onBackendOutput: (callback) => {
    ipcRenderer.on('backend-output', callback);
  },

  onWorkerOutput: (callback) => {
    ipcRenderer.on('worker-output', callback);
  },

  onConnectionStatus: (callback) => {
    ipcRenderer.on('debug-connection-status', callback);
  },

  exportLogs: (type, data) => {
    ipcRenderer.send('export-debug-logs', { type, data });
  }
};

contextBridge.exposeInMainWorld('debugAPI', debugAPI);

console.log('Debug panel preload script loaded');