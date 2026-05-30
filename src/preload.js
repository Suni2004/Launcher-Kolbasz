const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kolbasz', {
  readSettings: () => ipcRenderer.invoke('settings:read'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  detectLauncher: () => ipcRenderer.invoke('launcher:detect'),
  openOfficial: (settings) => ipcRenderer.invoke('launcher:open-official', settings),
  launchJar: (settings) => ipcRenderer.invoke('launcher:launch-jar', settings),
  loginMicrosoft: (options) => ipcRenderer.invoke('auth:microsoft-login', options),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onLaunchStatus: (callback) => {
    ipcRenderer.removeAllListeners('launcher:status');
    ipcRenderer.on('launcher:status', (_, status) => callback(status));
  },
  pickFile: (options) => ipcRenderer.invoke('dialog:pick-file', options),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder')
});
