// =============================================================================
// WhatsApp Themes — popup-theme-library.js v1.9.0
// User theme library, storage cleanup, and richer preset-card styling.
// =============================================================================
(() => {
  'use strict';

  const SCRIPT_ID = 'wa-theme-library-script';
  const PANEL_ID = 'wa-theme-library-panel';
  const LIBRARY_KEY = 'waUserThemeLibrary';
  const VIDEO_DB_NAME = 'wa-themes-videos';
  const VIDEO_STORE_NAME = 'videos';

  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  const THEME_FIELDS = [
    'enabled', 'outBubbleColor', 'inBubbleColor', 'outBubbleOpacity', 'inBubbleOpacity',
    'blurOutBubble', 'blurInBubble', 'blurIntensity', 'fontFamily', 'fontSize',
    'headerColor', 'convHeaderOpacity', 'convHeaderBlur', 'globalWpBlur',
    'sidebarTintColor', 'sidebarTintOpacity', 'blurSidebar', 'sidebarBlurIntensity', 'sidebarColor',
    'navStripColor', 'navStripOpacity', 'navStripBlur',
    'chatlistHeaderColor', 'chatlistHeaderOpacity', 'chatlistHeaderBlur',
    'chatCardBgColor', 'chatCardOpacity', 'chatCardBlur', 'chatCardBlurIntensity',
    'waWallpaperFit', 'waWallpaperPosition', 'waWallpaperZoom', 'waWallpaperDim',
    'waWallpaperBrightness', 'waWallpaperContrast', 'waWallpaperSaturation'
  ];

  function byId(id) { return document.getElementById(id); }
  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

  function setStatus(message, type = 'info') {
    const el = byId('waThemeLibraryStatus');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
  }

  function getControlValue(id) {
    const el = byId(id);
    if (!el) return undefined;
    if (el.type === 'checkbox') return Boolean(el.checked);
    return el.value;
  }

  function setControlValue(id, value) {
    const el = byId(id);
    if (!el || value === undefined) return;
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function captureTheme() {
    const values = {};
    for (const field of THEME_FIELDS) {
      const value = getControlValue(field);
      if (value !== undefined) values[field] = value;
    }
    return values;
  }

  function applyTheme(values = {}) {
    for (const [id, value] of Object.entries(values)) setControlValue(id, value);
  }

  async function getLibrary() {
    const data = await chrome.storage.local.get(LIBRARY_KEY);
    return Array.isArray(data[LIBRARY_KEY]) ? data[LIBRARY_KEY] : [];
  }

  async function setLibrary(themes) {
    await chrome.storage.local.set({ [LIBRARY_KEY]: themes.slice(0, 40) });
  }

  function swatchMarkup(values = {}) {
    const out = values.outBubbleColor || '#00a884';
    const inn = values.inBubbleColor || '#1f2c33';
    const header = values.headerColor || '#202c33';
    return `
      <div class="wa-theme-swatch" style="--out:${out};--in:${inn};--head:${header};">
        <span class="wa-theme-swatch-head"></span>
        <span class="wa-theme-swatch-in"></span>
        <span class="wa-theme-swatch-out"></span>
      </div>
    `;
  }

  async function renderLibrary() {
    const list = byId('waThemeLibraryList');
    if (!list) return;
    const themes = await getLibrary();
    if (!themes.length) {
      list.innerHTML = '<div class="wa-theme-empty">No saved custom themes yet.</div>';
      return;
    }
    list.innerHTML = themes.map(theme => `
      <div class="wa-theme-item" data-theme-id="${theme.id}">
        ${swatchMarkup(theme.values)}
        <div class="wa-theme-meta">
          <strong>${escapeHtml(theme.name)}</strong>
          <span>${new Date(theme.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>
        <button type="button" class="wa-theme-mini" data-action="apply">Apply</button>
        <button type="button" class="wa-theme-mini danger" data-action="delete">×</button>
      </div>
    `).join('');
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  async function saveCurrentTheme() {
    const name = window.prompt('Name this theme:', `My Theme ${new Date().toISOString().slice(0, 10)}`);
    if (!name) return;
    const themes = await getLibrary();
    const theme = { id: `theme-${Date.now()}`, name: name.trim(), createdAt: new Date().toISOString(), values: captureTheme() };
    await setLibrary([theme, ...themes]);
    await renderLibrary();
    setStatus(`Saved “${theme.name}”.`, 'ok');
  }

  async function exportLibrary() {
    const themes = await getLibrary();
    const blob = new Blob([JSON.stringify({ schema: 'wa-theme-library-v1', exportedAt: new Date().toISOString(), themes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wa-theme-library-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Theme library exported.', 'ok');
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async function importLibrary(file) {
    const parsed = JSON.parse(await readFile(file));
    const incoming = Array.isArray(parsed.themes) ? parsed.themes : [];
    const clean = incoming
      .filter(item => item && typeof item.name === 'string' && item.values && typeof item.values === 'object')
      .map(item => ({ id: item.id || `theme-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: item.name, createdAt: item.createdAt || new Date().toISOString(), values: item.values }));
    await setLibrary([...clean, ...(await getLibrary())]);
    await renderLibrary();
    setStatus(`Imported ${clean.length} theme(s).`, 'ok');
  }

  function openVideoDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(VIDEO_DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(VIDEO_STORE_NAME);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error || new Error('Failed to open video database'));
    });
  }

  function collectReferencedVideoKeys(globalSettings = {}, chatWallpapers = {}) {
    const keys = new Set();
    const add = value => { if (value) keys.add(value); };
    add(globalSettings.globalWallpaper?.storageKey || globalSettings.globalWallpaper?.idbKey);
    add(globalSettings.sidebarWallpaper?.storageKey || globalSettings.sidebarWallpaper?.idbKey);
    for (const chat of Object.values(chatWallpapers || {})) {
      add(chat?.wallpaperStorageKey || chat?.wallpaper?.storageKey || chat?.wallpaper?.idbKey);
    }
    return keys;
  }

  async function cleanupOrphanVideos() {
    const { globalSettings = {}, chatWallpapers = {} } = await chrome.storage.local.get(['globalSettings', 'chatWallpapers']);
    const referenced = collectReferencedVideoKeys(globalSettings, chatWallpapers);
    const db = await openVideoDB();
    const removed = await new Promise((resolve, reject) => {
      const tx = db.transaction(VIDEO_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VIDEO_STORE_NAME);
      const getKeys = store.getAllKeys();
      let count = 0;
      getKeys.onsuccess = () => {
        for (const key of getKeys.result || []) {
          if (!referenced.has(String(key))) {
            store.delete(key);
            count += 1;
          }
        }
      };
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error || new Error('Video cleanup failed'));
    });
    setStatus(`Removed ${removed} unused video blob(s).`, 'ok');
  }

  async function refreshStorageSummary() {
    const bytes = await chrome.storage.local.getBytesInUse(null).catch(() => null);
    const themes = await getLibrary();
    const text = bytes == null ? `${themes.length} saved theme(s)` : `${themes.length} saved theme(s) • ${(bytes / (1024 * 1024)).toFixed(2)} MB extension storage`;
    const el = byId('waThemeLibrarySummary');
    if (el) el.textContent = text;
  }

  function enhancePresetCards() {
    qsa('.wa-preset').forEach(button => {
      if (button.dataset.waPresetEnhanced === '1') return;
      button.dataset.waPresetEnhanced = '1';
      const name = button.querySelector('strong')?.textContent || button.textContent || 'Preset';
      const palette = presetPalette(name);
      button.style.setProperty('--preset-a', palette[0]);
      button.style.setProperty('--preset-b', palette[1]);
      button.style.setProperty('--preset-c', palette[2]);
      button.insertAdjacentHTML('afterbegin', '<span class="wa-preset-swatch"><i></i><b></b><em></em></span>');
    });
  }

  function presetPalette(name) {
    const n = name.toLowerCase();
    if (n.includes('sakura')) return ['#d95d8f', '#30242b', '#33202a'];
    if (n.includes('purple')) return ['#6d5dfc', '#29233a', '#201a31'];
    if (n.includes('neon')) return ['#00a884', '#172027', '#06261f'];
    if (n.includes('glass')) return ['#128c7e', '#1f2c33', '#20343d'];
    if (n.includes('amoled')) return ['#075e54', '#111111', '#050505'];
    return ['#3a4a54', '#242626', '#202c33'];
  }

  function injectStyles() {
    if (byId('wa-theme-library-styles')) return;
    const style = document.createElement('style');
    style.id = 'wa-theme-library-styles';
    style.textContent = `
      #${PANEL_ID} { margin:10px; border:1px solid rgba(0,168,132,.22); border-radius:14px; background:rgba(17,27,33,.84); box-shadow:0 14px 34px rgba(0,0,0,.22); overflow:hidden; }
      .wa-theme-library-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:11px 12px 8px; }
      .wa-theme-library-title { color:#d1f5ea; font-size:12px; font-weight:850; letter-spacing:.35px; text-transform:uppercase; }
      #waThemeLibraryStatus { color:#8696a0; border:1px solid rgba(134,150,160,.2); border-radius:999px; padding:4px 7px; font-size:10px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #waThemeLibraryStatus[data-type="ok"] { color:#b7f7d2; border-color:rgba(0,168,132,.42); }
      #waThemeLibrarySummary { color:#8696a0; font-size:10.5px; padding:0 12px 10px; }
      .wa-theme-actions { display:flex; flex-wrap:wrap; gap:6px; padding:0 12px 12px; }
      .wa-theme-btn, .wa-theme-mini { border:1px solid #2a3942; border-radius:9px; background:#1f2c33; color:#e9edef; font-size:11px; font-weight:800; padding:7px 9px; cursor:pointer; }
      .wa-theme-btn.primary { background:#00a884; border-color:#00a884; color:#fff; }
      .wa-theme-mini.danger { color:#ffb4c2; border-color:rgba(234,0,56,.45); }
      .wa-theme-list { display:grid; gap:8px; padding:0 12px 12px; }
      .wa-theme-empty { color:#8696a0; font-size:11px; padding:8px; border:1px dashed rgba(134,150,160,.2); border-radius:10px; }
      .wa-theme-item { display:grid; grid-template-columns:42px minmax(0,1fr) auto auto; gap:8px; align-items:center; padding:8px; border:1px solid rgba(134,150,160,.16); border-radius:12px; background:rgba(31,44,51,.62); }
      .wa-theme-meta strong { display:block; color:#e9edef; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wa-theme-meta span { color:#8696a0; font-size:10px; }
      .wa-theme-swatch { position:relative; height:32px; border-radius:9px; background:var(--head); overflow:hidden; border:1px solid rgba(255,255,255,.08); }
      .wa-theme-swatch-head { position:absolute; inset:0 0 auto 0; height:9px; background:var(--head); }
      .wa-theme-swatch-in, .wa-theme-swatch-out { position:absolute; height:8px; border-radius:999px; bottom:6px; }
      .wa-theme-swatch-in { left:5px; width:18px; background:var(--in); }
      .wa-theme-swatch-out { right:5px; width:20px; background:var(--out); }
      .wa-preset { position:relative; overflow:hidden; padding-left:54px !important; min-height:48px; }
      .wa-preset::after { content:""; position:absolute; inset:0; background:linear-gradient(135deg, color-mix(in srgb, var(--preset-a, #00a884) 18%, transparent), transparent 60%); pointer-events:none; }
      .wa-preset-swatch { position:absolute; left:9px; top:9px; width:34px; height:29px; border-radius:9px; background:var(--preset-c); border:1px solid rgba(255,255,255,.1); overflow:hidden; z-index:1; }
      .wa-preset-swatch i { position:absolute; inset:0 0 auto 0; height:8px; background:var(--preset-c); }
      .wa-preset-swatch b, .wa-preset-swatch em { position:absolute; bottom:5px; height:7px; border-radius:999px; }
      .wa-preset-swatch b { left:5px; width:13px; background:var(--preset-b); }
      .wa-preset-swatch em { right:5px; width:15px; background:var(--preset-a); }
    `;
    document.head.appendChild(style);
  }

  function buildPanel() {
    if (byId(PANEL_ID)) return;
    const target = byId('wa-wallpaper-controls-panel') || byId('wa-polish-panel') || qs('#tab-theme section');
    if (!target) return;
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="wa-theme-library-head">
        <div>
          <div class="wa-theme-library-title">Theme Library</div>
          <div style="font-size:10.5px;color:#8696a0;margin-top:2px;">Save, import/export, and clean local theme storage.</div>
        </div>
        <div id="waThemeLibraryStatus">Ready</div>
      </div>
      <div id="waThemeLibrarySummary">Checking storage…</div>
      <div class="wa-theme-actions">
        <button type="button" class="wa-theme-btn primary" id="waSaveThemeBtn">Save current</button>
        <button type="button" class="wa-theme-btn" id="waExportThemesBtn">Export</button>
        <label class="wa-theme-btn" for="waImportThemesFile">Import</label>
        <input id="waImportThemesFile" type="file" accept="application/json,.json" style="display:none">
        <button type="button" class="wa-theme-btn" id="waCleanVideosBtn">Clean unused videos</button>
      </div>
      <div class="wa-theme-list" id="waThemeLibraryList"></div>
    `;
    target.insertAdjacentElement('afterend', panel);
  }

  function wireEvents() {
    byId('waSaveThemeBtn')?.addEventListener('click', () => saveCurrentTheme().then(refreshStorageSummary).catch(error => setStatus(error.message, 'error')));
    byId('waExportThemesBtn')?.addEventListener('click', () => exportLibrary().catch(error => setStatus(error.message, 'error')));
    byId('waCleanVideosBtn')?.addEventListener('click', () => cleanupOrphanVideos().then(refreshStorageSummary).catch(error => setStatus(error.message, 'error')));
    byId('waImportThemesFile')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      importLibrary(file).then(refreshStorageSummary).catch(error => setStatus(error.message, 'error')).finally(() => { event.target.value = ''; });
    });
    byId('waThemeLibraryList')?.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      const item = event.target.closest('.wa-theme-item');
      if (!button || !item) return;
      const id = item.dataset.themeId;
      if (button.dataset.action === 'apply') applySavedTheme(id).catch(error => setStatus(error.message, 'error'));
      if (button.dataset.action === 'delete') deleteTheme(id).then(refreshStorageSummary).catch(error => setStatus(error.message, 'error'));
    });
  }

  async function applySavedTheme(id) {
    const theme = (await getLibrary()).find(item => item.id === id);
    if (!theme) return;
    applyTheme(theme.values);
    setStatus(`Loaded “${theme.name}”. Click Apply.`, 'ok');
  }

  async function deleteTheme(id) {
    const themes = await getLibrary();
    const theme = themes.find(item => item.id === id);
    if (!theme) return;
    if (!window.confirm(`Delete “${theme.name}”?`)) return;
    await setLibrary(themes.filter(item => item.id !== id));
    await renderLibrary();
    setStatus('Theme deleted.', 'ok');
  }

  function observePresetCards() {
    enhancePresetCards();
    const target = byId('tab-theme') || document.body;
    if (!target) return;
    new MutationObserver(enhancePresetCards).observe(target, { childList: true, subtree: true });
  }

  async function init() {
    injectStyles();
    buildPanel();
    wireEvents();
    observePresetCards();
    await renderLibrary();
    await refreshStorageSummary();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
