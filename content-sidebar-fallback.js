// =============================================================================
// WhatsApp Themes — content-sidebar-fallback.js v1.7.2
// Stronger fallback for WhatsApp Web side-panel image/video backgrounds.
// =============================================================================
(() => {
  'use strict';

  const SCRIPT_ID = 'wa-theme-sidebar-fallback-script';
  const STYLE_ID = 'wa-theme-sidebar-fallback-style';
  const OVERLAY_ID = 'wa-theme-sidebar-fallback-overlay';
  const TINT_ID = 'wa-theme-sidebar-fallback-tint';
  const VIDEO_ID = 'wa-theme-sidebar-fallback-video';
  const DB_NAME = 'wa-themes-videos';
  const STORE_NAME = 'videos';

  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  let activeObjectUrl = null;

  const sidebarSelectors = [
    '#side',
    '[data-testid="side"]',
    '[data-testid="chat-list"]',
    '[data-testid="conversation-list"]',
    '[aria-label="Chat list"]',
    '[aria-label="Chats"]',
    'div[aria-label="Chats"]',
    '[role="grid"]',
  ];

  function getSidebarCandidate() {
    for (const selector of sidebarSelectors) {
      const el = document.querySelector(selector);
      if (el) return { el, selector };
    }
    return { el: null, selector: null };
  }

  function rectLooksLikeSidebar(rect) {
    const width = window.innerWidth || document.documentElement.clientWidth || 1200;
    const height = window.innerHeight || document.documentElement.clientHeight || 800;
    return rect.width >= 220 && rect.width <= Math.max(520, width * 0.48) && rect.height >= height * 0.65 && rect.left <= width * 0.35;
  }

  function getSidebarRoot() {
    const direct = document.querySelector('#side');
    if (direct) return { el: direct, selector: '#side' };

    const match = getSidebarCandidate();
    if (!match.el) return match;

    let node = match.el;
    let best = match.el;
    while (node && node !== document.body && node !== document.documentElement) {
      const rect = node.getBoundingClientRect?.();
      if (rect && rectLooksLikeSidebar(rect)) best = node;
      node = node.parentElement;
    }
    return { el: best, selector: match.selector };
  }

  function toRgba(hex, opacityPercent) {
    let clean = String(hex || '#111b21').replace('#', '').trim();
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(clean)) clean = '111b21';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, Number(opacityPercent ?? 100) / 100));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = event => event.target.result.createObjectStore(STORE_NAME);
      req.onsuccess = event => resolve(event.target.result);
      req.onerror = () => reject(req.error || new Error('Failed to open video database'));
    });
  }

  async function getVideoBlobUrl(key) {
    if (!key) return null;
    const db = await openDb();
    const data = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Failed to read sidebar video'));
    });
    if (!data) return null;
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
    return activeObjectUrl;
  }

  function clearSidebarFallback(root) {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(TINT_ID)?.remove();
    root?.removeAttribute('data-wa-sidebar-fallback');
  }

  function ensureLayer(root, id) {
    let layer = document.getElementById(id);
    if (!layer || layer.parentElement !== root) {
      layer?.remove();
      layer = document.createElement('div');
      layer.id = id;
      root.insertBefore(layer, root.firstChild);
    }
    return layer;
  }

  async function applySidebarFallback() {
    const { globalSettings = {} } = await chrome.storage.local.get('globalSettings');
    const settings = globalSettings || {};
    const { el: root, selector } = getSidebarRoot();
    if (!root || settings.enabled === false) {
      clearSidebarFallback(root);
      return false;
    }

    const wallpaper = settings.sidebarWallpaper;
    const hasImage = wallpaper?.type === 'image' && Boolean(wallpaper.data);
    const hasVideo = wallpaper?.type === 'video' && Boolean(wallpaper.data || wallpaper.storageKey || wallpaper.idbKey);
    const hasWallpaper = hasImage || hasVideo;

    root.dataset.waSidebarFallback = '1';
    root.style.setProperty('position', 'relative', 'important');
    root.style.setProperty('overflow', 'hidden', 'important');
    root.style.setProperty('isolation', 'isolate', 'important');
    root.style.setProperty('background-color', 'transparent', 'important');
    root.style.setProperty('background-image', 'none', 'important');

    const overlay = ensureLayer(root, OVERLAY_ID);
    overlay.innerHTML = '';
    overlay.removeAttribute('style');
    overlay.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:0', 'pointer-events:none', 'overflow:hidden',
      `background:${settings.sidebarColor || '#111b21'}`, 'background-size:cover',
      'background-position:center', 'background-repeat:no-repeat'
    ].join(';');

    if (hasImage) {
      overlay.style.setProperty('background-image', `url(${wallpaper.data})`, 'important');
      overlay.style.setProperty('background-size', 'cover', 'important');
      overlay.style.setProperty('background-position', 'center', 'important');
      overlay.style.setProperty('background-repeat', 'no-repeat', 'important');
    } else if (hasVideo) {
      const key = wallpaper.storageKey || wallpaper.idbKey;
      const src = wallpaper.data || await getVideoBlobUrl(key).catch(() => null);
      if (src) {
        const video = document.createElement('video');
        video.id = VIDEO_ID;
        video.src = src;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
        overlay.appendChild(video);
        video.play?.().catch(() => {});
      }
    }

    const tintLayer = ensureLayer(root, TINT_ID);
    const tint = toRgba(settings.sidebarTintColor || '#111b21', settings.sidebarTintOpacity || 0);
    const blur = settings.blurSidebar ? `blur(${Number(settings.sidebarBlurIntensity || 8)}px)` : 'none';
    tintLayer.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:1', 'pointer-events:none',
      `background:${tint}`, `backdrop-filter:${blur}`, `-webkit-backdrop-filter:${blur}`
    ].join(';');

    const nav = toRgba(settings.navStripColor || '#202c33', settings.navStripOpacity ?? 100);
    const header = toRgba(settings.chatlistHeaderColor || '#202c33', settings.chatlistHeaderOpacity ?? 100);
    const card = toRgba(settings.chatCardBgColor || '#1d1f1f', settings.chatCardOpacity ?? 100);

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-wa-sidebar-fallback="1"] > *:not(#${OVERLAY_ID}):not(#${TINT_ID}) {
        position: relative !important;
        z-index: 2 !important;
      }
      [data-wa-sidebar-fallback="1"],
      [data-wa-sidebar-fallback="1"] > div,
      [data-wa-sidebar-fallback="1"] [role="grid"],
      [data-wa-sidebar-fallback="1"] [role="list"],
      [data-wa-sidebar-fallback="1"] [aria-label="Chat list"],
      [data-wa-sidebar-fallback="1"] [aria-label="Chats"],
      [data-wa-sidebar-fallback="1"] [data-testid="chat-list"],
      [data-wa-sidebar-fallback="1"] [data-testid="conversation-list"] {
        background-color: transparent !important;
        background-image: none !important;
      }
      [data-wa-sidebar-fallback="1"] header,
      [data-wa-sidebar-fallback="1"] [data-testid="chat-list-header"],
      [data-wa-sidebar-fallback="1"] [data-testid="side-bar-header"] {
        background: ${header} !important;
      }
      [data-wa-sidebar-fallback="1"] nav,
      [data-wa-sidebar-fallback="1"] [aria-label="Main navigation"],
      [data-wa-sidebar-fallback="1"] [data-testid="navigation-side-bar"] {
        background: ${nav} !important;
      }
      [data-wa-sidebar-fallback="1"] [role="listitem"],
      [data-wa-sidebar-fallback="1"] [role="row"],
      [data-wa-sidebar-fallback="1"] [data-testid="cell-frame-container"] {
        background: ${card} !important;
      }
    `;
    document.getElementById(STYLE_ID)?.remove();
    document.head.appendChild(style);
    console.log('[WA Themes Sidebar Fallback] applied', { selector, hasWallpaper, type: wallpaper?.type || null, root: root.tagName });
    return true;
  }

  const debouncedApply = (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => applySidebarFallback().catch(console.warn), 200);
    };
  })();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.globalSettings) debouncedApply();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'FORCE_WA_THEME_SIDEBAR') return false;
    applySidebarFallback()
      .then(applied => sendResponse({ ok: true, applied }))
      .catch(error => sendResponse({ ok: false, error: String(error) }));
    return true;
  });

  new MutationObserver(debouncedApply).observe(document.documentElement, { childList: true, subtree: true });
  debouncedApply();
})();
