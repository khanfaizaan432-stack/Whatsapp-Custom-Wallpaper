// =============================================================================
// WhatsApp Themes — content-sidebar-fallback.js v1.7.1
// Conservative fallback for WhatsApp Web side-panel styling.
// =============================================================================
(() => {
  'use strict';

  const SCRIPT_ID = 'wa-theme-sidebar-fallback-script';
  const STYLE_ID = 'wa-theme-sidebar-fallback-style';
  const OVERLAY_ID = 'wa-theme-sidebar-fallback-overlay';
  const VIDEO_ID = 'wa-theme-sidebar-fallback-video';
  const DB_NAME = 'wa-themes-videos';
  const STORE_NAME = 'videos';

  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  let activeObjectUrl = null;

  const sidebarSelectors = [
    '#side',
    '[data-testid="chat-list"]',
    '[data-testid="conversation-list"]',
    '[aria-label="Chat list"]',
    '[role="grid"]',
    'div[aria-label="Chats"]',
  ];

  function firstMatch(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return { el, selector };
    }
    return { el: null, selector: null };
  }

  function getSidebarRoot() {
    const direct = document.querySelector('#side');
    if (direct) return { el: direct, selector: '#side' };

    const match = firstMatch(sidebarSelectors);
    if (!match.el) return match;

    const parent = match.el.closest('#side, [role="region"], [data-testid="side"], div') || match.el;
    return { el: parent, selector: match.selector };
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
    root?.removeAttribute('data-wa-sidebar-fallback');
  }

  function ensureOverlay(root) {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || overlay.parentElement !== root) {
      overlay?.remove();
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      root.insertBefore(overlay, root.firstChild);
    }
    return overlay;
  }

  async function applySidebarFallback() {
    const { globalSettings = {} } = await chrome.storage.local.get('globalSettings');
    const settings = globalSettings || {};
    const { el: root, selector } = getSidebarRoot();
    if (!root || settings.enabled === false) {
      clearSidebarFallback(root);
      return false;
    }

    root.dataset.waSidebarFallback = '1';
    root.style.setProperty('position', 'relative', 'important');
    root.style.setProperty('overflow', 'hidden', 'important');

    const wallpaper = settings.sidebarWallpaper;
    const hasWallpaper = wallpaper && (wallpaper.type === 'image' || wallpaper.type === 'video');
    const overlay = ensureOverlay(root);
    overlay.innerHTML = '';
    overlay.removeAttribute('style');
    overlay.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:transparent;';

    if (hasWallpaper && wallpaper.type === 'image' && wallpaper.data) {
      overlay.style.setProperty('background-image', `url(${wallpaper.data})`, 'important');
      overlay.style.setProperty('background-size', 'cover', 'important');
      overlay.style.setProperty('background-position', 'center', 'important');
      overlay.style.setProperty('background-repeat', 'no-repeat', 'important');
    } else if (hasWallpaper && wallpaper.type === 'video') {
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
    } else {
      overlay.style.setProperty('background', settings.sidebarColor || '#111b21', 'important');
    }

    const tint = toRgba(settings.sidebarTintColor || '#111b21', settings.sidebarTintOpacity || 0);
    const nav = toRgba(settings.navStripColor || '#202c33', settings.navStripOpacity ?? 100);
    const header = toRgba(settings.chatlistHeaderColor || '#202c33', settings.chatlistHeaderOpacity ?? 100);
    const card = toRgba(settings.chatCardBgColor || '#1d1f1f', settings.chatCardOpacity ?? 100);
    const blur = settings.blurSidebar ? `blur(${Number(settings.sidebarBlurIntensity || 8)}px)` : 'none';

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-wa-sidebar-fallback="1"] > *:not(#${OVERLAY_ID}) {
        position: relative !important;
        z-index: 1 !important;
      }
      [data-wa-sidebar-fallback="1"]::after {
        content: "" !important;
        position: absolute !important;
        inset: 0 !important;
        z-index: 0 !important;
        pointer-events: none !important;
        background: ${tint} !important;
        backdrop-filter: ${blur} !important;
        -webkit-backdrop-filter: ${blur} !important;
      }
      #side, #side > div, #side [role="grid"], #side [aria-label="Chat list"], #side [data-testid="chat-list"], #side [data-testid="conversation-list"] {
        background-color: transparent !important;
        background-image: none !important;
      }
      #side header,
      #side [data-testid="chat-list-header"],
      #side [data-testid="side-bar-header"] {
        background: ${header} !important;
      }
      #side nav,
      #side [aria-label="Main navigation"],
      #side [data-testid="navigation-side-bar"] {
        background: ${nav} !important;
      }
      #side [role="listitem"],
      #side [role="row"],
      #side [data-testid="cell-frame-container"] {
        background: ${card} !important;
      }
    `;
    document.getElementById(STYLE_ID)?.remove();
    document.head.appendChild(style);
    console.log('[WA Themes Sidebar Fallback] applied', selector);
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
