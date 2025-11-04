import { contextBridge, ipcRenderer } from 'electron';
import { IpcRendererEvent } from 'electron';

// Define types for the exposed API
interface SplashElectronAPI {
  // Backend status updates
  onBackendStatus: (callback: (event: IpcRendererEvent, data: BackendStatus) => void) => void;

  // Backend log messages
  onBackendLog: (callback: (event: IpcRendererEvent, data: LogMessage) => void) => void;

  // Window controls
  minimizeSplash: () => void;
  closeSplash: () => void;
  continueToApp: () => void;

  // Platform detection
  platform: string;

  // Remove listeners (cleanup)
  removeAllListeners: (channel: string) => void;
}

interface BackendStatus {
  service: string;
  status: 'starting' | 'ready' | 'error';
  message: string;
}

interface LogMessage {
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

interface SplashEvents {
  emit: (eventName: string, data: any) => void;
  on: (eventName: string, callback: (data: any) => void) => void;
  off: (eventName: string, callback: (data: any) => void) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: SplashElectronAPI = {
  // Backend status updates
  onBackendStatus: (callback) => ipcRenderer.on('backend-status', callback),

  // Backend log messages
  onBackendLog: (callback) => ipcRenderer.on('backend-log', callback),

  // Window controls
  minimizeSplash: () => ipcRenderer.send('splash-minimize'),
  closeSplash: () => ipcRenderer.send('splash-close'),
  continueToApp: () => ipcRenderer.send('splash-continue'),

  // Platform detection
  platform: process.platform,

  // Remove listeners (cleanup)
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
};

contextBridge.exposeInMainWorld('splashElectronAPI', electronAPI);

// Also expose a simple event system for direct communication
const events = new Map<string, Array<(data: any) => void>>();

const splashEvents: SplashEvents = {
  emit: (eventName: string, data: any) => {
    if (events.has(eventName)) {
      const callbacks = events.get(eventName)!;
      callbacks.forEach(callback => callback(data));
    }
  },

  on: (eventName: string, callback: (data: any) => void) => {
    if (!events.has(eventName)) {
      events.set(eventName, []);
    }
    events.get(eventName)!.push(callback);
  },

  off: (eventName: string, callback: (data: any) => void) => {
    if (events.has(eventName)) {
      const callbacks = events.get(eventName)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
};

contextBridge.exposeInMainWorld('splashEvents', splashEvents);

// Declare global types for the renderer process
declare global {
  interface Window {
    splashElectronAPI: SplashElectronAPI;
    splashEvents: SplashEvents;
  }
}
