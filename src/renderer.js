const fields = {
  authMode: document.querySelector('#offlineMode'),
  playerName: document.querySelector('#playerName'),
  version: document.querySelector('#version'),
  memoryGb: document.querySelector('#memoryGb'),
  javaPath: document.querySelector('#javaPath'),
  jarPath: document.querySelector('#jarPath'),
  gameDir: document.querySelector('#gameDir'),
  serverAddress: document.querySelector('#serverAddress')
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
const modrinthQuery = document.querySelector('#modrinthQuery');
const modrinthLoader = document.querySelector('#modrinthLoader');
const modrinthSearch = document.querySelector('#modrinthSearch');
const modrinthResults = document.querySelector('#modrinthResults');
const tabPlay = document.querySelector('#tabPlay');
const tabMods = document.querySelector('#tabMods');
const tabFriends = document.querySelector('#tabFriends');
const tabSettings = document.querySelector('#tabSettings');
const playSettingsView = document.querySelector('#playSettingsView');
const modsView = document.querySelector('#modsView');
const friendsView = document.querySelector('#friendsView');
const installedMods = document.querySelector('#installedMods');
const installedCount = document.querySelector('#installedCount');
const openModsFolder = document.querySelector('#openModsFolder');
const heroCharacterRender = document.querySelector('#heroCharacterRender');
const friendProfileName = document.querySelector('#friendProfileName');
const friendNameInput = document.querySelector('#friendNameInput');
const addFriendButton = document.querySelector('#addFriendButton');
const friendRequests = document.querySelector('#friendRequests');
const friendList = document.querySelector('#friendList');
const friendCount = document.querySelector('#friendCount');
const requestCount = document.querySelector('#requestCount');
const chatPanel = document.querySelector('#chatPanel');
const chatTitle = document.querySelector('#chatTitle');
const chatMessages = document.querySelector('#chatMessages');
const chatInput = document.querySelector('#chatInput');
const sendChatButton = document.querySelector('#sendChatButton');
const refreshServerStatus = document.querySelector('#refreshServerStatus');
const serverStatusBadge = document.querySelector('#serverStatusBadge');
const serverOnline = document.querySelector('#serverOnline');
const serverPlayers = document.querySelector('#serverPlayers');
const serverPing = document.querySelector('#serverPing');
const serverVersion = document.querySelector('#serverVersion');

let authMode = 'offline';
let microsoftLinked = false;
let friendsState = null;
let selectedFriend = null;

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
  '1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5', '1.21.6', '1.21.7', '1.21.8', '1.21.9', '1.21.10', '1.21.11'
];

