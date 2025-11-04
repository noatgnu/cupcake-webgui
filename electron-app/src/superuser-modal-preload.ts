import { contextBridge, ipcRenderer } from 'electron';
import { IpcRendererEvent } from 'electron';

// Define types for the superuser modal API
interface SuperuserElectronAPI {
  // Superuser creation
  createSuperuser: (userData: SuperuserData) => void;

  // Modal controls
  cancelSuperuser: () => void;
  closeSuperuserWindow: () => void;

  // Listen for superuser creation result
  onSuperuserCreated: (callback: (event: IpcRendererEvent, success: boolean, message: string) => void) => void;

  // Cleanup
  removeAllListeners: (channel: string) => void;
}

interface SuperuserData {
  username: string;
  email: string;
  password: string;
}

// Expose protected methods for the superuser modal
const electronAPI: SuperuserElectronAPI = {
  // Superuser creation
  createSuperuser: (userData) => ipcRenderer.send('create-superuser', userData),

  // Modal controls
  cancelSuperuser: () => ipcRenderer.send('cancel-superuser'),
  closeSuperuserWindow: () => ipcRenderer.send('close-superuser-window'),

  // Listen for superuser creation result
  onSuperuserCreated: (callback) => ipcRenderer.on('superuser-created', callback),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
};

contextBridge.exposeInMainWorld('superuserAPI', electronAPI);

// Declare global types for the renderer process
declare global {
  interface Window {
    superuserAPI: SuperuserElectronAPI;
  }
}
