const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth, lexicon } = require('msmc');
const DiscordRPC = require('discord-rpc');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const MODRINTH_USER_AGENT = 'KolbaszLauncher/1.0.12 (github.com/Suni2004/Launcher-Kolbasz)';
const LAUNCHER_BRAND = 'Kolb\u00e1szLauncher';

const DEFAULT_SETTINGS = {
  authMode: 'offline',
  playerName: 'KolbaszPlayer',
  microsoftName: '',
  microsoftRefreshToken: '',
  version: '1.21.11',
  modLoader: 'fabric',
  memoryGb: 4,
  javaPath: '',
  jarPath: '',
  gameDir: ''
};

let mainWindow;
let discordClient;
let discordReady = false;
let discordStartTime = Date.now();

function readJsonAsset(fileName) {
  const candidates = [
    path.join(process.resourcesPath || '', 'assets', fileName),
    path.join(__dirname, '..', 'assets', fileName)
  ];

  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch {
      return {};
    }
  }

  return {};
}

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

function readDiscordPresenceConfig() {
  return readJsonAsset('discord-presence.json');
}

function setDiscordActivity(details = 'Kolbász Launcher', state = 'Launcher nyitva') {
  if (!discordReady || !discordClient) return;

  discordClient.setActivity({
    details,
    state,
    startTimestamp: discordStartTime,
    largeImageKey: 'kolbasz_launcher',
    largeImageText: 'Kolbász Launcher',
    instance: false
  }).catch(() => {});
}

function initDiscordPresence() {
  const config = readDiscordPresenceConfig();
  const clientId = String(config.clientId || '').trim();
  if (!clientId) return;

  DiscordRPC.register(clientId);
  discordClient = new DiscordRPC.Client({ transport: 'ipc' });
  discordClient.on('ready', () => {
    discordReady = true;
    setDiscordActivity();
  });
  discordClient.login({ clientId }).catch(() => {
    discordReady = false;
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client.get(url, { headers: { 'User-Agent': MODRINTH_USER_AGENT } }, (response) => {
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
          reject(new Error('Hibás update manifest JSON.'));
        }
      });
    }).on('error', reject);
  });
}

function supabaseConfig() {
  const config = readJsonAsset('supabase.json');
  return {
    url: String(config.url || '').replace(/\/$/, ''),
    key: String(config.publishableKey || '')
  };
}

function supabaseRequest(method, table, query = '', body) {
  const config = supabaseConfig();
  if (!config.url || !config.key) {
    return Promise.resolve({ ok: false, message: 'Supabase nincs beállítva.' });
  }

  const url = `${config.url}/rest/v1/${table}${query}`;
  return new Promise((resolve) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const request = https.request(url, {
      method,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Prefer: query.includes('on_conflict=') ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve({ ok: true, data });
          return;
        }

        const message = data?.message || data?.hint || text || `HTTP ${response.statusCode}`;
        resolve({ ok: false, message });
      });
    });

    request.on('error', (error) => resolve({ ok: false, message: error.message }));
    if (payload) request.write(payload);
    request.end();
  });
}

function friendIdentity(settings = readSettings()) {
  const mode = settings.authMode === 'microsoft' ? 'microsoft' : 'offline';
  const rawName = mode === 'microsoft'
    ? (settings.microsoftName || settings.playerName)
    : settings.playerName;
  const name = safePlayerName(rawName);
  return {
    id: `${mode}:${name.toLowerCase()}`,
    name,
    authMode: mode
  };
}

async function ensureFriendProfile(settings = readSettings()) {
  const identity = friendIdentity(settings);
  const body = {
    id: identity.id,
    name: identity.name,
    auth_mode: identity.authMode,
    status: 'online',
    last_seen: new Date().toISOString()
  };
  const result = await supabaseRequest('POST', 'launcher_profiles', '?on_conflict=id', body);
  if (!result.ok) return { ok: false, message: `Barát profil hiba: ${result.message}` };
  return { ok: true, profile: identity };
}

async function findFriendProfileByName(name) {
  const cleanName = safePlayerName(name);
  const result = await supabaseRequest('GET', 'launcher_profiles', `?select=*&name=eq.${encodeURIComponent(cleanName)}&limit=1`);
  if (!result.ok) return result;
  return { ok: true, profile: result.data?.[0] || null };
}

