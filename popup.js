// =============================================================================
// WhatsApp Themes — popup.js v6
// =============================================================================

const DEFAULTS = {
  enabled:              true,
  outBubbleColor:       '#144d37',
  outBubbleOpacity:     100,
  blurOutBubble:        false,
  inBubbleColor:        '#242626',
  inBubbleOpacity:      100,
  blurInBubble:         false,
  blurIntensity:        8,
  fontFamily:           '',
  fontSize:             14,
  headerColor:          '#202c33',
  globalWallpaper:      null,
  sidebarWallpaper:     null,
  sidebarTintColor:     '#111b21',
  sidebarTintOpacity:   0,
  blurSidebar:          false,
  sidebarBlurIntensity: 8,
  sidebarColor:         '#111b21',
  chatListBgColor:      '#1d1f1f',
  chatListOpacity:      100,
};

let settings          = { ...DEFAULTS };
let chatSettings      = {};   // per-chat: wallpaper + optional bubble overrides
let pendingGlobalWp   = null;
let pendingSidebarWp  = null;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  renderSettings();
  setupTabs();
  setupListeners();
  loadCurrentChat();
  renderChatList();
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
// Render settings → UI
// ---------------------------------------------------------------------------
function renderSettings() {
  const s = settings;
  chk('enabled',             s.enabled !== false);
  val('outBubbleColor',      s.outBubbleColor      || DEFAULTS.outBubbleColor);
  rng('outBubbleOpacity',    s.outBubbleOpacity     ?? 100, 'outOpacityVal',     '%');
  chk('blurOutBubble',       s.blurOutBubble        ?? false);
  val('inBubbleColor',       s.inBubbleColor        || DEFAULTS.inBubbleColor);
  rng('inBubbleOpacity',     s.inBubbleOpacity      ?? 100, 'inOpacityVal',      '%');
  chk('blurInBubble',        s.blurInBubble         ?? false);
  rng('blurIntensity',       s.blurIntensity        ?? 8,   'blurVal',           'px');
  val('fontFamily',          s.fontFamily           || '');
  rng('fontSize',            s.fontSize             ?? 14,  'fontSizeVal',       'px');
  val('headerColor',         s.headerColor          || DEFAULTS.headerColor);
  val('sidebarTintColor',    s.sidebarTintColor     || DEFAULTS.sidebarTintColor);
  rng('sidebarTintOpacity',  s.sidebarTintOpacity   ?? 0,   'sidebarTintVal',    '%');
  chk('blurSidebar',         s.blurSidebar          ?? false);
  rng('sidebarBlurIntensity',s.sidebarBlurIntensity ?? 8,   'sidebarBlurVal',    'px');
  val('sidebarColor',        s.sidebarColor         || DEFAULTS.sidebarColor);
  val('chatListBgColor',     s.chatListBgColor      || DEFAULTS.chatListBgColor);
  rng('chatListOpacity',     s.chatListOpacity      ?? 100, 'chatListOpacityVal', '%');
  chk('globalWpBlur',        s.globalWallpaper?.blur ?? false);

  if (s.globalWallpaper)  renderPreview('global-wp-preview',  'global-wp-placeholder',  s.globalWallpaper);
  else clearPreview('global-wp-preview',  'global-wp-placeholder',  'No wallpaper set');
  if (s.sidebarWallpaper) renderPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', s.sidebarWallpaper);
  else clearPreview('sidebar-wp-preview', 'sidebar-wp-placeholder', 'No wallpaper set');
}

