const fields = {
  authMode: document.querySelector('#offlineMode'),
  playerName: document.querySelector('#playerName'),
  version: document.querySelector('#version'),
  memoryGb: document.querySelector('#memoryGb'),
  javaPath: document.querySelector('#javaPath'),
  jarPath: document.querySelector('#jarPath'),
  gameDir: document.querySelector('#gameDir')
};

const message = document.querySelector('#message');
const memoryValue = document.querySelector('#memoryValue');
const heroMemory = document.querySelector('#heroMemory');
const heroVersion = document.querySelector('#heroVersion');
const launcherStatus = document.querySelector('#launcherStatus');
const playButton = document.querySelector('#playOfficial');
const jarButton = document.querySelector('#launchJar');
const updateButton = document.querySelector('#updateLauncher');
const offlineMode = document.querySelector('#offlineMode');
const microsoftMode = document.querySelector('#microsoftMode');
const offlineFields = document.querySelector('#offlineFields');
const microsoftFields = document.querySelector('#microsoftFields');
const microsoftLogin = document.querySelector('#microsoftLogin');
const microsoftName = document.querySelector('#microsoftName');
const characterSummary = document.querySelector('#characterSummary');

let authMode = 'offline';
let microsoftLinked = false;

const minecraftVersions = [
  '1.8', '1.8.1', '1.8.2', '1.8.3', '1.8.4', '1.8.5', '1.8.6', '1.8.7', '1.8.8', '1.8.9',
  '1.9', '1.9.1', '1.9.2', '1.9.3', '1.9.4',
  '1.10', '1.10.1', '1.10.2',
  '1.11', '1.11.1', '1.11.2',
  '1.12', '1.12.1', '1.12.2',
  '1.13', '1.13.1', '1.13.2',
  '1.14', '1.14.1', '1.14.2', '1.14.3', '1.14.4',
  '1.15', '1.15.1', '1.15.2',
  '1.16', '1.16.1', '1.16.2', '1.16.3', '1.16.4', '1.16.5',
  '1.17', '1.17.1',
  '1.18', '1.18.1', '1.18.2',
  '1.19', '1.19.1', '1.19.2', '1.19.3', '1.19.4',
  '1.20', '1.20.1', '1.20.2', '1.20.3', '1.20.4', '1.20.5', '1.20.6',
  '1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5', '1.21.6', '1.21.7', '1.21.8', '1.21.9', '1.21.10'
];

const api = window.kolbasz ?? {
  readSettings: async () => ({
    authMode: 'offline',
    playerName: 'KolbaszPlayer',
    microsoftName: '',
    microsoftLinked: false,
    version: '1.21.10',
    memoryGb: 4,
    javaPath: '',
    jarPath: '',
    gameDir: ''
  }),
  saveSettings: async (settings) => settings,
  detectLauncher: async () => '',
  openOfficial: async (settings) => ({
    ok: true,
    message: `Preview mod. Az exe-ben a Minecraft ${settings.version} indul kozvetlenul.`
  }),
  launchJar: async () => ({ ok: false, message: 'Preview mod. Custom Jar inditas az .exe appban aktiv.' }),
  loginMicrosoft: async () => ({ ok: false, message: 'Preview mod. Microsoft login csak az .exe appban aktiv.' }),
  checkUpdate: async () => ({ ok: false, message: 'Preview mod. Update csak az .exe appban aktiv.' }),
  installUpdate: async () => ({ ok: false, message: 'Preview mod. Update csak az .exe appban aktiv.' }),
  onLaunchStatus: () => {},
  pickFile: async () => '',
  pickFolder: async () => ''
};

function populateVersions() {
  fields.version.innerHTML = minecraftVersions
    .map((version) => `<option value="${version}">${version}</option>`)
    .join('');
}

function readForm() {
  return {
    authMode,
    playerName: fields.playerName.value.trim(),
    version: fields.version.value.trim(),
    memoryGb: Number(fields.memoryGb.value),
    javaPath: fields.javaPath.value.trim(),
    jarPath: fields.jarPath.value.trim(),
    gameDir: fields.gameDir.value.trim()
  };
}

function setMessage(text, ok = true) {
  message.textContent = text;
  message.dataset.state = ok ? 'ok' : 'error';
}

function syncHeroStats() {
  memoryValue.textContent = `${fields.memoryGb.value} GB`;
  heroMemory.textContent = `${fields.memoryGb.value} GB`;
  heroVersion.textContent = fields.version.value;
}

