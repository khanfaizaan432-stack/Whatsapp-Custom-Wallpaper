// =============================================================================
// WhatsApp Themes — popup-patch.js v1.6.0
// Popup hardening + product polish loaded after popup.js.
//
// v1.6.0 is the first modular-refactor slice: defaults, limits, labels, and
// presets now live in shared/*.js and are consumed here through WAThemeShared.
// =============================================================================
(() => {
  'use strict';

  const STATUS_ID = 'wa-popup-health-status';
  const POLISH_ID = 'wa-polish-panel';
  const SHARED_SCRIPT_PATHS = ['shared/theme-defaults.js', 'shared/theme-presets.js'];

  const fallbackShared = Object.freeze({
    limits: Object.freeze({
      imageMaxMb: 8,
      videoMaxMb: 200,
      heavyStorageWarningMb: 300,
      ranges: Object.freeze({
        outBubbleOpacity: [0, 100, 100], inBubbleOpacity: [0, 100, 100], blurIntensity: [2, 30, 8],
        fontSize: [10, 22, 14], convHeaderOpacity: [0, 100, 100], convHeaderBlur: [0, 30, 0],
        chatlistHeaderOpacity: [0, 100, 100], chatlistHeaderBlur: [0, 30, 0],
        sidebarTintOpacity: [0, 100, 0], sidebarBlurIntensity: [2, 30, 8],
        chatCardOpacity: [0, 100, 100], chatCardBlurIntensity: [2, 20, 4],
        navStripOpacity: [0, 100, 100], navStripBlur: [0, 30, 0],
      }),
    }),
    rangeLabels: Object.freeze([
      ['outBubbleOpacity', 'outOpacityVal'], ['inBubbleOpacity', 'inOpacityVal'], ['blurIntensity', 'blurVal'],
      ['sidebarTintOpacity', 'sidebarTintVal'], ['sidebarBlurIntensity', 'sidebarBlurVal'],
      ['chatCardOpacity', 'chatCardOpacityVal'], ['chatCardBlurIntensity', 'chatCardBlurIntensityVal'],
      ['navStripOpacity', 'navStripOpacityVal'], ['navStripBlur', 'navStripBlurVal'], ['fontSize', 'fontSizeVal'],
      ['convHeaderOpacity', 'convHeaderOpacityVal'], ['convHeaderBlur', 'convHeaderBlurVal'],
      ['chatlistHeaderOpacity', 'chatlistHeaderOpacityVal'], ['chatlistHeaderBlur', 'chatlistHeaderBlurVal'],
    ]),
    presets: Object.freeze([
      Object.freeze({ name: 'AMOLED', tag: 'Pure dark', values: Object.freeze({ outBubbleColor: '#075e54', inBubbleColor: '#111111', headerColor: '#050505', sidebarColor: '#050505', sidebarTintColor: '#000000', sidebarTintOpacity: 0, navStripColor: '#050505', chatlistHeaderColor: '#050505', chatCardBgColor: '#101010', outBubbleOpacity: 96, inBubbleOpacity: 92, convHeaderOpacity: 94, chatlistHeaderOpacity: 92, navStripOpacity: 94, chatCardOpacity: 86, fontSize: 14 }) }),
      Object.freeze({ name: 'Glass Blur', tag: 'Wallpaper first', values: Object.freeze({ outBubbleColor: '#128c7e', inBubbleColor: '#1f2c33', headerColor: '#1f2c33', sidebarTintColor: '#111b21', sidebarTintOpacity: 22, sidebarColor: '#111b21', navStripColor: '#1f2c33', chatlistHeaderColor: '#1f2c33', chatCardBgColor: '#1f2c33', outBubbleOpacity: 74, inBubbleOpacity: 70, convHeaderOpacity: 72, convHeaderBlur: 14, chatlistHeaderOpacity: 68, chatlistHeaderBlur: 14, navStripOpacity: 64, navStripBlur: 12, chatCardOpacity: 58, chatCardBlurIntensity: 10, blurIntensity: 12, sidebarBlurIntensity: 14 }), checks: Object.freeze({ blurOutBubble: true, blurInBubble: true, blurSidebar: true, chatCardBlur: true }) }),
      Object.freeze({ name: 'Neon Green', tag: 'Cyber WA', values: Object.freeze({ outBubbleColor: '#00a884', inBubbleColor: '#172027', headerColor: '#06261f', sidebarColor: '#061b18', sidebarTintColor: '#00a884', sidebarTintOpacity: 10, navStripColor: '#061b18', chatlistHeaderColor: '#06261f', chatCardBgColor: '#09241f', outBubbleOpacity: 100, inBubbleOpacity: 90, convHeaderOpacity: 96, chatlistHeaderOpacity: 96, navStripOpacity: 100, chatCardOpacity: 88, fontSize: 14 }) }),
    ]),
  });

  let shared = fallbackShared;

  function byId(id) { return document.getElementById(id); }
  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

  function scriptUrl(path) {
    return chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : path;
  }

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-wa-shared-script="${path}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = scriptUrl(path);
      script.dataset.waSharedScript = path;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${path}`));
      document.head.appendChild(script);
    });
  }

  async function loadSharedModules() {
    try {
      for (const path of SHARED_SCRIPT_PATHS) await loadScript(path);
      shared = { ...fallbackShared, ...(window.WAThemeShared || {}) };
    } catch (err) {
      console.warn('[WA Themes popup-patch] Using fallback shared constants:', err);
      shared = fallbackShared;
    }
  }

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
  }

  function ensureStatusBox() {
    let box = byId(STATUS_ID);
    if (box) return box;
    box = document.createElement('div');
    box.id = STATUS_ID;
    box.style.cssText = [
      'margin:8px 12px 0', 'padding:8px 10px', 'border-radius:8px',
      'background:#172027', 'border:1px solid #2a3942', 'color:#8696a0',
      'font-size:11px', 'line-height:1.35', 'display:none'
    ].join(';');
    qs('.wa-header')?.insertAdjacentElement('afterend', box);
    return box;
  }

  function showStatus(message, type = 'info') {
    const box = ensureStatusBox();
    box.textContent = message;
    box.style.display = 'block';
    box.style.color = type === 'error' ? '#ffb4c2' : type === 'ok' ? '#b7f7d2' : '#d1d7db';
    box.style.borderColor = type === 'error' ? '#ea0038' : type === 'ok' ? '#00a884' : '#2a3942';
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => { box.style.display = 'none'; }, type === 'error' ? 4200 : 2600);
  }

  function injectPolishStyles() {
    if (byId('wa-popup-polish-styles')) return;
    const style = document.createElement('style');
    style.id = 'wa-popup-polish-styles';
    style.textContent = `
      body { background: radial-gradient(circle at top left, #20343d 0, #111b21 42%, #081116 100%) !important; }
      .wa-header { position: sticky; top: 0; z-index: 10; backdrop-filter: blur(14px); box-shadow: 0 8px 28px rgba(0,0,0,.24); }
      section { border: 1px solid rgba(134,150,160,.14); border-radius: 14px; margin: 10px 10px 12px; background: rgba(31,44,51,.72); box-shadow: 0 12px 30px rgba(0,0,0,.18); overflow: hidden; }
      .row { transition: background .18s ease, transform .18s ease; }
      .row:hover { background: rgba(255,255,255,.025); }
      .upload-btn, .apply-btn, .reset-all-btn, .tab { transition: transform .16s ease, box-shadow .16s ease, filter .16s ease; }
      .upload-btn:hover, .apply-btn:hover, .reset-all-btn:hover, .tab:hover { transform: translateY(-1px); filter: brightness(1.08); }
      #${POLISH_ID} { margin: 10px; border: 1px solid rgba(0,168,132,.24); border-radius: 16px; background: linear-gradient(135deg, rgba(0,168,132,.13), rgba(31,44,51,.86)); box-shadow: 0 16px 42px rgba(0,0,0,.28); overflow: hidden; }
      .wa-polish-top { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 12px 8px; }
      .wa-polish-title { font-size:12px; font-weight:800; letter-spacing:.45px; text-transform:uppercase; color:#d1f5ea; }
      .wa-polish-badge { font-size:10px; color:#b7f7d2; border:1px solid rgba(0,168,132,.35); border-radius:999px; padding:4px 7px; background:rgba(0,168,132,.1); }
      .wa-polish-actions { display:flex; gap:6px; padding:0 12px 12px; flex-wrap:wrap; }
      .wa-mini-btn { border:1px solid #2a3942; border-radius:9px; background:#1f2c33; color:#e9edef; font-size:11px; font-weight:700; padding:7px 9px; cursor:pointer; }
      .wa-mini-btn.primary { background:#00a884; border-color:#00a884; color:#fff; }
      .wa-mini-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
      .wa-preset-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; padding:0 12px 12px; }
      .wa-preset { text-align:left; border:1px solid rgba(134,150,160,.16); border-radius:12px; background:rgba(17,27,33,.78); padding:9px; cursor:pointer; color:#e9edef; }
      .wa-preset strong { display:block; font-size:12px; margin-bottom:2px; }
      .wa-preset span { font-size:10px; color:#8696a0; }
      .wa-preview { margin:0 12px 12px; border-radius:14px; padding:12px; background:linear-gradient(145deg,#0b141a,#111b21); border:1px solid rgba(134,150,160,.15); }
      .wa-preview-header { height:28px; border-radius:9px; margin-bottom:10px; background:#202c33; }
      .wa-preview-msg { max-width:78%; padding:8px 10px; border-radius:12px; margin:6px 0; font-size:12px; line-height:1.3; box-shadow:0 4px 14px rgba(0,0,0,.16); }
      .wa-preview-in { background:#242626; color:#e9edef; }
      .wa-preview-out { background:#144d37; color:#e9edef; margin-left:auto; }
      .wa-unsaved-dot { width:8px; height:8px; border-radius:999px; display:inline-block; background:#f0ad00; margin-right:5px; vertical-align:middle; }
    `;
    document.head.appendChild(style);
  }

  function clampRangeControl(id, min, max, fallback) {
    const input = byId(id);
    if (!input) return;
    const apply = () => {
      const raw = Number(input.value);
      const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
      if (String(value) !== String(input.value)) input.value = value;
    };
    input.addEventListener('input', apply);
    input.addEventListener('change', apply);
    apply();
  }

  function wireRangeLabels() {
    for (const [inputId, labelId] of shared.rangeLabels || fallbackShared.rangeLabels) {
      const input = byId(inputId);
      if (!input) continue;
      const update = () => setText(labelId, input.value);
      input.addEventListener('input', update);
      input.addEventListener('change', update);
      update();
    }
  }

  function validateFileInput(inputId, type) {
    const input = byId(inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const isImage = type === 'image';
      const maxMb = isImage ? shared.limits.imageMaxMb : shared.limits.videoMaxMb;
      const okMime = isImage ? file.type.startsWith('image/') : file.type.startsWith('video/');
      if (!okMime) {
        input.value = '';
        showStatus(`Unsupported ${type} file type.`, 'error');
        return;
      }
      if (file.size > maxMb * 1024 * 1024) {
        input.value = '';
        showStatus(`${isImage ? 'Image' : 'Video'} is too large. Limit: ${maxMb} MB.`, 'error');
        return;
      }
      showStatus(`${file.name} selected. Click Apply Changes to save.`, 'ok');
    }, true);
  }

  function buildPolishPanel() {
    if (byId(POLISH_ID)) return;
    const tab = byId('tab-theme');
    if (!tab) return;

    const panel = document.createElement('section');
    panel.id = POLISH_ID;
    panel.innerHTML = `
      <div class="wa-polish-top">
        <div>
          <div class="wa-polish-title">Quick polish</div>
          <div style="font-size:11px;color:#8696a0;margin-top:2px;">Presets, live preview, maintenance, and save status.</div>
        </div>
        <div class="wa-polish-badge" id="waDirtyBadge">Ready</div>
      </div>
      <div class="wa-polish-actions">
        <button type="button" class="wa-mini-btn primary" id="waOpenOptionsBtn">Maintenance</button>
        <button type="button" class="wa-mini-btn" id="waOpenWebBtn">Open WhatsApp Web</button>
        <button type="button" class="wa-mini-btn" id="waCopyDebugBtn">Copy debug</button>
      </div>
      <div class="wa-preset-grid" id="waPresetGrid"></div>
      <div class="wa-preview" aria-label="Theme preview">
        <div class="wa-preview-header" id="waPreviewHeader"></div>
        <div class="wa-preview-msg wa-preview-in" id="waPreviewIn">Hey, this is the incoming bubble preview.</div>
        <div class="wa-preview-msg wa-preview-out" id="waPreviewOut">And this is your outgoing bubble.</div>
      </div>
    `;
    tab.insertAdjacentElement('afterbegin', panel);

    const grid = byId('waPresetGrid');
    for (const preset of shared.presets || fallbackShared.presets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wa-preset';
      button.innerHTML = `<strong>${preset.name}</strong><span>${preset.tag}</span>`;
      button.addEventListener('click', () => applyPreset(preset));
      grid.appendChild(button);
    }

    byId('waOpenOptionsBtn')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
    byId('waOpenWebBtn')?.addEventListener('click', () => window.open('https://web.whatsapp.com/', '_blank', 'noopener'));
    byId('waCopyDebugBtn')?.addEventListener('click', copyDebugSummary);
  }

  function setControl(id, value) {
    const input = byId(id);
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setCheck(id, value) {
    const input = byId(id);
    if (!input) return;
    input.checked = Boolean(value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyPreset(preset) {
    for (const [id, value] of Object.entries(preset.values || {})) setControl(id, value);
    for (const [id, value] of Object.entries(preset.checks || {})) setCheck(id, value);
    markDirty(`${preset.name} preset loaded. Click Apply Changes to save.`, true);
    updatePreview();
  }

  function getAlpha(id, fallback = 100) {
    const value = Number(byId(id)?.value ?? fallback);
    return Math.max(0, Math.min(1, (Number.isFinite(value) ? value : fallback) / 100));
  }

  function hexToRgba(hex, alpha) {
    let clean = String(hex || '#000000').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(clean)) clean = '000000';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function updatePreview() {
    const previewOut = byId('waPreviewOut');
    const previewIn = byId('waPreviewIn');
    const previewHeader = byId('waPreviewHeader');
    if (previewOut) {
      previewOut.style.background = hexToRgba(byId('outBubbleColor')?.value, getAlpha('outBubbleOpacity'));
      previewOut.style.fontSize = `${byId('fontSize')?.value || 14}px`;
      previewOut.style.backdropFilter = byId('blurOutBubble')?.checked ? `blur(${byId('blurIntensity')?.value || 8}px)` : '';
    }
    if (previewIn) {
      previewIn.style.background = hexToRgba(byId('inBubbleColor')?.value, getAlpha('inBubbleOpacity'));
      previewIn.style.fontSize = `${byId('fontSize')?.value || 14}px`;
      previewIn.style.backdropFilter = byId('blurInBubble')?.checked ? `blur(${byId('blurIntensity')?.value || 8}px)` : '';
    }
    if (previewHeader) {
      previewHeader.style.background = hexToRgba(byId('headerColor')?.value, getAlpha('convHeaderOpacity'));
      previewHeader.style.backdropFilter = Number(byId('convHeaderBlur')?.value || 0) > 0 ? `blur(${byId('convHeaderBlur').value}px)` : '';
    }
  }

  function markDirty(message = 'Unsaved changes', subtle = false) {
    const badge = byId('waDirtyBadge');
    if (badge) badge.innerHTML = subtle ? '<span class="wa-unsaved-dot"></span>Unsaved' : message;
    if (!subtle) showStatus(message, 'info');
  }

  function wireDirtyTracking() {
    for (const control of qsa('input, select')) {
      control.addEventListener('input', () => { markDirty('Unsaved changes', true); updatePreview(); });
      control.addEventListener('change', () => { markDirty('Unsaved changes', true); updatePreview(); });
    }
  }

  function wireApplyFeedback() {
    const btn = byId('applyBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const original = btn.textContent;
      btn.textContent = 'Saving…';
      setTimeout(() => {
        btn.textContent = 'Saved ✓';
        const badge = byId('waDirtyBadge');
        if (badge) badge.textContent = 'Saved';
        showStatus('Settings saved. Refresh WhatsApp Web if you do not see changes.', 'ok');
        setTimeout(() => { btn.textContent = original || 'Apply Changes'; }, 1200);
      }, 180);
    });
  }

  async function wireStorageWarning() {
    try {
      const bytes = await chrome.storage.local.getBytesInUse(null);
      const mb = bytes / (1024 * 1024);
      if (mb > shared.limits.heavyStorageWarningMb) {
        showStatus(`Extension storage is using about ${mb.toFixed(0)} MB. Open Maintenance to clean video wallpapers.`, 'error');
      }
    } catch (_) {}
  }

  async function copyDebugSummary() {
    try {
      const bytes = await chrome.storage.local.getBytesInUse(null);
      const data = await chrome.storage.local.get(['globalSettings', 'chatWallpapers']);
      const summary = {
        version: chrome.runtime.getManifest().version,
        sharedModulesLoaded: Boolean(window.WAThemeShared?.presets),
        presetCount: (shared.presets || []).length,
        storageMB: Number((bytes / (1024 * 1024)).toFixed(2)),
        chats: Object.keys(data.chatWallpapers || {}).length,
        enabled: data.globalSettings?.enabled !== false,
        globalWallpaper: data.globalSettings?.globalWallpaper?.type || null,
        sidebarWallpaper: data.globalSettings?.sidebarWallpaper?.type || null,
      };
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      showStatus('Debug summary copied.', 'ok');
    } catch (err) {
      showStatus(`Could not copy debug summary: ${err.message}`, 'error');
    }
  }

  function wireRangeClamping() {
    const ranges = shared.limits?.ranges || fallbackShared.limits.ranges;
    for (const [id, [min, max, fallback]] of Object.entries(ranges)) clampRangeControl(id, min, max, fallback);
  }

  async function init() {
    await loadSharedModules();
    injectPolishStyles();
    buildPolishPanel();
    wireRangeLabels();
    wireRangeClamping();
    validateFileInput('wa-global-file-img', 'image');
    validateFileInput('wa-sidebar-file-img', 'image');
    validateFileInput('wa-global-file-vid', 'video');
    validateFileInput('wa-sidebar-file-vid', 'video');
    wireApplyFeedback();
    wireDirtyTracking();
    wireStorageWarning();
    updatePreview();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