async function getFriendsState(settings = readSettings()) {
  const profileResult = await ensureFriendProfile(settings);
  if (!profileResult.ok) return profileResult;
  const profile = profileResult.profile;
  const own = encodeURIComponent(profile.id);
  const ownName = encodeURIComponent(profile.name);

  const [friends, incomingById, incomingByName, outgoing] = await Promise.all([
    supabaseRequest('GET', 'launcher_friends', `?select=*&owner_id=eq.${own}&order=friend_name.asc`),
    supabaseRequest('GET', 'launcher_friend_requests', `?select=*&target_id=eq.${own}&status=eq.pending&order=created_at.desc`),
    supabaseRequest('GET', 'launcher_friend_requests', `?select=*&target_name=eq.${ownName}&status=eq.pending&order=created_at.desc`),
    supabaseRequest('GET', 'launcher_friend_requests', `?select=*&requester_id=eq.${own}&status=eq.pending&order=created_at.desc`)
  ]);

  const failed = [friends, incomingById, incomingByName, outgoing].find((item) => !item.ok);
  if (failed) return { ok: false, message: `Barátlista hiba: ${failed.message}` };

  const incomingMap = new Map();
  [...(incomingById.data || []), ...(incomingByName.data || [])].forEach((request) => incomingMap.set(request.id, request));

  return {
    ok: true,
    profile,
    friends: friends.data || [],
    incoming: [...incomingMap.values()],
    outgoing: outgoing.data || []
  };
}

async function addFriend(options = {}) {
  const profileResult = await ensureFriendProfile(options);
  if (!profileResult.ok) return profileResult;
  const requester = profileResult.profile;
  const targetName = safePlayerName(options.targetName);
  if (targetName.toLowerCase() === requester.name.toLowerCase()) {
    return { ok: false, message: 'Saját magadat nem tudod barátnak jelölni.' };
  }

  const target = await findFriendProfileByName(targetName);
  if (!target.ok) return { ok: false, message: `Barát keresési hiba: ${target.message}` };

  const body = {
    requester_id: requester.id,
    requester_name: requester.name,
    target_id: target.profile?.id || null,
    target_name: targetName,
    status: 'pending'
  };
  const result = await supabaseRequest('POST', 'launcher_friend_requests', '', body);
  if (!result.ok) return { ok: false, message: `Kérelem küldési hiba: ${result.message}` };
  return { ok: true, message: `Barátkérelem elküldve: ${targetName}` };
}

async function acceptFriend(options = {}) {
  const profileResult = await ensureFriendProfile(options);
  if (!profileResult.ok) return profileResult;
  const me = profileResult.profile;
  const requestId = String(options.requestId || '');
  if (!requestId) return { ok: false, message: 'Hianyzo friend request.' };

  const requestResult = await supabaseRequest('GET', 'launcher_friend_requests', `?select=*&id=eq.${encodeURIComponent(requestId)}&limit=1`);
  const request = requestResult.data?.[0];
  if (!requestResult.ok || !request) return { ok: false, message: 'Nem találom a kérelmet.' };

  await supabaseRequest('PATCH', 'launcher_friend_requests', `?id=eq.${encodeURIComponent(requestId)}`, {
    status: 'accepted',
    target_id: me.id,
    updated_at: new Date().toISOString()
  });
  await supabaseRequest('POST', 'launcher_friends', '?on_conflict=owner_id,friend_id', {
    owner_id: me.id,
    friend_id: request.requester_id,
    friend_name: request.requester_name
  });
  await supabaseRequest('POST', 'launcher_friends', '?on_conflict=owner_id,friend_id', {
    owner_id: request.requester_id,
    friend_id: me.id,
    friend_name: me.name
  });

  return { ok: true, message: `Barát elfogadva: ${request.requester_name}` };
}

async function rejectFriend(options = {}) {
  const requestId = String(options.requestId || '');
  if (!requestId) return { ok: false, message: 'Hianyzo friend request.' };
  const result = await supabaseRequest('PATCH', 'launcher_friend_requests', `?id=eq.${encodeURIComponent(requestId)}`, {
    status: 'rejected',
    updated_at: new Date().toISOString()
  });
  return result.ok ? { ok: true, message: 'Kérelem elutasítva.' } : { ok: false, message: result.message };
}