function setAuthMode(mode) {
  authMode = mode === 'microsoft' ? 'microsoft' : 'offline';
  offlineMode.classList.toggle('active', authMode === 'offline');
  microsoftMode.classList.toggle('active', authMode === 'microsoft');
  offlineFields.hidden = authMode !== 'offline';
  microsoftFields.hidden = authMode !== 'microsoft';
  characterSummary.textContent = authMode === 'microsoft' ? 'Eredeti karakter' : 'Tort karakter';
}

async function saveSettings() {
  const saved = await api.saveSettings(readForm());
  hydrate(saved);
  setMessage('Beallitasok mentve.');
}

function hydrate(settings) {
  setAuthMode(settings.authMode || 'offline');
  fields.playerName.value = settings.playerName ?? '';
  fields.version.value = settings.version ?? '';
  fields.memoryGb.value = settings.memoryGb ?? 4;
  fields.javaPath.value = settings.javaPath ?? '';
  fields.jarPath.value = settings.jarPath ?? '';
  fields.gameDir.value = settings.gameDir ?? '';
  microsoftLinked = Boolean(settings.microsoftLinked);
  microsoftName.textContent = settings.microsoftName || (microsoftLinked ? 'Csatlakoztatva' : 'Nincs bejelentkezve');
  microsoftLogin.textContent = microsoftLinked ? 'Fiok valtasa' : 'Bejelentkezes';
  if (!minecraftVersions.includes(fields.version.value)) {
    fields.version.value = '1.21.10';
  }
  syncHeroStats();
}

async function boot() {
  populateVersions();
  api.onLaunchStatus((status) => {
    setMessage(status.message, status.ok);
  });
  hydrate(await api.readSettings());
  const launcher = await api.detectLauncher();
  launcherStatus.textContent = launcher ? 'Launcher keszen all' : 'Sajat Java launch';
  launcherStatus.dataset.state = 'ok';
}

document.querySelector('#saveSettings').addEventListener('click', saveSettings);
fields.memoryGb.addEventListener('input', syncHeroStats);
fields.version.addEventListener('change', syncHeroStats);
offlineMode.addEventListener('click', async () => {
  setAuthMode('offline');
  await saveSettings();
});
microsoftMode.addEventListener('click', async () => {
  setAuthMode('microsoft');
  await saveSettings();
});

microsoftLogin.addEventListener('click', async () => {
  setAuthMode('microsoft');
  await saveSettings();
  microsoftLogin.disabled = true;
  setMessage('Microsoft bejelentkezes megnyitasa...');
  const result = await api.loginMicrosoft({ force: true });
  if (result.settings) hydrate(result.settings);
  setMessage(result.message, result.ok);
  microsoftLogin.disabled = false;
});

playButton.addEventListener('click', async () => {
  await saveSettings();
  if (authMode === 'microsoft' && !microsoftLinked) {
    setMessage('Eredeti modhoz eloszor Microsoft bejelentkezes kell.', false);
    const result = await api.loginMicrosoft({ force: true });
    if (result.settings) hydrate(result.settings);
    setMessage(result.message, result.ok);
    if (!result.ok) {
      playButton.disabled = false;
      jarButton.disabled = false;
      return;
    }
  }
  playButton.disabled = true;
  jarButton.disabled = true;
  setMessage(`Minecraft ${fields.version.value} inditasa...`);
  const result = await api.openOfficial(readForm());
  setMessage(result.message, result.ok);
  playButton.disabled = false;
  jarButton.disabled = false;
});

jarButton.addEventListener('click', async () => {
  await saveSettings();
  const result = await api.launchJar(readForm());
  setMessage(result.message, result.ok);
});

updateButton.addEventListener('click', async () => {
  updateButton.disabled = true;
  setMessage('Update ellenorzese...');
  const check = await api.checkUpdate();
  if (!check.ok || !check.hasUpdate) {
    setMessage(check.message, check.ok);
    updateButton.disabled = false;
    return;
  }
  setMessage(`${check.message}. Letoltes indul...`);
  const result = await api.installUpdate();
  setMessage(result.message, result.ok);
  updateButton.disabled = false;
});

document.querySelector('#pickJava').addEventListener('click', async () => {
  const file = await api.pickFile({ filters: [{ name: 'Java executable', extensions: ['exe'] }] });
  if (file) fields.javaPath.value = file;
});

document.querySelector('#pickJar').addEventListener('click', async () => {
  const file = await api.pickFile({ filters: [{ name: 'Java archive', extensions: ['jar'] }] });
  if (file) fields.jarPath.value = file;
});

document.querySelector('#pickFolder').addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (folder) fields.gameDir.value = folder;
});

boot();