// ---------------------------------------------------------------------------
// Read UI → settings
// ---------------------------------------------------------------------------
function readSettings() {
  const wpBlur        = g('globalWpBlur').checked;
  let globalWallpaper = settings.globalWallpaper || null;
  if (pendingGlobalWp)       globalWallpaper  = { ...pendingGlobalWp, blur: wpBlur };
  else if (globalWallpaper)  globalWallpaper  = { ...globalWallpaper, blur: wpBlur };

  let sidebarWallpaper = settings.sidebarWallpaper || null;
  if (pendingSidebarWp) sidebarWallpaper = { ...pendingSidebarWp };

  return {
    enabled:              g('enabled').checked,
    outBubbleColor:       getVal('outBubbleColor'),
    outBubbleOpacity:     parseInt(getVal('outBubbleOpacity')),
    blurOutBubble:        g('blurOutBubble').checked,
    inBubbleColor:        getVal('inBubbleColor'),
    inBubbleOpacity:      parseInt(getVal('inBubbleOpacity')),
    blurInBubble:         g('blurInBubble').checked,
    blurIntensity:        parseInt(getVal('blurIntensity')),
    fontFamily:           getVal('fontFamily'),
    fontSize:             parseInt(getVal('fontSize')),
    headerColor:          getVal('headerColor'),
    globalWallpaper,
    sidebarWallpaper,
    sidebarTintColor:     getVal('sidebarTintColor'),
    sidebarTintOpacity:   parseInt(getVal('sidebarTintOpacity')),
    blurSidebar:          g('blurSidebar').checked,
    sidebarBlurIntensity: parseInt(getVal('sidebarBlurIntensity')),
    sidebarColor:         getVal('sidebarColor'),
    chatListBgColor:      getVal('chatListBgColor'),
    chatListOpacity:      parseInt(getVal('chatListOpacity')),
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
  liveRange('outBubbleOpacity',    'outOpacityVal',     '%');
  liveRange('inBubbleOpacity',     'inOpacityVal',      '%');
  liveRange('blurIntensity',       'blurVal',           'px');
  liveRange('sidebarTintOpacity',  'sidebarTintVal',    '%');
  liveRange('sidebarBlurIntensity','sidebarBlurVal',    'px');
  liveRange('chatListOpacity',     'chatListOpacityVal', '%');
  liveRange('fontSize',            'fontSizeVal',       'px');

  document.querySelectorAll('.reset-btn').forEach(btn => {
    btn.addEventListener('click', () => val(btn.dataset.target, btn.dataset.default || ''));
  });

  wireUpload('wa-global-btn-img','wa-global-btn-vid','wa-global-btn-remove',
             'wa-global-file-img','wa-global-file-vid',
             'global-wp-preview','global-wp-placeholder',
             (data,type) => { pendingGlobalWp  = { type, data }; },
             ()           => { pendingGlobalWp  = null; settings.globalWallpaper  = null; });

  wireUpload('wa-sidebar-btn-img','wa-sidebar-btn-vid','wa-sidebar-btn-remove',
             'wa-sidebar-file-img','wa-sidebar-file-vid',
             'sidebar-wp-preview','sidebar-wp-placeholder',
             (data,type) => { pendingSidebarWp = { type, data }; },
             ()           => { pendingSidebarWp = null; settings.sidebarWallpaper = null; });

  g('applyBtn').addEventListener('click', applyAndNotify);
  g('resetAllBtn').addEventListener('click', async () => {
    settings = { ...DEFAULTS };
    pendingGlobalWp = null; pendingSidebarWp = null;
    renderSettings();
    await applyAndNotify();
  });
}

function wireUpload(bImg,bVid,bRem,fImg,fVid,prevId,placeId,onFile,onRemove) {
  g(bImg).addEventListener('click', () => g(fImg).click());
  g(bVid).addEventListener('click', () => g(fVid).click());
  g(fImg).addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readFile(f, data => { onFile(data,'image'); renderPreview(prevId,placeId,{type:'image',data}); });
  });
  g(fVid).addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readFile(f, data => { onFile(data,'video'); renderPreview(prevId,placeId,{type:'video',data}); });
  });
  g(bRem).addEventListener('click', () => { onRemove(); clearPreview(prevId,placeId,'No wallpaper set'); });
}

