// =============================================================================
// WhatsApp Themes — popup.js v7
// Changes from v6:
//   • New globalSettings fields: convHeaderOpacity, convHeaderBlur,
//     chatlistHeaderColor, chatlistHeaderOpacity, chatlistHeaderBlur
//   • Videos stored as Uint8Array in chrome.storage.local (storageKey pattern)
//   • Popup previews for storage-key videos resolved via objectURL
//   • Images still use base64 (they're small enough)
//   • Full render/read/liveRange wiring for all new controls
//   • Sidebar video upload path saves to storage, not into settings blob
// =============================================================================

const DEFAULTS = {
  enabled:               true,
  outBubbleColor:        '#144d37',
  outBubbleOpacity:      100,
  blurOutBubble:         false,
  inBubbleColor:         '#242626',
  inBubbleOpacity:       100,
  blurInBubble:          false,
  blurIntensity:         8,
  fontFamily:            '',
  fontSize:              14,
  // Conversation header (top of chat panel)
  headerColor:           '#202c33',
  convHeaderOpacity:     100,
  convHeaderBlur:        0,
  // Chatlist header (top of sidebar)
  chatlistHeaderColor:   '#202c33',
  chatlistHeaderOpacity: 100,
  chatlistHeaderBlur:    0,
  // Wallpapers
  globalWallpaper:       null,
  sidebarWallpaper:      null,
  // Sidebar
  sidebarTintColor:      '#111b21',
  sidebarTintOpacity:    0,
  blurSidebar:           false,
  sidebarBlurIntensity:  8,
  sidebarColor:          '#111b21',
  // Chat cards
  chatCardBgColor:       '#1d1f1f',
  chatCardOpacity:       100,
  chatCardBlur:          false,
  chatCardBlurIntensity: 4,
  // Nav strip (leftmost icon panel: Chats/Status/Channels)
  navStripColor:         '#202c33',
  navStripOpacity:       100,
  navStripBlur:          0,
};

let settings         = { ...DEFAULTS };
let chatSettings     = {};

// pendingGlobalWp / pendingSidebarWp store the chosen-but-not-yet-saved wallpaper.
// For images: { type:'image', data: base64string }
// For videos: { type:'video', file: File, previewUrl: string }
// null means "nothing pending; use whatever's already in settings"
// { type:'__removed__' } means the user hit ✕ explicitly
let pendingGlobalWp  = null;
let pendingSidebarWp = null;

// objectURLs created in this popup session — need revoking when popup closes
const popupObjectUrls = [];

// ---------------------------------------------------------------------------
// INDEXEDDB VIDEO STORAGE (mirrors content.js — same DB, same store)
// ---------------------------------------------------------------------------
let _idb = null;
async function openVideoDB() {
  if (_idb) return _idb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wa-themes-videos', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('videos');
    req.onsuccess       = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror         = e => reject(e.target.error);
  });
}
async function idbGet(key) {
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('videos', 'readonly').objectStore('videos').get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}
async function idbSet(key, value) {
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('videos', 'readwrite').objectStore('videos').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
async function idbDelete(key) {
  if (!key) return;
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('videos', 'readwrite').objectStore('videos').delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  await renderSettings();
  setupTabs();
  setupListeners();
  loadCurrentChat();
  renderChatList();
});

