import { contextBridge, ipcRenderer } from 'electron';

interface ManagementElectronAPI {
  runSyncSchemas: () => void;
  runLoadColumnTemplates: () => void;
  runLoadMsMod: () => void;
  runLoadMsTerm: () => void;
  runLoadSpecies: () => void;
  runLoadSubcellularLocation: () => void;
  runLoadTissue: () => void;
  runLoadOntologies: () => void;
  skipManagement: () => void;
  closeManagementWindow: () => void;

  onSetupPanel: (callback: (event: any, data: { needsSchemas: boolean; needsColumnTemplates: boolean }) => void) => void;
  onCommandProgress: (callback: (event: any, command: string, status: string, message: string) => void) => void;
  onCommandOutput: (callback: (event: any, command: string, output: string, type: string) => void) => void;
}

const electronAPI: ManagementElectronAPI = {
  runSyncSchemas: () => ipcRenderer.send('run-sync-schemas'),
  runLoadColumnTemplates: () => ipcRenderer.send('run-load-column-templates'),
  runLoadMsMod: () => ipcRenderer.send('run-load-ms-mod'),
  runLoadMsTerm: () => ipcRenderer.send('run-load-ms-term'),
  runLoadSpecies: () => ipcRenderer.send('run-load-species'),
  runLoadSubcellularLocation: () => ipcRenderer.send('run-load-subcellular-location'),
  runLoadTissue: () => ipcRenderer.send('run-load-tissue'),
  runLoadOntologies: () => ipcRenderer.send('run-load-ontologies'),
  skipManagement: () => ipcRenderer.send('skip-management'),
  closeManagementWindow: () => ipcRenderer.send('close-management-window'),

  onSetupPanel: (callback) => ipcRenderer.on('setup-panel', callback),
  onCommandProgress: (callback) => ipcRenderer.on('command-progress', callback),
  onCommandOutput: (callback) => ipcRenderer.on('command-output', callback)
};

contextBridge.exposeInMainWorld('managementAPI', electronAPI);

declare global {
  interface Window {
    managementAPI: ManagementElectronAPI;
  }
}