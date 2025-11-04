import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pythonSelectionAPI', {
  getPythonCandidates: () => ipcRenderer.invoke('python-selection-get-candidates'),
  selectPython: (pythonPath: string) => ipcRenderer.send('python-selection-select', pythonPath),
  downloadPortable: () => ipcRenderer.send('python-selection-download-portable'),
  browsePython: () => ipcRenderer.send('python-selection-browse'),
  cancel: () => ipcRenderer.send('python-selection-cancel'),
  onCustomPython: (callback: (pythonPath: string, version: string, isValid: boolean) => void) => {
    ipcRenderer.on('python-selection-custom', (_event, pythonPath, version, isValid) => {
      callback(pythonPath, version, isValid);
    });
  }
});
