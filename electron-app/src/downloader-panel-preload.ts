import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script for downloader panel
 * Provides secure IPC communication between renderer and main process
 */

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

contextBridge.exposeInMainWorld('downloaderAPI', {
  cancel: () => ipcRenderer.send('downloader-cancel'),

  onProgress: (callback: (progress: DownloadProgress) => void) => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
  },

  onStatus: (callback: (status: DownloadStatus) => void) => {
    ipcRenderer.on('download-status', (_event, status) => callback(status));
  },

  onComplete: (callback: (success: boolean, message: string) => void) => {
    ipcRenderer.on('download-complete', (_event, success, message) => callback(success, message));
  }
});