const api = window.kolbasz ?? {
  readSettings: async () => ({
    authMode: 'offline',
    playerName: 'KolbaszPlayer',
    microsoftName: '',
    microsoftLinked: false,
    version: '1.21.11',
    modLoader: 'fabric',
    memoryGb: 4,
    javaPath: '',
    jarPath: '',
    gameDir: '',
    serverAddress: 'mc.hypixel.net'
  }),
  saveSettings: async (settings) => settings,
  detectLauncher: async () => '',
  openOfficial: async (settings) => ({
    ok: true,
    message: `Preview mod. Az exe-ben a Minecraft ${settings.version} indul közvetlenül.`
  }),
  launchJar: async () => ({ ok: false, message: 'Preview mod. Custom Jar indítás az .exe appban aktív.' }),
  serverStatus: async () => ({ ok: false, message: 'Preview mod. Szerver státusz csak az .exe appban aktív.' }),
  loginMicrosoft: async () => ({ ok: false, message: 'Preview mod. Microsoft login csak az .exe appban aktív.' }),
  searchModrinth: async () => ({ ok: false, message: 'Preview mod. Modrinth csak az .exe appban aktív.' }),
  installModrinth: async () => ({ ok: false, message: 'Preview mod. Modrinth csak az .exe appban aktív.' }),
  listMods: async () => ({ ok: true, mods: [], message: 'Preview mod.' }),
  toggleMod: async () => ({ ok: false, message: 'Preview mod.' }),
  deleteMod: async () => ({ ok: false, message: 'Preview mod.' }),
  openModsFolder: async () => ({ ok: false, message: 'Preview mod.' }),
  friendsProfile: async () => ({ ok: false, message: 'Preview mod.' }),
  friendsList: async () => ({ ok: true, profile: { name: 'Preview' }, friends: [], incoming: [], outgoing: [] }),
  friendsAdd: async () => ({ ok: false, message: 'Preview mod.' }),
  friendsAccept: async () => ({ ok: false, message: 'Preview mod.' }),
  friendsReject: async () => ({ ok: false, message: 'Preview mod.' }),
  friendsMessages: async () => ({ ok: true, messages: [] }),
  friendsSend: async () => ({ ok: false, message: 'Preview mod.' }),
  checkUpdate: async () => ({ ok: false, message: 'Preview mod. Update csak az .exe appban aktív.' }),
  installUpdate: async () => ({ ok: false, message: 'Preview mod. Update csak az .exe appban aktív.' }),
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
    modLoader: modrinthLoader.value,
    memoryGb: Number(fields.memoryGb.value),
    javaPath: fields.javaPath.value.trim(),
    jarPath: fields.jarPath.value.trim(),
    gameDir: fields.gameDir.value.trim(),
    serverAddress: fields.serverAddress.value.trim()
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

function characterNameForPreview() {
  if (authMode === 'microsoft' && microsoftLinked) {
    return microsoftName.textContent.trim() || fields.playerName.value.trim() || 'Steve';
  }
  return 'Steve';
}

function syncHeroCharacter() {
  const characterName = encodeURIComponent(characterNameForPreview());
  heroCharacterRender.src = `https://render.crafty.gg/3d/full/${characterName}?shadow=false&height=260`;
  heroCharacterRender.onerror = () => {
    heroCharacterRender.onerror = null;
    heroCharacterRender.src = 'https://render.crafty.gg/3d/full/MHF_Steve?shadow=false&height=260';
  };
}

function setAuthMode(mode) {
  authMode = mode === 'microsoft' ? 'microsoft' : 'offline';
  offlineMode.classList.toggle('active', authMode === 'offline');
  microsoftMode.classList.toggle('active', authMode === 'microsoft');
  offlineFields.hidden = authMode !== 'offline';
  microsoftFields.hidden = authMode !== 'microsoft';
  characterSummary.textContent = authMode === 'microsoft' ? 'Eredeti karakter' : 'Tört karakter';
  syncHeroCharacter();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function renderModrinthResults(hits = []) {
  if (!hits.length) {
    modrinthResults.innerHTML = '<div class="modrinth-empty">Nincs találat.</div>';
    return;
  }

  modrinthResults.innerHTML = hits.map((hit) => `
    <article class="mod-card">
      <img src="${escapeHtml(hit.iconUrl || '../assets/discord-icon.png')}" alt="" />
      <div>
        <strong>${escapeHtml(hit.title)}</strong>
        <p>${escapeHtml(hit.description)}</p>
        <span>${Number(hit.downloads || 0).toLocaleString('hu-HU')} letöltés</span>
      </div>
      <button class="icon-button mod-install" type="button" data-project-id="${escapeHtml(hit.projectId)}" title="Mod telepítése">+</button>
    </article>
  `).join('');
}

function setDeckTab(tab) {
  const modsActive = tab === 'mods';
  const friendsActive = tab === 'friends';
  tabPlay.classList.toggle('active', tab === 'play');
  tabMods.classList.toggle('active', modsActive);
  tabFriends.classList.toggle('active', friendsActive);
  tabSettings.classList.toggle('active', tab === 'settings');
  playSettingsView.hidden = modsActive || friendsActive;
  modsView.hidden = !modsActive;
  friendsView.hidden = !friendsActive;
  if (modsActive) refreshInstalledMods();
  if (friendsActive) refreshFriends();
}

function renderInstalledMods(mods = []) {
  installedCount.textContent = String(mods.length);
  if (!mods.length) {
    installedMods.innerHTML = '<div class="modrinth-empty">Még nincs telepített mod.</div>';
    return;
  }

  installedMods.innerHTML = mods.map((mod) => `
    <article class="installed-mod">
      <div class="mod-icon">M</div>
      <div>
        <strong>${escapeHtml(mod.name)}</strong>
        <span>${mod.enabled ? 'Bekapcsolva' : 'Kikapcsolva'} - ${escapeHtml(mod.sizeMb)} MB</span>
      </div>
      <button class="toggle-mod" data-enabled="${mod.enabled}" data-file-name="${escapeHtml(mod.fileName)}" type="button" title="Mod ki/be"></button>
      <button class="delete-mod" data-file-name="${escapeHtml(mod.fileName)}" type="button" title="Mod törlése">x</button>
    </article>
  `).join('');
}

async function refreshInstalledMods() {
  const result = await api.listMods(readForm());
  if (result.ok) renderInstalledMods(result.mods);
  else installedMods.innerHTML = `<div class="modrinth-empty">${escapeHtml(result.message)}</div>`;
}

function renderFriendRequests(requests = []) {
  requestCount.textContent = String(requests.length);
  if (!requests.length) {
    friendRequests.innerHTML = '<div class="modrinth-empty">Nincs bejövő kérelem.</div>';
    return;
  }

  friendRequests.innerHTML = requests.map((request) => `
    <article class="request-row">
      <div class="friend-avatar">${escapeHtml(request.requester_name.slice(0, 1).toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(request.requester_name)}</strong>
        <span>Barátkérelem</span>
      </div>
      <div class="request-actions">
        <button class="small-action accept" data-request-id="${escapeHtml(request.id)}" type="button">OK</button>
        <button class="small-action reject" data-request-id="${escapeHtml(request.id)}" type="button">No</button>
      </div>
    </article>
  `).join('');
}

function renderFriendList(friends = []) {
  friendCount.textContent = String(friends.length);
  if (!friends.length) {
    friendList.innerHTML = '<div class="modrinth-empty">Még nincs barát a listában.</div>';
    return;
  }

  friendList.innerHTML = friends.map((friend) => `
    <button class="friend-row friend-open" data-friend-id="${escapeHtml(friend.friend_id)}" data-friend-name="${escapeHtml(friend.friend_name)}" type="button">
      <div class="friend-avatar">${escapeHtml(friend.friend_name.slice(0, 1).toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(friend.friend_name)}</strong>
        <span>Chat megnyitása</span>
        <span class="activity">${escapeHtml(friend.activity || 'Offline')}</span>
      </div>
      <span>${escapeHtml(friend.activity === 'Offline' ? 'Offline' : 'Aktív')}</span>
    </button>
  `).join('');
}

function renderServerStatus(result) {
  if (!result.ok) {
    serverStatusBadge.textContent = 'Hiba';
    serverOnline.textContent = '-';
    serverPlayers.textContent = '-';
    serverPing.textContent = '-';
    serverVersion.textContent = '-';
    setMessage(result.message, false);
    return;
  }

  serverStatusBadge.textContent = result.online ? 'Online' : 'Offline';
  serverOnline.textContent = result.online ? 'Igen' : 'Nem';
  serverPlayers.textContent = result.players || '-';
  serverPing.textContent = result.online ? `${result.ping} ms` : '-';
  serverVersion.textContent = result.version || '-';
  setMessage(result.message, result.ok);
}

async function refreshServer() {
  refreshServerStatus.disabled = true;
  serverStatusBadge.textContent = 'Lekérés...';
  const result = await api.serverStatus(fields.serverAddress.value.trim());
  renderServerStatus(result);
  refreshServerStatus.disabled = false;
}

function renderMessages(messages = []) {
  const myId = friendsState?.profile?.id;
  if (!messages.length) {
    chatMessages.innerHTML = '<div class="modrinth-empty">Még nincs üzenet.</div>';
    return;
  }

  chatMessages.innerHTML = messages.map((messageItem) => `
    <div class="chat-message ${messageItem.sender_id === myId ? 'mine' : ''}">
      ${escapeHtml(messageItem.body)}
    </div>
  `).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function refreshFriends() {
  const result = await api.friendsList(readForm());
  if (!result.ok) {
    setMessage(result.message, false);
    return;
  }

  friendsState = result;
  friendProfileName.textContent = result.profile.name;
  renderFriendRequests(result.incoming);
  renderFriendList(result.friends);
}

async function openFriendChat(friendId, friendName) {
  selectedFriend = { id: friendId, name: friendName };
  chatPanel.hidden = false;
  chatTitle.textContent = friendName;
  const result = await api.friendsMessages({ ...readForm(), friendId });
  if (result.ok) renderMessages(result.messages);
  else setMessage(result.message, false);
}

async function saveSettings() {
  const saved = await api.saveSettings(readForm());
  hydrate(saved);
  setMessage('Beállítások mentve.');
}

function hydrate(settings) {
  setAuthMode(settings.authMode || 'offline');
  fields.playerName.value = settings.playerName ?? '';
  fields.version.value = settings.version ?? '';
  fields.memoryGb.value = settings.memoryGb ?? 4;
  fields.javaPath.value = settings.javaPath ?? '';
  fields.jarPath.value = settings.jarPath ?? '';
  fields.gameDir.value = settings.gameDir ?? '';
  fields.serverAddress.value = settings.serverAddress ?? 'mc.hypixel.net';
  modrinthLoader.value = settings.modLoader || modrinthLoader.value || 'fabric';
  microsoftLinked = Boolean(settings.microsoftLinked);
  microsoftName.textContent = settings.microsoftName || (microsoftLinked ? 'Csatlakoztatva' : 'Nincs bejelentkezve');
  microsoftLogin.textContent = microsoftLinked ? 'Fiók váltása' : 'Bejelentkezés';
  if (!minecraftVersions.includes(fields.version.value)) {
    fields.version.value = '1.21.11';
  }
  syncHeroStats();
  syncHeroCharacter();
}

async function boot() {
  populateVersions();
  api.onLaunchStatus((status) => {
    setMessage(status.message, status.ok);
  });
  hydrate(await api.readSettings());
  api.friendsProfile({ ...readForm(), activityStatus: 'menu', activityDetail: 'Menüben van' }).catch(() => {});
  const launcher = await api.detectLauncher();
  launcherStatus.textContent = launcher ? 'Launcher készen áll' : 'Saját Java launch';
  launcherStatus.dataset.state = 'ok';
  refreshServer();
}

document.querySelector('#saveSettings').addEventListener('click', saveSettings);
tabPlay.addEventListener('click', () => setDeckTab('play'));
tabMods.addEventListener('click', () => setDeckTab('mods'));
tabFriends.addEventListener('click', () => setDeckTab('friends'));
tabSettings.addEventListener('click', () => setDeckTab('settings'));
fields.memoryGb.addEventListener('input', syncHeroStats);
fields.version.addEventListener('change', syncHeroStats);
fields.playerName.addEventListener('input', syncHeroCharacter);
refreshServerStatus.addEventListener('click', async () => {
  await saveSettings();
  await refreshServer();
});
fields.serverAddress.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') refreshServerStatus.click();
});
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
  setMessage('Microsoft bejelentkezés megnyitása...');
  const result = await api.loginMicrosoft({ force: true });
  if (result.settings) hydrate(result.settings);
  setMessage(result.message, result.ok);
  microsoftLogin.disabled = false;
});