window.addEventListener('unload', () => {
  popupObjectUrls.forEach(u => URL.revokeObjectURL(u));
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
async function loadAll() {
  return new Promise(resolve => {
    chrome.storage.local.get(['globalSettings', 'chatWallpapers'], result => {
      settings     = Object.assign({ ...DEFAULTS }, result.globalSettings || {});
      chatSettings = result.chatWallpapers || {};
      resolve();
    });
  });
}

async function saveSettings() {
  await chrome.storage.local.set({ globalSettings: settings });
}

async function saveChatSettings() {
  await chrome.storage.local.set({ chatWallpapers: chatSettings });
}

// ---------------------------------------------------------------------------
// Resolve a video storageKey → objectURL for previewing inside the popup
// ---------------------------------------------------------------------------
function makeAndTrackObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  popupObjectUrls.push(url);
  return url;
}

async function resolveVideoPreviewUrl(storageKey) {
  if (!storageKey) return null;
  try {
    // IDB first (all new uploads), chrome.storage.local fallback (legacy)
    let data = await idbGet(storageKey);
    if (!data) {
      const result = await chrome.storage.local.get(storageKey);
      data = result[storageKey] ?? null;
    }
    if (!data) return null;
    let buffer;
    if (data instanceof Uint8Array) buffer = data.buffer;
    else if (data.buffer)           buffer = data.buffer;
    else                            buffer = new Uint8Array(Object.values(data)).buffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    return makeAndTrackObjectUrl(blob);
  } catch (e) {
    console.error('[WA Themes popup] resolveVideoPreviewUrl failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Render settings → UI
// ---------------------------------------------------------------------------
async function renderSettings() {
  const s = settings;
  chk('enabled',               s.enabled !== false);
  val('outBubbleColor',        s.outBubbleColor         || DEFAULTS.outBubbleColor);
  rng('outBubbleOpacity',      s.outBubbleOpacity        ?? 100,  'outOpacityVal',           '%');
  chk('blurOutBubble',         s.blurOutBubble           ?? false);
  val('inBubbleColor',         s.inBubbleColor          || DEFAULTS.inBubbleColor);
  rng('inBubbleOpacity',       s.inBubbleOpacity         ?? 100,  'inOpacityVal',            '%');
  chk('blurInBubble',          s.blurInBubble            ?? false);
  rng('blurIntensity',         s.blurIntensity           ?? 8,    'blurVal',                 'px');
  val('fontFamily',            s.fontFamily             || '');
  rng('fontSize',              s.fontSize               ?? 14,   'fontSizeVal',             'px');

  // Conversation header
  val('headerColor',           s.headerColor            || DEFAULTS.headerColor);
  rng('convHeaderOpacity',     s.convHeaderOpacity       ?? 100,  'convHeaderOpacityVal',    '%');
  rng('convHeaderBlur',        s.convHeaderBlur          ?? 0,    'convHeaderBlurVal',       'px');

  // Chatlist header
  val('chatlistHeaderColor',   s.chatlistHeaderColor    || DEFAULTS.chatlistHeaderColor);
  rng('chatlistHeaderOpacity', s.chatlistHeaderOpacity   ?? 100,  'chatlistHeaderOpacityVal','%');
  rng('chatlistHeaderBlur',    s.chatlistHeaderBlur      ?? 0,    'chatlistHeaderBlurVal',   'px');

  // Sidebar misc
  val('sidebarTintColor',      s.sidebarTintColor       || DEFAULTS.sidebarTintColor);
  rng('sidebarTintOpacity',    s.sidebarTintOpacity      ?? 0,    'sidebarTintVal',          '%');
  chk('blurSidebar',           s.blurSidebar             ?? false);
  rng('sidebarBlurIntensity',  s.sidebarBlurIntensity    ?? 8,    'sidebarBlurVal',          'px');
  val('sidebarColor',          s.sidebarColor           || DEFAULTS.sidebarColor);
  val('chatCardBgColor',       s.chatCardBgColor        || DEFAULTS.chatCardBgColor);
  rng('chatCardOpacity',       s.chatCardOpacity         ?? 100,  'chatCardOpacityVal',      '%');
  chk('chatCardBlur',          s.chatCardBlur            ?? false);
  rng('chatCardBlurIntensity', s.chatCardBlurIntensity   ?? 4,    'chatCardBlurIntensityVal','px');
  // Nav strip
  val('navStripColor',         s.navStripColor          || DEFAULTS.navStripColor);
  rng('navStripOpacity',       s.navStripOpacity         ?? 100,  'navStripOpacityVal',      '%');
  rng('navStripBlur',          s.navStripBlur            ?? 0,    'navStripBlurVal',         'px');
  chk('globalWpBlur',          s.globalWallpaper?.blur   ?? false);

  // Global wallpaper preview
  if (s.globalWallpaper) {
    if (s.globalWallpaper.type === 'video' && s.globalWallpaper.storageKey) {
      const url = await resolveVideoPreviewUrl(s.globalWallpaper.storageKey);
      if (url) renderPreview('global-wp-preview', 'global-wp-placeholder', { type: 'video', data: url });
      else clearPreview('global-wp-preview', 'global-wp-placeholder', 'Video wallpaper set');
    } else {
      renderPreview('global-wp-preview', 'global-wp-placeholder', s.globalWallpaper);
    }
  } else {
    clearPreview('global-wp-preview', 'global-wp-placeholder', 'No wallpaper set');
  }

  // Sidebar wallpaper preview
  if (s.sidebarWallpaper) {
    if (s.sidebarWallpaper.type === 'video' && s.sidebarWallpaper.storageKey) {
      const url = await resolveVideoPreviewUrl(s.sidebarWallpaper.storageKey);
      if (url) renderPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', { type: 'video', data: url });
      else clearPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', 'Video wallpaper set');
    } else {
      renderPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', s.sidebarWallpaper);
    }
  } else {
    clearPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', 'No wallpaper set');
  }
}

// ---------------------------------------------------------------------------
// Read UI → settings object (does NOT handle video file saving — that's in applyAndNotify)
// ---------------------------------------------------------------------------
function readSettingsFromUI() {
  const wpBlur = g('globalWpBlur').checked;

  // Global wallpaper: if there's a pending image, use it; otherwise keep existing
  let globalWallpaper = settings.globalWallpaper || null;
  if (pendingGlobalWp?.type === '__removed__') {
    globalWallpaper = null;
  } else if (pendingGlobalWp?.type === 'image') {
    globalWallpaper = { type: 'image', data: pendingGlobalWp.data, blur: wpBlur };
  } else if (globalWallpaper) {
    globalWallpaper = { ...globalWallpaper, blur: wpBlur };
  }
  // Video global: storageKey is written separately in applyAndNotify before this is called

  // Sidebar wallpaper: same pattern; video storageKey handled separately
  let sidebarWallpaper = settings.sidebarWallpaper || null;
  if (pendingSidebarWp?.type === '__removed__') {
    sidebarWallpaper = null;
  } else if (pendingSidebarWp?.type === 'image') {
    sidebarWallpaper = { type: 'image', data: pendingSidebarWp.data };
  }
  // If pendingSidebarWp?.type === 'video', storageKey is set in applyAndNotify first

  return {
    enabled:               g('enabled').checked,
    outBubbleColor:        getVal('outBubbleColor'),
    outBubbleOpacity:      parseInt(getVal('outBubbleOpacity')),
    blurOutBubble:         g('blurOutBubble').checked,
    inBubbleColor:         getVal('inBubbleColor'),
    inBubbleOpacity:       parseInt(getVal('inBubbleOpacity')),
    blurInBubble:          g('blurInBubble').checked,
    blurIntensity:         parseInt(getVal('blurIntensity')),
    fontFamily:            getVal('fontFamily'),
    fontSize:              parseInt(getVal('fontSize')),
    // Conversation header
    headerColor:           getVal('headerColor'),
    convHeaderOpacity:     parseInt(getVal('convHeaderOpacity')),
    convHeaderBlur:        parseInt(getVal('convHeaderBlur')),
    // Chatlist header
    chatlistHeaderColor:   getVal('chatlistHeaderColor'),
    chatlistHeaderOpacity: parseInt(getVal('chatlistHeaderOpacity')),
    chatlistHeaderBlur:    parseInt(getVal('chatlistHeaderBlur')),
    // Wallpapers
    globalWallpaper,
    sidebarWallpaper,
    // Sidebar
    sidebarTintColor:      getVal('sidebarTintColor'),
    sidebarTintOpacity:    parseInt(getVal('sidebarTintOpacity')),
    blurSidebar:           g('blurSidebar').checked,
    sidebarBlurIntensity:  parseInt(getVal('sidebarBlurIntensity')),
    sidebarColor:          getVal('sidebarColor'),
    chatCardBgColor:       getVal('chatCardBgColor'),
    chatCardOpacity:       parseInt(getVal('chatCardOpacity')),
    chatCardBlur:          getBool('chatCardBlur'),
    chatCardBlurIntensity: parseInt(getVal('chatCardBlurIntensity')),
    navStripColor:         getVal('navStripColor'),
    navStripOpacity:       parseInt(getVal('navStripOpacity')),
    navStripBlur:          parseInt(getVal('navStripBlur')),
  };
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      g(`tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'chats') { loadCurrentChat(); renderChatList(); }
    });
  });
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------
function setupListeners() {
  // Range labels — existing controls
  liveRange('outBubbleOpacity',    'outOpacityVal');
  liveRange('inBubbleOpacity',     'inOpacityVal');
  liveRange('blurIntensity',       'blurVal');
  liveRange('sidebarTintOpacity',  'sidebarTintVal');
  liveRange('sidebarBlurIntensity','sidebarBlurVal');
  liveRange('chatCardOpacity',      'chatCardOpacityVal');
  liveRange('chatCardBlurIntensity','chatCardBlurIntensityVal');
  liveRange('navStripOpacity',      'navStripOpacityVal');
  liveRange('navStripBlur',         'navStripBlurVal');
  liveRange('fontSize',             'fontSizeVal');

  // Range labels — new header controls
  liveRange('convHeaderOpacity',     'convHeaderOpacityVal');
  liveRange('convHeaderBlur',        'convHeaderBlurVal');
  liveRange('chatlistHeaderOpacity', 'chatlistHeaderOpacityVal');
  liveRange('chatlistHeaderBlur',    'chatlistHeaderBlurVal');

  // Reset buttons
  document.querySelectorAll('.reset-btn').forEach(btn => {
    btn.addEventListener('click', () => val(btn.dataset.target, btn.dataset.default || ''));
  });

  // ── Global wallpaper upload ──────────────────────────────────────────────
  g('wa-global-btn-img').addEventListener('click', () => g('wa-global-file-img').click());
  g('wa-global-btn-vid').addEventListener('click', () => g('wa-global-file-vid').click());
  g('wa-global-file-img').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readFileAsDataURL(f, data => {
      pendingGlobalWp = { type: 'image', data };
      renderPreview('global-wp-preview', 'global-wp-placeholder', { type: 'image', data });
    });
  });
  g('wa-global-file-vid').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const url = makeAndTrackObjectUrl(f);
    pendingGlobalWp = { type: 'video', file: f, previewUrl: url };
    renderPreview('global-wp-preview', 'global-wp-placeholder', { type: 'video', data: url });
  });
  g('wa-global-btn-remove').addEventListener('click', () => {
    pendingGlobalWp = { type: '__removed__' };
    clearPreview('global-wp-preview', 'global-wp-placeholder', 'No wallpaper set');
  });

  // ── Sidebar wallpaper upload ─────────────────────────────────────────────
  g('wa-sidebar-btn-img').addEventListener('click', () => g('wa-sidebar-file-img').click());
  g('wa-sidebar-btn-vid').addEventListener('click', () => g('wa-sidebar-file-vid').click());
  g('wa-sidebar-file-img').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readFileAsDataURL(f, data => {
      pendingSidebarWp = { type: 'image', data };
      renderPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', { type: 'image', data });
    });
  });
  g('wa-sidebar-file-vid').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const url = makeAndTrackObjectUrl(f);
    pendingSidebarWp = { type: 'video', file: f, previewUrl: url };
    renderPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', { type: 'video', data: url });
  });
  g('wa-sidebar-btn-remove').addEventListener('click', () => {
    pendingSidebarWp = { type: '__removed__' };
    clearPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', 'No wallpaper set');
  });

  // ── Apply / Reset ────────────────────────────────────────────────────────
  g('applyBtn').addEventListener('click', applyAndNotify);
  g('resetAllBtn').addEventListener('click', async () => {
    // Delete stored video blobs from IDB (and legacy chrome.storage.local)
    const gk = settings.globalWallpaper?.storageKey;
    const sk = settings.sidebarWallpaper?.storageKey;
    if (gk) { await idbDelete(gk).catch(() => {}); await chrome.storage.local.remove(gk).catch(() => {}); }
    if (sk) { await idbDelete(sk).catch(() => {}); await chrome.storage.local.remove(sk).catch(() => {}); }
    settings = { ...DEFAULTS };
    pendingGlobalWp = null; pendingSidebarWp = null;
    await renderSettings();
    await applyAndNotify();
  });
}

// ---------------------------------------------------------------------------
// Apply + notify
// ---------------------------------------------------------------------------
async function applyAndNotify() {
  // 1. Handle pending video uploads — write ArrayBuffer to chrome.storage first,
  //    then update the settings object with the storageKey reference.
  if (pendingGlobalWp?.type === 'video' && pendingGlobalWp.file) {
    const key = settings.globalWallpaper?.storageKey || ('wa_vid_global_' + Date.now().toString(36));
    try {
      const ab = await pendingGlobalWp.file.arrayBuffer();
      await idbSet(key, new Uint8Array(ab));
      settings.globalWallpaper = { type: 'video', storageKey: key };
      pendingGlobalWp = null;
    } catch (e) {
      console.error('[WA Themes popup] Global video save failed:', e);
      showPopupStatus('Video save failed.', true);
      return;
    }
  }

  if (pendingSidebarWp?.type === 'video' && pendingSidebarWp.file) {
    const key = settings.sidebarWallpaper?.storageKey || ('wa_vid_sidebar_' + Date.now().toString(36));
    try {
      const ab = await pendingSidebarWp.file.arrayBuffer();
      await idbSet(key, new Uint8Array(ab));
      settings.sidebarWallpaper = { type: 'video', storageKey: key };
      pendingSidebarWp = null;
    } catch (e) {
      console.error('[WA Themes popup] Sidebar video save failed:', e);
      showPopupStatus('Video save failed.', true);
      return;
    }
  }

  // 2. Handle explicit removal — delete stored blob if applicable
  if (pendingGlobalWp?.type === '__removed__' && settings.globalWallpaper?.storageKey) {
    const k = settings.globalWallpaper.storageKey;
    await idbDelete(k).catch(() => {});
    await chrome.storage.local.remove(k).catch(() => {});
  }
  if (pendingSidebarWp?.type === '__removed__' && settings.sidebarWallpaper?.storageKey) {
    const k = settings.sidebarWallpaper.storageKey;
    await idbDelete(k).catch(() => {});
    await chrome.storage.local.remove(k).catch(() => {});
  }

  // 3. Read the rest of the UI state
  settings = readSettingsFromUI();
  pendingGlobalWp  = null;
  pendingSidebarWp = null;

  // 4. Persist and notify
  await saveSettings();
  await notifyContentScript();

  showPopupStatus('✓ Applied!', false);
}

function showPopupStatus(text, isError) {
  const btn = g('applyBtn');
  btn.textContent = text;
  btn.classList.toggle('success', !isError);
  btn.style.background = isError ? '#ea0038' : '';
  setTimeout(() => {
    btn.textContent = 'Apply Changes';
    btn.classList.remove('success');
    btn.style.background = '';
  }, 1800);
}

async function notifyContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED' });
  } catch {}
}

// ---------------------------------------------------------------------------
// Active chat
// ---------------------------------------------------------------------------
async function loadCurrentChat() {
  const label = g('currentChatLabel');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error();
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_CHAT' });
    label.textContent = res?.chatName || '—';
  } catch { label.textContent = 'Open WhatsApp Web first'; }
}

// ---------------------------------------------------------------------------
// Per-chat list (read-only summary + delete)
// ---------------------------------------------------------------------------
function renderChatList() {
  const container = g('chat-list-container');
  const entries   = Object.entries(chatSettings);

  if (!entries.length) {
    container.innerHTML = `
      <div class="empty-msg">
        No per-chat settings saved yet.<br>
        <span class="hint">Open a chat → click ⋮ → Chat Wallpaper</span>
      </div>`;
    return;
  }

  container.innerHTML = '';
  entries.forEach(([chatName, cs]) => {
    const item = document.createElement('div');
    item.className = 'chat-item';

    const header = document.createElement('div');
    header.className = 'chat-item-header';

    const hasWp = cs.wallpaperType && (cs.wallpaperData || cs.wallpaperStorageKey);
    let thumb;
    if (hasWp && cs.wallpaperType === 'image' && cs.wallpaperData) {
      thumb = document.createElement('img');
      thumb.src = cs.wallpaperData;
    } else if (hasWp && cs.wallpaperType === 'video') {
      // For storage-key videos, show a placeholder icon (async load is overkill for a tiny thumb)
      thumb = document.createElement('div');
      thumb.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:18px;';
      thumb.textContent = '🎬';
    } else {
      thumb = document.createElement('div');
      thumb.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:18px;';
      thumb.textContent = '💬';
    }
    thumb.className = 'chat-item-thumb';

    const name = document.createElement('div');
    name.className = 'chat-item-name';
    name.textContent = chatName;

    const del = document.createElement('button');
    del.className = 'chat-item-del';
    del.title = 'Delete all settings for this chat';
    del.textContent = '✕';
    del.addEventListener('click', async () => {
      // Clean up stored video blob if present
      if (cs.wallpaperStorageKey) await chrome.storage.local.remove(cs.wallpaperStorageKey);
      delete chatSettings[chatName];
      await saveChatSettings();
      await notifyContentScript();
      renderChatList();
    });

    header.append(thumb, name, del);

    const tags = document.createElement('div');
    tags.className = 'chat-item-tags';

    if (hasWp) {
      const t = document.createElement('span');
      t.className = 'tag wp';
      t.textContent = cs.wallpaperType === 'video' ? '🎬 Wallpaper' : '🖼️ Wallpaper';
      tags.appendChild(t);
    }
    if (cs.wallpaperBlur) {
      const t = document.createElement('span'); t.className = 'tag blur'; t.textContent = '✨ Blur';
      tags.appendChild(t);
    }
    if (cs.outBubbleColor) {
      const t = document.createElement('span');
      t.className = 'tag out';
      t.style.cssText = `color:${cs.outBubbleColor};border-color:${cs.outBubbleColor};background:${hexToRgba(cs.outBubbleColor, 0.15)};`;
      t.textContent = `↑ ${Math.round(cs.outBubbleOpacity ?? 100)}%${cs.blurOutBubble ? ' blur' : ''}`;
      tags.appendChild(t);
    }
    if (cs.inBubbleColor) {
      const t = document.createElement('span');
      t.className = 'tag in';
      t.style.cssText = `color:${cs.inBubbleColor};border-color:${cs.inBubbleColor};background:${hexToRgba(cs.inBubbleColor, 0.15)};`;
      t.textContent = `↓ ${Math.round(cs.inBubbleOpacity ?? 100)}%${cs.blurInBubble ? ' blur' : ''}`;
      tags.appendChild(t);
    }

    item.append(header, tags);
    container.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------
function renderPreview(previewId, placeholderId, wp) {
  const el = g(previewId);
  el.innerHTML = '';
  if (wp.type === 'video') {
    const v = document.createElement('video');
    v.src = wp.data; v.autoplay = true; v.loop = true; v.muted = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    el.appendChild(v);
  } else {
    const img = document.createElement('img');
    img.src = wp.data;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    el.appendChild(img);
  }
}

function clearPreview(previewId, placeholderId, text) {
  g(previewId).innerHTML = `<span id="${placeholderId}">${text}</span>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function g(id)        { return document.getElementById(id); }
function getVal(id)   { return g(id)?.value ?? ''; }
function getBool(id)  { return g(id)?.checked ?? false; }
function val(id, v)   { if (g(id)) g(id).value = v; }
function chk(id, v)   { if (g(id)) g(id).checked = v; }

function rng(id, v, labelId) {
  val(id, v);
  if (labelId && g(labelId)) g(labelId).textContent = v;
}

function liveRange(rangeId, labelId) {
  const el = g(rangeId); if (!el) return;
  el.addEventListener('input', e => { if (g(labelId)) g(labelId).textContent = e.target.value; });
}

function readFileAsDataURL(file, cb) {
  const r = new FileReader();
  r.onload = e => cb(e.target.result);
  r.readAsDataURL(file);
}

function hexToRgba(hex, a) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const gg = parseInt(hex.slice(2, 4), 16);
  const b  = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${gg},${b},${a})`;
}