async function listFriendMessages(options = {}) {
  const profileResult = await ensureFriendProfile(options);
  if (!profileResult.ok) return profileResult;
  const me = encodeURIComponent(profileResult.profile.id);
  const friendId = encodeURIComponent(String(options.friendId || ''));
  if (!friendId) return { ok: false, message: 'Válassz barátot.' };

  const query = `?select=*&or=(and(sender_id.eq.${me},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${me}))&order=created_at.asc&limit=80`;
  const result = await supabaseRequest('GET', 'launcher_messages', query);
  return result.ok ? { ok: true, messages: result.data || [] } : { ok: false, message: result.message };
}

async function sendFriendMessage(options = {}) {
  const profileResult = await ensureFriendProfile(options);
  if (!profileResult.ok) return profileResult;
  const body = String(options.body || '').trim().slice(0, 500);
  const friendId = String(options.friendId || '');
  if (!friendId || !body) return { ok: false, message: 'Üres üzenet vagy nincs kiválasztott barát.' };

  const result = await supabaseRequest('POST', 'launcher_messages', '', {
    sender_id: profileResult.profile.id,
    receiver_id: friendId,
    body
  });
  return result.ok ? { ok: true, message: 'Üzenet elküldve.' } : { ok: false, message: result.message };
}

function modrinthJson(pathname, params = {}) {
  const url = new URL(`${MODRINTH_API}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return fetchJson(url.toString());
}

function mavenArtifactPath(name) {
  const parts = String(name).split(':');
  if (parts.length < 3) throw new Error(`Hibás Maven artifact: ${name}`);
  const [group, artifact, version, classifier] = parts;
  const suffix = classifier ? `-${classifier}` : '';
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}${suffix}.jar`;
}

function normalizeMavenLibrary(library) {
  const url = library.url || 'https://libraries.minecraft.net/';
  const artifactPath = library.downloads?.artifact?.path || mavenArtifactPath(library.name);
  return {
    ...library,
    url,
    downloads: {
      ...(library.downloads || {}),
      artifact: {
        ...(library.downloads?.artifact || {}),
        path: artifactPath,
        url: library.downloads?.artifact?.url || new URL(artifactPath, url).toString()
      }
    }
  };
}

function dedupeLibraries(libraries) {
  const seen = new Set();
  const result = [];
  for (const library of libraries) {
    if (!library?.name || seen.has(library.name)) continue;
    seen.add(library.name);
    result.push(library);
  }
  return result;
}

function mergeFabricArguments(baseArguments, fabricArguments) {
  if (!fabricArguments) return baseArguments;
  if (!baseArguments) return fabricArguments;
  if (Array.isArray(baseArguments)) return baseArguments;

  return {
    game: [
      ...(baseArguments.game || []),
      ...(fabricArguments.client || []),
      ...(fabricArguments.common || []),
      ...(fabricArguments.game || [])
    ],
    jvm: [
      ...(baseArguments.jvm || []),
      ...(fabricArguments.jvm || [])
    ]
  };
}

async function loadMinecraftVersionJson(gameDir, minecraftVersion) {
  const localPath = path.join(gameDir, 'versions', minecraftVersion, `${minecraftVersion}.json`);
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }

  const manifest = await fetchJson('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const entry = (manifest.versions || []).find((item) => item.id === minecraftVersion);
  if (!entry?.url) throw new Error(`Nem találom a Mojang manifestben: ${minecraftVersion}`);
  const versionJson = await fetchJson(entry.url);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(versionJson, null, 2));
  return versionJson;
}

