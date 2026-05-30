const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth, lexicon } = require('msmc');

const DEFAULT_SETTINGS = {
  authMode: 'offline',
  playerName: 'KolbaszPlayer',
  microsoftName: '',
  microsoftRefreshToken: '',
  version: '1.21.10',
  memoryGb: 4,
  javaPath: '',
  jarPath: '',
  gameDir: ''
};

let mainWindow;

function appVersion() {
  return app.getVersion();
}

function compareVersions(a, b) {
  const left = String(a).split('.').map(Number);
  const right = String(b).split('.').map(Number);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function readUpdateSource() {
  const candidates = [
    path.join(process.resourcesPath || '', 'assets', 'update-source.json'),
    path.join(__dirname, '..', 'assets', 'update-source.json')
  ];

  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      return JSON.parse(fs.readFileSync(candidate, 'utf8')).manifestUrl || '';
    } catch {
      return '';
    }
  }

  return '';
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchJson(new URL(response.headers.location, url).toString()).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Hibas update manifest JSON.'));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(new URL(response.headers.location, url).toString(), destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destination));
      });
      file.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function checkForUpdate() {
  const manifestUrl = readUpdateSource();
  if (!manifestUrl) {
    return {
      ok: false,
      message: 'Nincs update URL beallitva. Add meg az assets/update-source.json manifestUrl mezojeben.'
    };
  }

  try {
    const manifest = await fetchJson(manifestUrl);
    if (!manifest.version || !manifest.url) {
      return { ok: false, message: 'Az update manifesthez version es url mezok kellenek.' };
    }
    const hasUpdate = compareVersions(manifest.version, appVersion()) > 0;
    return {
      ok: true,
      hasUpdate,
      manifest,
      currentVersion: appVersion(),
      latestVersion: manifest.version,
      message: hasUpdate
        ? `Van frissebb verzio: ${appVersion()} -> ${manifest.version}`
        : `Nincs frissebb verzio. Aktualis launcher: ${appVersion()}`
    };
  } catch (error) {
    return { ok: false, message: `Update ellenorzes hiba: ${error.message}` };
  }
}

async function downloadAndInstallUpdate() {
  const check = await checkForUpdate();
  if (!check.ok || !check.hasUpdate) return check;

  try {
    const fileName = path.basename(new URL(check.manifest.url).pathname) || 'Kolbasz Launcher Setup.exe';
    const destination = path.join(app.getPath('downloads'), fileName);
    sendLaunchStatus(`Update letoltese: ${check.manifest.version}`);
    await downloadFile(check.manifest.url, destination);
    sendLaunchStatus(`Update letoltve: ${destination}`);
    await shell.openPath(destination);
    return { ok: true, message: `Update letoltve es elinditva: ${fileName}` };
  } catch (error) {
    return { ok: false, message: `Update letoltes hiba: ${error.message}` };
  }
}