// ---------------------------------------------------------------------------
// Apply + notify
// ---------------------------------------------------------------------------
async function applyAndNotify() {
  settings = readSettings();
  pendingGlobalWp = null; pendingSidebarWp = null;
  await saveSettings();
  await notifyContentScript();
  const btn = g('applyBtn');
  btn.textContent = '✓ Applied!'; btn.classList.add('success');
  setTimeout(() => { btn.textContent = 'Apply Changes'; btn.classList.remove('success'); }, 1600);
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

    // Header row: thumb + name + delete
    const header = document.createElement('div');
    header.className = 'chat-item-header';

    let thumb;
    const hasWp = cs.wallpaperType && cs.wallpaperData;
    if (hasWp) {
      thumb = cs.wallpaperType === 'video' ? document.createElement('video') : document.createElement('img');
      if (cs.wallpaperType === 'video') { thumb.autoplay=true; thumb.loop=true; thumb.muted=true; }
      thumb.src = cs.wallpaperData;
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
    del.className = 'chat-item-del'; del.title = 'Delete all settings for this chat'; del.textContent = '✕';
    del.addEventListener('click', async () => {
      delete chatSettings[chatName];
      await saveChatSettings();
      await notifyContentScript();
      renderChatList();
    });

    header.append(thumb, name, del);

    // Tags row
    const tags = document.createElement('div');
    tags.className = 'chat-item-tags';

    if (hasWp) {
      const t = document.createElement('span');
      t.className = 'tag wp';
      t.textContent = cs.wallpaperType === 'video' ? '🎬 Wallpaper' : '🖼️ Wallpaper';
      tags.appendChild(t);
    }
    if (cs.wallpaperBlur) {
      const t = document.createElement('span');
      t.className = 'tag blur'; t.textContent = '✨ Blur';
      tags.appendChild(t);
    }
    if (cs.outBubbleColor) {
      const t = document.createElement('span');
      t.className = 'tag out';
      t.style.cssText = `color:${cs.outBubbleColor};border-color:${cs.outBubbleColor};background:${hexToRgba(cs.outBubbleColor,0.15)};`;
      t.textContent = `↑ ${Math.round(cs.outBubbleOpacity ?? 100)}%${cs.blurOutBubble ? ' blur' : ''}`;
      tags.appendChild(t);
    }
    if (cs.inBubbleColor) {
      const t = document.createElement('span');
      t.className = 'tag in';
      t.style.cssText = `color:${cs.inBubbleColor};border-color:${cs.inBubbleColor};background:${hexToRgba(cs.inBubbleColor,0.15)};`;
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
    v.src=wp.data; v.autoplay=true; v.loop=true; v.muted=true;
    v.style.cssText='width:100%;height:100%;object-fit:cover;'; el.appendChild(v);
  } else {
    const img = document.createElement('img');
    img.src=wp.data; img.style.cssText='width:100%;height:100%;object-fit:cover;'; el.appendChild(img);
  }
}
function clearPreview(previewId, placeholderId, text) {
  g(previewId).innerHTML = `<span id="${placeholderId}">${text}</span>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function g(id)      { return document.getElementById(id); }
function getVal(id) { return g(id).value; }
function val(id, v) { if (g(id)) g(id).value = v; }
function chk(id, v) { if (g(id)) g(id).checked = v; }
function rng(id, v, labelId, suffix) {
  val(id, v);
  if (labelId && g(labelId)) g(labelId).textContent = v;
}
function liveRange(rangeId, labelId) {
  const el = g(rangeId); if (!el) return;
  el.addEventListener('input', e => { if (g(labelId)) g(labelId).textContent = e.target.value; });
}
function readFile(file, cb) {
  const r = new FileReader(); r.onload = e => cb(e.target.result); r.readAsDataURL(file);
}
function hexToRgba(hex, a) {
  hex = hex.replace('#','');
  if (hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  const r=parseInt(hex.slice(0,2),16),gg=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  return `rgba(${r},${gg},${b},${a})`;
}