async function ensureFabricProfile(gameDir, minecraftVersion) {
  const loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(minecraftVersion)}`);
  const fabric = loaders.find((item) => item.loader?.stable) || loaders[0];
  if (!fabric?.loader?.version) throw new Error(`Ehhez a verzióhoz nincs Fabric loader: ${minecraftVersion}`);
  const baseVersion = await loadMinecraftVersionJson(gameDir, minecraftVersion);

  const versionId = `fabric-loader-${fabric.loader.version}-${minecraftVersion}`;
  const versionDir = path.join(gameDir, 'versions', versionId);
  const versionJson = path.join(versionDir, `${versionId}.json`);
  fs.mkdirSync(versionDir, { recursive: true });

  const meta = fabric.launcherMeta || {};
  const fabricLibraries = [
    ...(meta.libraries?.common || []),
    ...(meta.libraries?.client || []),
    {
      name: fabric.loader.maven,
      url: 'https://maven.fabricmc.net/'
    },
    {
      name: fabric.intermediary.maven,
      url: 'https://maven.fabricmc.net/'
    }
  ].map(normalizeMavenLibrary);
  const libraries = dedupeLibraries([...(baseVersion.libraries || []), ...fabricLibraries]);

  fs.writeFileSync(versionJson, JSON.stringify({
    ...baseVersion,
    id: versionId,
    releaseTime: baseVersion.releaseTime || new Date().toISOString(),
    time: new Date().toISOString(),
    type: 'release',
    mainClass: typeof meta.mainClass === 'object' ? meta.mainClass.client : meta.mainClass,
    libraries,
    arguments: mergeFabricArguments(baseVersion.arguments, meta.arguments)
  }, null, 2));

  for (const library of libraries) {
    const artifact = library.downloads?.artifact;
    if (!artifact?.url || !artifact?.path) continue;
    const libraryPath = artifact.path;
    const destination = path.join(gameDir, 'libraries', libraryPath);
    if (!fs.existsSync(destination)) {
      await downloadFile(artifact.url, destination);
    }
  }

  return versionId;
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
      message: 'Nincs update URL beállítva. Add meg az assets/update-source.json manifestUrl mezőjében.'
    };
  }

  try {
    const manifest = await fetchJson(manifestUrl);
    if (!manifest.version || !manifest.url) {
      return { ok: false, message: 'Az update manifesthez version és url mezők kellenek.' };
    }
    const hasUpdate = compareVersions(manifest.version, appVersion()) > 0;
    return {
      ok: true,
      hasUpdate,
      manifest,
      currentVersion: appVersion(),
      latestVersion: manifest.version,
      message: hasUpdate
        ? `Van frissebb verzió: ${appVersion()} -> ${manifest.version}`
        : `Nincs frissebb verzió. Aktuális launcher: ${appVersion()}`
    };
  } catch (error) {
    return { ok: false, message: `Update ellenőrzési hiba: ${error.message}` };
  }
}

async function downloadAndInstallUpdate() {
  const check = await checkForUpdate();
  if (!check.ok || !check.hasUpdate) return check;

  try {
    const fileName = path.basename(new URL(check.manifest.url).pathname) || 'Kolbasz Launcher Setup.exe';
    const destination = path.join(app.getPath('downloads'), fileName);
    sendLaunchStatus(`Update letöltése: ${check.manifest.version}`);
    await downloadFile(check.manifest.url, destination);
    sendLaunchStatus(`Update letöltve: ${destination}`);
    await shell.openPath(destination);
    return { ok: true, message: `Update letöltve és elindítva: ${fileName}` };
  } catch (error) {
    return { ok: false, message: `Update letöltés hiba: ${error.message}` };
  }
}

async function searchModrinth(options = {}) {
  const query = String(options.query || '').trim();
  const version = String(options.version || DEFAULT_SETTINGS.version).trim();
  const loader = String(options.loader || 'fabric').trim();
  if (query.length < 2) {
    return { ok: false, message: 'Írj be legalább 2 karaktert a Modrinth kereséshez.' };
  }

  try {
    const facets = JSON.stringify([
      ['project_type:mod'],
      [`versions:${version}`],
      [`categories:${loader}`]
    ]);
    const result = await modrinthJson('/search', {
      query,
      facets,
      limit: '8',
      index: 'relevance'
    });
    const hits = (result.hits || []).map((hit) => ({
      projectId: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      iconUrl: hit.icon_url,
      downloads: hit.downloads,
      follows: hit.follows,
      latestVersion: hit.latest_version,
      categories: hit.display_categories || []
    }));
    return {
      ok: true,
      hits,
      message: hits.length ? `${hits.length} Modrinth találat.` : 'Nincs találat ehhez a verzióhoz és loaderhez.'
    };
  } catch (error) {
    return { ok: false, message: `Modrinth keresési hiba: ${error.message}` };
  }
}

function pickPrimaryModFile(versionData) {
  const files = versionData.files || [];
  return files.find((file) => file.primary) || files.find((file) => String(file.filename || '').endsWith('.jar')) || files[0];
}

async function installModrinthProject(projectId, options, installed, visited) {
  if (!projectId || visited.has(projectId)) return;
  visited.add(projectId);

  const versions = await modrinthJson(`/project/${encodeURIComponent(projectId)}/version`, {
    loaders: JSON.stringify([options.loader]),
    game_versions: JSON.stringify([options.version]),
    include_changelog: 'false'
  });
  const versionData = versions.find((item) => item.version_type === 'release') || versions[0];
  if (!versionData) throw new Error(`Nincs kompatibilis verzió: ${projectId}`);

  const requiredDependencies = (versionData.dependencies || [])
    .filter((dependency) => dependency.dependency_type === 'required' && dependency.project_id);
  for (const dependency of requiredDependencies) {
    await installModrinthProject(dependency.project_id, options, installed, visited);
  }

  const file = pickPrimaryModFile(versionData);
  if (!file || !file.url || !file.filename) throw new Error(`Nincs letölthető fájl: ${projectId}`);

  const modsDir = path.join(options.gameDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });
  const destination = path.join(modsDir, file.filename);
  if (!fs.existsSync(destination)) {
    await downloadFile(file.url, destination);
  }

  installed.push({
    name: versionData.name,
    fileName: file.filename,
    skipped: fs.existsSync(destination)
  });
}

async function installModrinth(options = {}) {
  const projectId = String(options.projectId || '').trim();
  const version = String(options.version || DEFAULT_SETTINGS.version).trim();
  const loader = String(options.loader || 'fabric').trim();
  const gameDir = options.gameDir && fs.existsSync(options.gameDir) ? options.gameDir : defaultGameDir();
  if (!projectId) return { ok: false, message: 'Nincs kiválasztott Modrinth mod.' };

  try {
    setDiscordActivity('Kolbász Launcher', 'Modrinth mod telepítése');
    sendLaunchStatus(`Modrinth telepítés: ${projectId}`);
    const installed = [];
    await installModrinthProject(projectId, { version, loader, gameDir }, installed, new Set());
    const names = installed.map((item) => item.fileName).join(', ');
    return {
      ok: true,
      installed,
      message: `Mod telepítve a mods mappába: ${names}`
    };
  } catch (error) {
    return { ok: false, message: `Modrinth telepítés hiba: ${error.message}` };
  }
}

function modsDirFor(settings = {}) {
  const gameDir = settings.gameDir && fs.existsSync(settings.gameDir) ? settings.gameDir : defaultGameDir();
  return path.join(gameDir, 'mods');
}

function listInstalledMods(settings = {}) {
  const modsDir = modsDirFor(settings);
  fs.mkdirSync(modsDir, { recursive: true });
  const mods = fs.readdirSync(modsDir)
    .filter((name) => name.endsWith('.jar') || name.endsWith('.jar.disabled'))
    .map((name) => {
      const filePath = path.join(modsDir, name);
      const stat = fs.statSync(filePath);
      const enabled = name.endsWith('.jar');
      const cleanName = name.replace(/\.disabled$/, '');
      return {
        name: cleanName,
        fileName: name,
        enabled,
        sizeMb: Number((stat.size / 1024 / 1024).toFixed(1))
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, mods, modsDir, message: `${mods.length} mod a mods mappában.` };
}

function toggleInstalledMod(options = {}) {
  const modsDir = modsDirFor(options);
  const fileName = path.basename(String(options.fileName || ''));
  const current = path.join(modsDir, fileName);
  if (!fileName || !fs.existsSync(current)) return { ok: false, message: 'Nem találom a mod fájlt.' };

  const nextName = fileName.endsWith('.jar.disabled')
    ? fileName.replace(/\.disabled$/, '')
    : `${fileName}.disabled`;
  const next = path.join(modsDir, nextName);
  fs.renameSync(current, next);
  return { ok: true, message: nextName.endsWith('.disabled') ? 'Mod kikapcsolva.' : 'Mod bekapcsolva.', list: listInstalledMods(options) };
}

function deleteInstalledMod(options = {}) {
  const modsDir = modsDirFor(options);
  const fileName = path.basename(String(options.fileName || ''));
  const filePath = path.join(modsDir, fileName);
  if (!fileName || !fs.existsSync(filePath)) return { ok: false, message: 'Nem találom a mod fájlt.' };

  fs.unlinkSync(filePath);
  return { ok: true, message: 'Mod törölve.', list: listInstalledMods(options) };
}

async function openModsFolder(options = {}) {
  const modsDir = modsDirFor(options);
  fs.mkdirSync(modsDir, { recursive: true });
  await shell.openPath(modsDir);
  return { ok: true, message: `Mods mappa megnyitva: ${modsDir}` };
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
  sendLaunchStatus('Microsoft bejelentkezés indítása...');
  const current = readSettings();
  const authManager = new Auth('select_account');
  authManager.on('load', (code) => sendLaunchStatus(`Microsoft: ${lexicon.getCode(code)}`));

  try {
    let xboxManager;
    if (!force && current.microsoftRefreshToken) {
      sendLaunchStatus('Microsoft token frissítése...');
      xboxManager = await authManager.refresh(current.microsoftRefreshToken);
    } else {
      xboxManager = await authManager.launch('electron', {
        width: 520,
        height: 720,
        resizable: false,
        title: 'Microsoft bejelentkezés',
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
    sendLaunchStatus(`Microsoft fiók csatlakoztatva: ${token.profile.name}`);
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
    sendLaunchStatus(`Microsoft token lejárt vagy hibás: ${friendlyAuthError(error)}`, false);
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
    sendLaunchStatus(`Sérült cache törölve: ${path.basename(filePath)}`);
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
  const modLoader = settings.modLoader || DEFAULT_SETTINGS.modLoader;
  const requiredJava = requiredJavaMajor(version);
  const savedJavaPath = settings.javaPath && fs.existsSync(settings.javaPath) ? settings.javaPath : '';
  const savedJavaMajor = savedJavaPath ? getJavaMajor(savedJavaPath) : 0;
  const javaPath = savedJavaMajor >= requiredJava ? savedJavaPath : findBundledJava(gameDir, version);
  const memory = Math.max(1, Number(settings.memoryGb) || DEFAULT_SETTINGS.memoryGb);
  const launcher = new Client();

  const enabledMods = listInstalledMods({ gameDir }).mods.filter((mod) => mod.enabled);
  let launchVersion = version;
  if (enabledMods.length && modLoader !== 'fabric') {
    return {
      ok: false,
      message: `Modok vannak telepítve, de automata modded indítás jelenleg Fabric-kel működik. A Modok fülön válts Fabric loaderre.`
    };
  }

  if (enabledMods.length && modLoader === 'fabric') {
    sendLaunchStatus(`Fabric loader előkészítése ${version} verzióhoz...`);
    launchVersion = await ensureFabricProfile(gameDir, version);
  }

  cleanVersionCache(gameDir, launchVersion);
  setDiscordActivity('Kolbász Launcher', `Minecraft ${version} indítása`);
  sendLaunchStatus(`${LAUNCHER_BRAND} betöltése...`);
  sendLaunchStatus(`Minecraft ${launchVersion} indítás előkészítése...`);
  sendLaunchStatus(`Játék mappa: ${gameDir}`);
  if (savedJavaPath && savedJavaMajor < requiredJava) {
    sendLaunchStatus(`A mentett Java ${savedJavaMajor} túl régi ehhez: Java ${requiredJava} kell. Automatikus Java keresés...`, false);
  }
  sendLaunchStatus(javaPath ? `Java ${getJavaMajor(javaPath)} találva: ${javaPath}` : `Nem találtam kompatibilis Java ${requiredJava}+ futtatókörnyezetet.`);

  if (!javaPath) {
    return {
      ok: false,
      message: `Ehhez a verzióhoz Java ${requiredJava} kell. Add meg a Java exe mezőben a megfelelő javaw.exe útvonalat.`
    };
  }

  const actualJava = getJavaMajor(javaPath);
  if (actualJava < requiredJava) {
    return {
      ok: false,
      message: `A kiválasztott Minecraft ${version} Java ${requiredJava}-et kér, de ez csak Java ${actualJava}. Válassz másik Java exe-t.`
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
      number: launchVersion,
      type: 'release'
    },
    memory: {
      max: `${memory}G`,
      min: '1G'
    },
    customArgs: [
      `-Dminecraft.launcher.brand=${LAUNCHER_BRAND}`,
      `-Dminecraft.launcher.version=${appVersion()}`
    ],
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
        lastDebug = 'Minecraft process indítása...';
        sendLaunchStatus('Minecraft process indítása...');
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
      sendLaunchStatus(`Letöltve: ${name}`);
    });

    launcher.on('data', (line) => {
      const cleanLine = String(line).trim();
      if (cleanLine) sendLaunchStatus(cleanLine);
    });

    launcher.on('close', (code) => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, message: `A Minecraft rögtön kilépett. Hibakód: ${code ?? 'ismeretlen'}. ${lastDebug}` });
        return;
      }

      if (reportedRunning) {
        sendLaunchStatus(`Minecraft bezárva. Kód: ${code ?? 'ismeretlen'}`);
      }
    });

    launcher.launch(opts).then((child) => {
      if (settled) return;
      if (!child) {
        settled = true;
        sendLaunchStatus(`Sikertelen indítás: ${lastDebug}`, false);
        resolve({
          ok: false,
          message: `Nem sikerült elindítani a(z) ${version} verziót. Ellenőrizd a Java elérést. Részlet: ${lastDebug}`
        });
        return;
      }
      child.unref();
      sendLaunchStatus(`Minecraft process elindult. PID: ${child.pid}. Gyors ellenőrzés...`);

      setTimeout(() => {
        if (settled) return;
        settled = true;
        reportedRunning = true;
        setDiscordActivity('Kolbász Launcher', `Minecraft ${version} fut`);
        resolve({
          ok: true,
          message: `Minecraft ${version} fut.`
        });
      }, 3500);
    }).catch((error) => {
      if (settled) return;
      settled = true;
      sendLaunchStatus(`Indítási hiba: ${error.message}`, false);
      resolve({ ok: false, message: `Indítási hiba: ${error.message}` });
    });
  });
}

function launchJar(settings) {
  if (!settings.javaPath || !settings.jarPath) {
    return {
      ok: false,
      message: 'Adj meg Java elérési utat és egy futtatható .jar fájlt a Custom Jar indításhoz.'
    };
  }

  if (!fs.existsSync(settings.javaPath)) {
    return { ok: false, message: 'A megadott Java elérési út nem létezik.' };
  }

  if (!fs.existsSync(settings.jarPath)) {
    return { ok: false, message: 'A megadott .jar fájl nem létezik.' };
  }

  const memory = Math.max(1, Number(settings.memoryGb) || DEFAULT_SETTINGS.memoryGb);
  const args = [`-Xmx${memory}G`, '-jar', settings.jarPath];
  const child = spawn(settings.javaPath, args, {
    cwd: settings.gameDir && fs.existsSync(settings.gameDir) ? settings.gameDir : path.dirname(settings.jarPath),
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  return { ok: true, message: `Custom Jar elindítva ${memory} GB RAM limittel.` };
}

function createWindow() {
  initDiscordPresence();

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 740,
    minWidth: 960,
    minHeight: 640,
    title: 'Kolbász Launcher',
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
ipcMain.handle('modrinth:search', (_, options) => searchModrinth(options));
ipcMain.handle('modrinth:install', (_, options) => installModrinth(options));
ipcMain.handle('mods:list', (_, options) => listInstalledMods(options));
ipcMain.handle('mods:toggle', (_, options) => toggleInstalledMod(options));
ipcMain.handle('mods:delete', (_, options) => deleteInstalledMod(options));
ipcMain.handle('mods:open-folder', (_, options) => openModsFolder(options));
ipcMain.handle('friends:profile', (_, settings) => ensureFriendProfile(settings));
ipcMain.handle('friends:list', (_, settings) => getFriendsState(settings));
ipcMain.handle('friends:add', (_, options) => addFriend(options));
ipcMain.handle('friends:accept', (_, options) => acceptFriend(options));
ipcMain.handle('friends:reject', (_, options) => rejectFriend(options));
ipcMain.handle('friends:messages', (_, options) => listFriendMessages(options));
ipcMain.handle('friends:send', (_, options) => sendFriendMessage(options));
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