playButton.addEventListener('click', async () => {
  await saveSettings();
  if (authMode === 'microsoft' && !microsoftLinked) {
    setMessage('Eredeti módhoz először Microsoft bejelentkezés kell.', false);
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
  setMessage(`Minecraft ${fields.version.value} indítása...`);
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
  setMessage('Frissítés keresése...');
  const check = await api.checkUpdate();
  if (!check.ok) {
    setMessage(check.message, check.ok);
    updateButton.disabled = false;
    return;
  }
  if (!check.hasUpdate) {
    setMessage(check.message || 'Nincs frissebb verzió. A launcher naprakész.');
    updateButton.disabled = false;
    return;
  }
  const changes = (check.changelog || []).map((item) => `- ${item}`).join('\n');
  setMessage(`${check.currentVersion} -> ${check.latestVersion}\n${changes || 'Nincs changelog.'}\nLetöltés indul...`);
  const result = await api.installUpdate();
  setMessage(result.message, result.ok);
  updateButton.disabled = false;
});

modrinthSearch.addEventListener('click', async () => {
  modrinthSearch.disabled = true;
  modrinthResults.innerHTML = '<div class="modrinth-empty">Keresés...</div>';
  setMessage(`Modrinth keresés: ${fields.version.value} / ${modrinthLoader.value}`);
  const result = await api.searchModrinth({
    query: modrinthQuery.value,
    version: fields.version.value,
    loader: modrinthLoader.value
  });
  if (result.ok) renderModrinthResults(result.hits);
  else modrinthResults.innerHTML = `<div class="modrinth-empty">${escapeHtml(result.message)}</div>`;
  setMessage(result.message, result.ok);
  modrinthSearch.disabled = false;
});

modrinthQuery.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') modrinthSearch.click();
});

