const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kolbasz', {
  readSettings: () => ipcRenderer.invoke('settings:read'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  detectLauncher: () => ipcRenderer.invoke('launcher:detect'),
  openOfficial: (settings) => ipcRenderer.invoke('launcher:open-official', settings),
  launchJar: (settings) => ipcRenderer.invoke('launcher:launch-jar', settings),
  loginMicrosoft: (options) => ipcRenderer.invoke('auth:microsoft-login', options),
  searchModrinth: (options) => ipcRenderer.invoke('modrinth:search', options),
  installModrinth: (options) => ipcRenderer.invoke('modrinth:install', options),
  listMods: (options) => ipcRenderer.invoke('mods:list', options),
  toggleMod: (options) => ipcRenderer.invoke('mods:toggle', options),
  deleteMod: (options) => ipcRenderer.invoke('mods:delete', options),
  openModsFolder: (options) => ipcRenderer.invoke('mods:open-folder', options),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onLaunchStatus: (callback) => {
    ipcRenderer.removeAllListeners('launcher:status');
    ipcRenderer.on('launcher:status', (_, status) => callback(status));
  },
  pickFile: (options) => ipcRenderer.invoke('dialog:pick-file', options),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder')
});
