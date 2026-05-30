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
  friendsProfile: (settings) => ipcRenderer.invoke('friends:profile', settings),
  friendsList: (settings) => ipcRenderer.invoke('friends:list', settings),
  friendsAdd: (options) => ipcRenderer.invoke('friends:add', options),
  friendsAccept: (options) => ipcRenderer.invoke('friends:accept', options),
  friendsReject: (options) => ipcRenderer.invoke('friends:reject', options),
  friendsMessages: (options) => ipcRenderer.invoke('friends:messages', options),
  friendsSend: (options) => ipcRenderer.invoke('friends:send', options),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onLaunchStatus: (callback) => {
    ipcRenderer.removeAllListeners('launcher:status');
    ipcRenderer.on('launcher:status', (_, status) => callback(status));
  },
  pickFile: (options) => ipcRenderer.invoke('dialog:pick-file', options),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder')
});