modrinthResults.addEventListener('click', async (event) => {
  const button = event.target.closest('.mod-install');
  if (!button) return;
  await saveSettings();
  button.disabled = true;
  setMessage('Modrinth mod telepítése...');
  const result = await api.installModrinth({
    projectId: button.dataset.projectId,
    version: fields.version.value,
    loader: modrinthLoader.value,
    gameDir: fields.gameDir.value.trim()
  });
  setMessage(result.message, result.ok);
  if (result.ok) await refreshInstalledMods();
  button.disabled = false;
});

installedMods.addEventListener('click', async (event) => {
  const toggle = event.target.closest('.toggle-mod');
  const remove = event.target.closest('.delete-mod');
  const target = toggle || remove;
  if (!target) return;

  target.disabled = true;
  const payload = { ...readForm(), fileName: target.dataset.fileName };
  const result = toggle ? await api.toggleMod(payload) : await api.deleteMod(payload);
  setMessage(result.message, result.ok);
  if (result.list?.mods) renderInstalledMods(result.list.mods);
  else await refreshInstalledMods();
});

openModsFolder.addEventListener('click', async () => {
  const result = await api.openModsFolder(readForm());
  setMessage(result.message, result.ok);
});

addFriendButton.addEventListener('click', async () => {
  addFriendButton.disabled = true;
  const result = await api.friendsAdd({ ...readForm(), targetName: friendNameInput.value.trim() });
  setMessage(result.message, result.ok);
  if (result.ok) {
    friendNameInput.value = '';
    await refreshFriends();
  }
  addFriendButton.disabled = false;
});

friendNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addFriendButton.click();
});

friendRequests.addEventListener('click', async (event) => {
  const accept = event.target.closest('.accept');
  const reject = event.target.closest('.reject');
  const target = accept || reject;
  if (!target) return;

  target.disabled = true;
  const payload = { ...readForm(), requestId: target.dataset.requestId };
  const result = accept ? await api.friendsAccept(payload) : await api.friendsReject(payload);
  setMessage(result.message, result.ok);
  await refreshFriends();
});

friendList.addEventListener('click', async (event) => {
  const row = event.target.closest('.friend-open');
  if (!row) return;
  await openFriendChat(row.dataset.friendId, row.dataset.friendName);
});

sendChatButton.addEventListener('click', async () => {
  if (!selectedFriend) return;
  sendChatButton.disabled = true;
  const result = await api.friendsSend({ ...readForm(), friendId: selectedFriend.id, body: chatInput.value });
  setMessage(result.message, result.ok);
  if (result.ok) {
    chatInput.value = '';
    await openFriendChat(selectedFriend.id, selectedFriend.name);
  }
  sendChatButton.disabled = false;
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') sendChatButton.click();
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
