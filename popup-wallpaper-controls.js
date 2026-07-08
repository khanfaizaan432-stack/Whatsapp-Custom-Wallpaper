// =============================================================================
// WhatsApp Themes — popup-wallpaper-controls.js v1.9.0
// Wallpaper controls plus loader for the theme-library/storage cleanup layer.
// =============================================================================
(() => {
  'use strict';

  const PANEL_ID = 'wa-wallpaper-controls-panel';
  const STORAGE_KEY = 'globalSettings';

  const DEFAULT_CONTROLS = Object.freeze({
    fit: 'cover',
    position: 'center center',
    zoom: 100,
    dim: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });

  function byId(id) { return document.getElementById(id); }
  function qs(selector, root = document) { return root.querySelector(selector); }

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeControls(controls = {}) {
    const fit = ['cover', 'contain', 'stretch'].includes(controls.fit) ? controls.fit : DEFAULT_CONTROLS.fit;
    const position = [
      'center center', 'top center', 'bottom center', 'center left', 'center right',
      'top left', 'top right', 'bottom left', 'bottom right'
    ].includes(controls.position) ? controls.position : DEFAULT_CONTROLS.position;
    return {
      fit,
      position,
      zoom: clamp(controls.zoom, 50, 200, DEFAULT_CONTROLS.zoom),
      dim: clamp(controls.dim, 0, 90, DEFAULT_CONTROLS.dim),
      brightness: clamp(controls.brightness, 30, 170, DEFAULT_CONTROLS.brightness),
      contrast: clamp(controls.contrast, 30, 180, DEFAULT_CONTROLS.contrast),
      saturation: clamp(controls.saturation, 0, 220, DEFAULT_CONTROLS.saturation),
    };
  }

  async function getGlobalSettings() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data.globalSettings || {};
  }

  async function saveControls(controls) {
    const globalSettings = await getGlobalSettings();
    await chrome.storage.local.set({
      globalSettings: {
        ...globalSettings,
        wallpaperControls: normalizeControls(controls),
        __repairTick: Date.now(),
        __repairReason: 'wallpaper-controls-updated',
      }
    });
  }

  function setLabel(id, value, suffix = '') {
    const el = byId(id);
    if (el) el.textContent = `${value}${suffix}`;
  }

  function readControlsFromDom() {
    return normalizeControls({
      fit: byId('waWallpaperFit')?.value,
      position: byId('waWallpaperPosition')?.value,
      zoom: byId('waWallpaperZoom')?.value,
      dim: byId('waWallpaperDim')?.value,
      brightness: byId('waWallpaperBrightness')?.value,
      contrast: byId('waWallpaperContrast')?.value,
      saturation: byId('waWallpaperSaturation')?.value,
    });
  }

  function writeControlsToDom(controls) {
    const c = normalizeControls(controls);
    if (byId('waWallpaperFit')) byId('waWallpaperFit').value = c.fit;
    if (byId('waWallpaperPosition')) byId('waWallpaperPosition').value = c.position;
    if (byId('waWallpaperZoom')) byId('waWallpaperZoom').value = c.zoom;
    if (byId('waWallpaperDim')) byId('waWallpaperDim').value = c.dim;
    if (byId('waWallpaperBrightness')) byId('waWallpaperBrightness').value = c.brightness;
    if (byId('waWallpaperContrast')) byId('waWallpaperContrast').value = c.contrast;
    if (byId('waWallpaperSaturation')) byId('waWallpaperSaturation').value = c.saturation;
    updateLabels();
    updatePreviewSwatch(c);
  }

  function updateLabels() {
    const c = readControlsFromDom();
    setLabel('waWallpaperZoomVal', c.zoom, '%');
    setLabel('waWallpaperDimVal', c.dim, '%');
    setLabel('waWallpaperBrightnessVal', c.brightness, '%');
    setLabel('waWallpaperContrastVal', c.contrast, '%');
    setLabel('waWallpaperSaturationVal', c.saturation, '%');
  }

  function updatePreviewSwatch(controls = readControlsFromDom()) {
    const swatch = byId('waWallpaperControlsPreview');
    if (!swatch) return;
    swatch.style.setProperty('--wa-preview-dim', `${controls.dim / 100}`);
    swatch.style.filter = `brightness(${controls.brightness}%) contrast(${controls.contrast}%) saturate(${controls.saturation}%)`;
    swatch.dataset.fit = controls.fit;
    swatch.dataset.position = controls.position;
    swatch.dataset.zoom = String(controls.zoom);
  }

  async function applyControls({ announce = true } = {}) {
    const controls = readControlsFromDom();
    await saveControls(controls);
    updatePreviewSwatch(controls);
    byId('waWallpaperControlsState')?.replaceChildren(document.createTextNode(announce ? 'Saved' : 'Loaded'));

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs?.[0];
      if (!tab?.id || !tab.url?.startsWith('https://web.whatsapp.com/')) return;
      chrome.tabs.sendMessage(tab.id, { type: 'FORCE_WA_THEME_WALLPAPER' }, () => void chrome.runtime.lastError);
      chrome.tabs.sendMessage(tab.id, { type: 'APPLY_WA_WALLPAPER_CONTROLS' }, () => void chrome.runtime.lastError);
    });
  }

  async function resetControls() {
    writeControlsToDom(DEFAULT_CONTROLS);
    await applyControls({ announce: true });
  }

  function injectStyles() {
    if (byId('wa-wallpaper-controls-styles')) return;
    const style = document.createElement('style');
    style.id = 'wa-wallpaper-controls-styles';
    style.textContent = `
      #${PANEL_ID} { margin:10px; border:1px solid rgba(0,168,132,.2); border-radius:14px; background:rgba(17,27,33,.82); box-shadow:0 14px 34px rgba(0,0,0,.22); overflow:hidden; }
      .wa-wallpaper-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:11px 12px 8px; }
      .wa-wallpaper-title { color:#d1f5ea; font-size:12px; font-weight:850; letter-spacing:.35px; text-transform:uppercase; }
      #waWallpaperControlsState { color:#b7f7d2; border:1px solid rgba(0,168,132,.35); border-radius:999px; background:rgba(0,168,132,.08); font-size:10px; font-weight:750; padding:4px 7px; }
      .wa-wallpaper-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:0 12px 10px; }
      .wa-wallpaper-field { display:flex; flex-direction:column; gap:4px; min-width:0; }
      .wa-wallpaper-field label { color:#8696a0; font-size:10.5px; font-weight:700; }
      .wa-wallpaper-field select, .wa-wallpaper-field input[type="range"] { width:100%; }
      .wa-wallpaper-field select { background:#1f2c33; color:#e9edef; border:1px solid #2a3942; border-radius:9px; padding:7px 8px; font-size:11px; }
      .wa-wallpaper-val { color:#d1d7db; font-size:10.5px; text-align:right; }
      .wa-wallpaper-actions { display:flex; flex-wrap:wrap; gap:6px; padding:0 12px 12px; }
      .wa-wallpaper-btn { border:1px solid #2a3942; border-radius:9px; background:#1f2c33; color:#e9edef; font-size:11px; font-weight:800; padding:7px 9px; cursor:pointer; }
      .wa-wallpaper-btn.primary { background:#00a884; border-color:#00a884; color:#fff; }
      .wa-wallpaper-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
      #waWallpaperControlsPreview { position:relative; height:64px; margin:0 12px 10px; border-radius:12px; border:1px solid rgba(134,150,160,.15); background:radial-gradient(circle at 20% 20%, rgba(0,168,132,.75), transparent 30%), radial-gradient(circle at 80% 10%, rgba(109,93,252,.65), transparent 28%), linear-gradient(135deg, #0b141a, #1f2c33); overflow:hidden; }
      #waWallpaperControlsPreview::after { content:""; position:absolute; inset:0; background:rgba(0,0,0,var(--wa-preview-dim,0)); }
      #waWallpaperControlsPreview::before { content: attr(data-fit) " / " attr(data-position) " / " attr(data-zoom) "%"; position:absolute; left:8px; bottom:7px; z-index:2; color:#e9edef; font-size:10px; font-weight:800; text-shadow:0 1px 8px rgba(0,0,0,.65); }
    `;
    document.head.appendChild(style);
  }

  function buildPanel() {
    if (byId(PANEL_ID)) return;
    const wallpaperSection = byId('global-wp-preview')?.closest('section') || qs('#tab-theme section');
    if (!wallpaperSection) return;
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="wa-wallpaper-head"><div><div class="wa-wallpaper-title">Wallpaper Controls</div><div style="font-size:10.5px;color:#8696a0;margin-top:2px;">Crop, position, zoom, dim, and filters for the chat wallpaper.</div></div><div id="waWallpaperControlsState">Ready</div></div>
      <div id="waWallpaperControlsPreview" data-fit="cover" data-position="center" data-zoom="100"></div>
      <div class="wa-wallpaper-grid">
        <div class="wa-wallpaper-field"><label for="waWallpaperFit">Fit</label><select id="waWallpaperFit"><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option></select></div>
        <div class="wa-wallpaper-field"><label for="waWallpaperPosition">Position</label><select id="waWallpaperPosition"><option value="center center">Center</option><option value="top center">Top</option><option value="bottom center">Bottom</option><option value="center left">Left</option><option value="center right">Right</option><option value="top left">Top left</option><option value="top right">Top right</option><option value="bottom left">Bottom left</option><option value="bottom right">Bottom right</option></select></div>
        <div class="wa-wallpaper-field"><label>Zoom <span class="wa-wallpaper-val" id="waWallpaperZoomVal">100%</span></label><input id="waWallpaperZoom" type="range" min="50" max="200" value="100"></div>
        <div class="wa-wallpaper-field"><label>Dim <span class="wa-wallpaper-val" id="waWallpaperDimVal">0%</span></label><input id="waWallpaperDim" type="range" min="0" max="90" value="0"></div>
        <div class="wa-wallpaper-field"><label>Brightness <span class="wa-wallpaper-val" id="waWallpaperBrightnessVal">100%</span></label><input id="waWallpaperBrightness" type="range" min="30" max="170" value="100"></div>
        <div class="wa-wallpaper-field"><label>Contrast <span class="wa-wallpaper-val" id="waWallpaperContrastVal">100%</span></label><input id="waWallpaperContrast" type="range" min="30" max="180" value="100"></div>
        <div class="wa-wallpaper-field"><label>Saturation <span class="wa-wallpaper-val" id="waWallpaperSaturationVal">100%</span></label><input id="waWallpaperSaturation" type="range" min="0" max="220" value="100"></div>
      </div>
      <div class="wa-wallpaper-actions"><button type="button" class="wa-wallpaper-btn primary" id="waWallpaperSaveControls">Apply wallpaper controls</button><button type="button" class="wa-wallpaper-btn" id="waWallpaperResetControls">Reset controls</button></div>
    `;
    wallpaperSection.insertAdjacentElement('afterend', panel);
  }

  function wireEvents() {
    const ids = ['waWallpaperFit', 'waWallpaperPosition', 'waWallpaperZoom', 'waWallpaperDim', 'waWallpaperBrightness', 'waWallpaperContrast', 'waWallpaperSaturation'];
    for (const id of ids) {
      const control = byId(id);
      if (!control) continue;
      const update = () => { updateLabels(); updatePreviewSwatch(); byId('waWallpaperControlsState')?.replaceChildren(document.createTextNode('Unsaved')); };
      control.addEventListener('input', update);
      control.addEventListener('change', update);
    }
    byId('waWallpaperSaveControls')?.addEventListener('click', () => applyControls().catch(error => byId('waWallpaperControlsState')?.replaceChildren(document.createTextNode(`Error: ${error.message}`))));
    byId('waWallpaperResetControls')?.addEventListener('click', () => resetControls().catch(error => byId('waWallpaperControlsState')?.replaceChildren(document.createTextNode(`Error: ${error.message}`))));
  }

  function loadThemeLibrary() {
    if (document.querySelector('script[data-wa-popup-theme-library="1"]')) return;
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('popup-theme-library.js');
    script.dataset.waPopupThemeLibrary = '1';
    document.head.appendChild(script);
  }

  async function loadInitialControls() {
    const globalSettings = await getGlobalSettings();
    writeControlsToDom(globalSettings.wallpaperControls || DEFAULT_CONTROLS);
  }

  async function init() {
    injectStyles();
    buildPanel();
    wireEvents();
    await loadInitialControls();
    loadThemeLibrary();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