function sendLaunchStatus(message, ok = true) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('launcher:status', { message, ok });
  }

  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.appendFileSync(path.join(app.getPath('userData'), 'launch.log'), `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Status messages are best-effort only.
  }
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings) {
  const current = readSettings();
  const token = Object.prototype.hasOwnProperty.call(settings, 'microsoftRefreshToken')
    ? settings.microsoftRefreshToken
    : current.microsoftRefreshToken;
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify({ ...DEFAULT_SETTINGS, ...current, ...settings, microsoftRefreshToken: token }, null, 2));
  return readSettings();
}

function publicSettings(settings = readSettings()) {
  const { microsoftRefreshToken, ...safeSettings } = settings;
  return {
    ...safeSettings,
    microsoftLinked: Boolean(microsoftRefreshToken)
  };
}

function defaultGameDir() {
  return path.join(process.env.APPDATA || app.getPath('appData'), '.minecraft');
}

function minecraftLauncherCandidates() {
  const local = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || '';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || '';

  return [
    path.join(local, 'Programs', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join(programFiles, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
    path.join(programFilesX86, 'Minecraft Launcher', 'MinecraftLauncher.exe')
  ];
}

function findMinecraftLauncher() {
  return minecraftLauncherCandidates().find((candidate) => fs.existsSync(candidate)) || '';
}

function requiredJavaMajor(version) {
  const parts = String(version).split('.').map((part) => Number(part));
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
  if (minor >= 18 || (minor === 17 && patch >= 1)) return 17;
  if (minor === 17) return 16;
  return 8;
}

function getJavaMajor(javaPath) {
  try {
    const result = spawnSync(javaPath, ['-version'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    });
    const versionText = `${result.stdout || ''}\n${result.stderr || ''}`;
    const match = versionText.match(/version "(\d+)(?:\.(\d+))?/);
    if (!match) return 0;
    return Number(match[1]) === 1 ? Number(match[2]) : Number(match[1]);
  } catch {
    return 0;
  }
}

function findBundledJava(gameDir, version) {
  const runtimeDir = path.join(gameDir, 'runtime');
  const required = requiredJavaMajor(version);
  const candidates = ['java'];

  if (fs.existsSync(runtimeDir)) {
    const stack = [runtimeDir];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(fullPath);
        if (entry.isFile() && ['javaw.exe', 'java.exe'].includes(entry.name.toLowerCase())) {
          candidates.push(fullPath);
        }
      }
    }
  }

  const checked = candidates
    .map((candidate) => ({ path: candidate, major: getJavaMajor(candidate) }))
    .filter((candidate) => candidate.major);

  const exact = checked.find((candidate) => candidate.major === required);
  if (exact) return exact.path;

  const compatible = checked
    .filter((candidate) => candidate.major > required)
    .sort((a, b) => a.major - b.major)[0];

  return compatible ? compatible.path : '';
}

function safePlayerName(value) {
  const clean = String(value || DEFAULT_SETTINGS.playerName).replace(/[^\w]/g, '').slice(0, 16);
  return clean.length >= 3 ? clean : DEFAULT_SETTINGS.playerName;
}

function friendlyAuthError(error) {
  try {
    const wrapped = lexicon.wrapError(error);
    return wrapped.message || String(error);
  } catch {
    return error && error.message ? error.message : String(error);
  }
}

async function loginMicrosoftAccount(force = false) {
  sendLaunchStatus('Microsoft bejelentkezes inditasa...');
  const current = readSettings();
  const authManager = new Auth('select_account');
  authManager.on('load', (code) => sendLaunchStatus(`Microsoft: ${lexicon.getCode(code)}`));

  try {
    let xboxManager;
    if (!force && current.microsoftRefreshToken) {
      sendLaunchStatus('Microsoft token frissitese...');
      xboxManager = await authManager.refresh(current.microsoftRefreshToken);
    } else {
      xboxManager = await authManager.launch('electron', {
        width: 520,
        height: 720,
        resizable: false,
        title: 'Microsoft bejelentkezes',
        autoHideMenuBar: true
      });
    }

    const token = await xboxManager.getMinecraft();
    const next = writeSettings({
      ...current,
      authMode: 'microsoft',
      microsoftRefreshToken: xboxManager.save(),
      microsoftName: token.profile.name,
      playerName: token.profile.name
    });
    sendLaunchStatus(`Microsoft fiok csatlakoztatva: ${token.profile.name}`);
    return { ok: true, settings: publicSettings(next), message: `Bejelentkezve: ${token.profile.name}` };
  } catch (error) {
    const message = friendlyAuthError(error);
    sendLaunchStatus(`Microsoft login hiba: ${message}`, false);
    return { ok: false, settings: publicSettings(current), message: `Microsoft login hiba: ${message}` };
  }
}

async function getLaunchAuthorization(settings) {
  if (settings.authMode !== 'microsoft') {
    return Authenticator.getAuth(safePlayerName(settings.playerName));
  }

  let current = readSettings();
  if (!current.microsoftRefreshToken) {
    const login = await loginMicrosoftAccount(true);
    if (!login.ok) throw new Error(login.message);
    current = readSettings();
  }

  try {
    const authManager = new Auth('none');
    authManager.on('load', (code) => sendLaunchStatus(`Microsoft: ${lexicon.getCode(code)}`));
    const xboxManager = await authManager.refresh(current.microsoftRefreshToken);
    const token = await xboxManager.getMinecraft();
    writeSettings({
      ...current,
      authMode: 'microsoft',
      microsoftRefreshToken: xboxManager.save(),
      microsoftName: token.profile.name,
      playerName: token.profile.name
    });
    return token.mclc();
  } catch (error) {
    sendLaunchStatus(`Microsoft token lejart vagy hibas: ${friendlyAuthError(error)}`, false);
    const login = await loginMicrosoftAccount(true);
    if (!login.ok) throw new Error(login.message);
    const retry = readSettings();
    const authManager = new Auth('none');
    const xboxManager = await authManager.refresh(retry.microsoftRefreshToken);
    const token = await xboxManager.getMinecraft();
    return token.mclc();
  }
}

function deleteIfInvalidJson(filePath) {
  if (!fs.existsSync(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) throw new Error('empty file');
    JSON.parse(content);
  } catch {
    fs.unlinkSync(filePath);
    sendLaunchStatus(`Serult cache torolve: ${path.basename(filePath)}`);
  }
}

function cleanVersionCache(gameDir, version) {
  const candidates = [
    path.join(gameDir, 'cache', 'json', 'version_manifest.json'),
    path.join(gameDir, 'cache', 'json', `${version}.json`),
    path.join(gameDir, 'assets', 'indexes', `${version}.json`),
    path.join(gameDir, 'versions', version, `${version}.json`)
  ];

  candidates.forEach(deleteIfInvalidJson);
}

async function launchMinecraft(settings) {
  const version = settings.version || DEFAULT_SETTINGS.version;
  const gameDir = settings.gameDir && fs.existsSync(settings.gameDir) ? settings.gameDir : defaultGameDir();
  const requiredJava = requiredJavaMajor(version);
  const savedJavaPath = settings.javaPath && fs.existsSync(settings.javaPath) ? settings.javaPath : '';
  const savedJavaMajor = savedJavaPath ? getJavaMajor(savedJavaPath) : 0;
  const javaPath = savedJavaMajor >= requiredJava ? savedJavaPath : findBundledJava(gameDir, version);
  const memory = Math.max(1, Number(settings.memoryGb) || DEFAULT_SETTINGS.memoryGb);
  const launcher = new Client();

  cleanVersionCache(gameDir, version);
  sendLaunchStatus(`Minecraft ${version} inditas elokeszitese...`);
  sendLaunchStatus(`Game mappa: ${gameDir}`);
  if (savedJavaPath && savedJavaMajor < requiredJava) {
    sendLaunchStatus(`A mentett Java ${savedJavaMajor} tul regi ehhez: Java ${requiredJava} kell. Automatikus Java kereses...`, false);
  }
  sendLaunchStatus(javaPath ? `Java ${getJavaMajor(javaPath)} talalva: ${javaPath}` : `Nem talaltam kompatibilis Java ${requiredJava}+ futtatokornyezetet.`);

  if (!javaPath) {
    return {
      ok: false,
      message: `Ehhez a verziohoz Java ${requiredJava} kell. Add meg a Java exe mezoben a megfelelo javaw.exe utvonalat.`
    };
  }

  const actualJava = getJavaMajor(javaPath);
  if (actualJava < requiredJava) {
    return {
      ok: false,
      message: `A kivalasztott Minecraft ${version} Java ${requiredJava}-et ker, de ez csak Java ${actualJava}. Valassz masik Java exe-t.`
    };
  }

  let authorization;
  try {
    authorization = await getLaunchAuthorization(settings);
  } catch (error) {
    return { ok: false, message: error.message };
  }

  const opts = {
    authorization,
    root: gameDir,
    version: {
      number: version,
      type: 'release'
    },
    memory: {
      max: `${memory}G`,
      min: '1G'
    },
    overrides: {
      gameDirectory: gameDir,
      cwd: gameDir,
      detached: true,
      url: {
        meta: 'https://piston-meta.mojang.com',
        resource: 'https://resources.download.minecraft.net',
        defaultRepoForge: 'https://libraries.minecraft.net/'
      }
    }
  };

  if (javaPath) opts.javaPath = javaPath;

  return new Promise((resolve) => {
    let settled = false;
    let reportedRunning = false;
    let lastDebug = '';

    launcher.on('debug', (line) => {
      if (line.includes('Launching with arguments')) {
        lastDebug = 'Minecraft process inditasa...';
        sendLaunchStatus('Minecraft process inditasa...');
        return;
      }
      lastDebug = line;
      sendLaunchStatus(line.replace('[MCLC]: ', ''));
    });

    launcher.on('progress', (event) => {
      if (!event || !event.total) return;
      sendLaunchStatus(`${event.type}: ${event.task}/${event.total}`);
    });

    launcher.on('download-status', (event) => {
      if (!event || !event.name) return;
      const total = event.total ? ` / ${Math.round(event.total / 1024)} KB` : '';
      sendLaunchStatus(`${event.type || 'download'}: ${event.name} (${Math.round((event.current || 0) / 1024)} KB${total})`);
    });

    launcher.on('download', (name) => {
      sendLaunchStatus(`Letoltve: ${name}`);
    });

    launcher.on('data', (line) => {
      const cleanLine = String(line).trim();
      if (cleanLine) sendLaunchStatus(cleanLine);
    });

    launcher.on('close', (code) => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, message: `A Minecraft rogton kilepett. Hibakod: ${code ?? 'ismeretlen'}. ${lastDebug}` });
        return;
      }

      if (reportedRunning) {
        sendLaunchStatus(`Minecraft bezarva. Kod: ${code ?? 'ismeretlen'}`);
      }
    });

    launcher.launch(opts).then((child) => {
      if (settled) return;
      if (!child) {
        settled = true;
        sendLaunchStatus(`Sikertelen inditas: ${lastDebug}`, false);
        resolve({
          ok: false,
          message: `Nem sikerult elinditani a(z) ${version} verziot. Ellenorizd a Java elerest. Reszlet: ${lastDebug}`
        });
        return;
      }
      child.unref();
      sendLaunchStatus(`Minecraft process elindult. PID: ${child.pid}. Gyors ellenorzes...`);

      setTimeout(() => {
        if (settled) return;
        settled = true;
        reportedRunning = true;
        resolve({
          ok: true,
          message: `Minecraft ${version} fut.`
        });
      }, 3500);
    }).catch((error) => {
      if (settled) return;
      settled = true;
      sendLaunchStatus(`Inditasi hiba: ${error.message}`, false);
      resolve({ ok: false, message: `Inditasi hiba: ${error.message}` });
    });
  });
}

function launchJar(settings) {
  if (!settings.javaPath || !settings.jarPath) {
    return {
      ok: false,
      message: 'Adj meg Java eleresi utat es egy futtathato .jar fajlt a Custom Jar inditashoz.'
    };
  }

  if (!fs.existsSync(settings.javaPath)) {
    return { ok: false, message: 'A megadott Java eleresi ut nem letezik.' };
  }

  if (!fs.existsSync(settings.jarPath)) {
    return { ok: false, message: 'A megadott .jar fajl nem letezik.' };
  }

  const memory = Math.max(1, Number(settings.memoryGb) || DEFAULT_SETTINGS.memoryGb);
  const args = [`-Xmx${memory}G`, '-jar', settings.jarPath];
  const child = spawn(settings.javaPath, args, {
    cwd: settings.gameDir && fs.existsSync(settings.gameDir) ? settings.gameDir : path.dirname(settings.jarPath),
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  return { ok: true, message: `Custom Jar elinditva ${memory} GB RAM limittel.` };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 740,
    minWidth: 960,
    minHeight: 640,
    title: 'Kolbasz Launcher',
    backgroundColor: '#080b0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('settings:read', () => publicSettings());
ipcMain.handle('settings:save', (_, settings) => publicSettings(writeSettings(settings)));
ipcMain.handle('launcher:detect', () => findMinecraftLauncher());
ipcMain.handle('launcher:open-official', (_, settings) => launchMinecraft(settings));
ipcMain.handle('launcher:launch-jar', (_, settings) => launchJar(settings));
ipcMain.handle('auth:microsoft-login', (_, options) => loginMicrosoftAccount(Boolean(options?.force)));
ipcMain.handle('dialog:pick-file', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [{ name: 'All files', extensions: ['*'] }]
  });
  return result.canceled ? '' : result.filePaths[0];
});
ipcMain.handle('dialog:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? '' : result.filePaths[0];
});
ipcMain.handle('update:check', () => checkForUpdate());
ipcMain.handle('update:install', () => downloadAndInstallUpdate());
