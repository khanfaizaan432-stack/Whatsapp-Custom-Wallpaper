// =============================================================================
// WhatsApp Themes — content-wallpaper-controls.js v1.8.0
// Applies wallpaper fit, position, zoom, dim, and filters to forced overlay.
// =============================================================================
(() => {
  'use strict';

  const SCRIPT_ID = 'wa-theme-content-wallpaper-controls';
  const OVERLAY_ID = 'wa-theme-force-bg-overlay';
  const DIM_ID = 'wa-theme-wallpaper-dim-layer';

  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  const DEFAULT_CONTROLS = Object.freeze({
    fit: 'cover',
    position: 'center center',
    zoom: 100,
    dim: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });

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

  function getCurrentChatName() {
    const selectors = [
      '[data-testid="conversation-info-header-chat-title"]',
      'header span[title]',
      '#main header span[dir="auto"][title]',
      '#main header span[dir="ltr"][title]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const raw = el?.getAttribute('title') || el?.textContent || '';
      const text = raw.trim();
      if (text) return text;
    }
    return null;
  }

  async function getSettings() {
    return chrome.storage.local.get(['globalSettings', 'chatWallpapers']);
  }

  function resolveActiveBlur(globalSettings, chatWallpapers) {
    const chatName = getCurrentChatName();
    const perChat = chatName ? chatWallpapers?.[chatName] : null;
    if (perChat?.wallpaperType) return Boolean(perChat.wallpaperBlur);
    return Boolean(globalSettings?.globalWallpaper?.blur);
  }

  function fitToObjectFit(fit) {
    if (fit === 'contain') return 'contain';
    if (fit === 'stretch') return 'fill';
    return 'cover';
  }

  function fitToBackgroundSize(fit) {
    if (fit === 'contain') return 'contain';
    if (fit === 'stretch') return '100% 100%';
    return 'cover';
  }

  function ensureDimLayer(overlay) {
    let dim = document.getElementById(DIM_ID);
    if (!dim || dim.parentElement !== overlay) {
      dim?.remove();
      dim = document.createElement('div');
      dim.id = DIM_ID;
      dim.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;background:rgba(0,0,0,0);';
      overlay.appendChild(dim);
    }
    return dim;
  }

  function buildFilter(controls, blurEnabled, blurIntensity) {
    const filters = [];
    if (blurEnabled) filters.push(`blur(${blurIntensity}px)`);
    filters.push(`brightness(${controls.brightness}%)`);
    filters.push(`contrast(${controls.contrast}%)`);
    filters.push(`saturate(${controls.saturation}%)`);
    return filters.join(' ');
  }

  async function applyWallpaperControls() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return false;

    const { globalSettings = {}, chatWallpapers = {} } = await getSettings();
    const controls = normalizeControls(globalSettings.wallpaperControls || DEFAULT_CONTROLS);
    const blurEnabled = resolveActiveBlur(globalSettings, chatWallpapers);
    const blurIntensity = clamp(globalSettings.blurIntensity, 2, 30, 8);
    const filter = buildFilter(controls, blurEnabled, blurIntensity);
    const zoom = controls.zoom / 100;

    overlay.style.setProperty('overflow', 'hidden', 'important');
    overlay.style.setProperty('transform-origin', controls.position, 'important');

    const video = overlay.querySelector('video');
    if (video) {
      overlay.style.removeProperty('background-image');
      overlay.style.setProperty('filter', 'none', 'important');
      video.style.setProperty('object-fit', fitToObjectFit(controls.fit), 'important');
      video.style.setProperty('object-position', controls.position, 'important');
      video.style.setProperty('transform', `scale(${zoom})`, 'important');
      video.style.setProperty('transform-origin', controls.position, 'important');
      video.style.setProperty('filter', filter, 'important');
      video.style.setProperty('z-index', '1', 'important');
    } else {
      overlay.style.setProperty('background-size', fitToBackgroundSize(controls.fit), 'important');
      overlay.style.setProperty('background-position', controls.position, 'important');
      overlay.style.setProperty('background-repeat', 'no-repeat', 'important');
      overlay.style.setProperty('transform', `scale(${zoom})`, 'important');
      overlay.style.setProperty('transform-origin', controls.position, 'important');
      overlay.style.setProperty('filter', filter, 'important');
    }

    const dim = ensureDimLayer(overlay);
    dim.style.setProperty('background', `rgba(0,0,0,${controls.dim / 100})`, 'important');

    overlay.dataset.waWallpaperControls = JSON.stringify(controls);
    return true;
  }

  const debouncedApply = (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => applyWallpaperControls().catch(console.warn), 120);
    };
  })();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'APPLY_WA_WALLPAPER_CONTROLS') return false;
    applyWallpaperControls()
      .then(applied => sendResponse({ ok: true, applied }))
      .catch(error => sendResponse({ ok: false, error: String(error) }));
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.globalSettings || changes.chatWallpapers) debouncedApply();
  });

  new MutationObserver(debouncedApply).observe(document.documentElement, { childList: true, subtree: true });
  debouncedApply();
  console.log('[WA Themes Wallpaper Controls] loaded');
})();
