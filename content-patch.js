// =============================================================================
// WhatsApp Themes — content-patch.js v1.6.1
// Runtime hardening loaded after content.js.
//
// Adds defensive fixes around extension messaging, WhatsApp selector churn,
// common failure paths, and a forced fallback chat wallpaper layer.
// =============================================================================
(() => {
  'use strict';

  const PATCH_ID = 'wa-theme-stability-patch';
  if (window[PATCH_ID]) return;
  window[PATCH_ID] = true;

  const LOG_PREFIX = '[WA Themes Patch]';
  const FORCE_BG_ID = 'wa-theme-force-bg-overlay';
  const FORCE_BG_STYLE_ID = 'wa-theme-force-bg-style';
  const VIDEO_DB_NAME = 'wa-themes-videos';
  const VIDEO_STORE_NAME = 'videos';
  const activePatchObjectUrls = new Map();

  const fallbackSelectors = {
    main: ['#main', '[data-testid="conversation-panel-wrapper"]', '[role="application"] main'],
    conversationTitle: [
      '[data-testid="conversation-info-header-chat-title"]',
      'header span[title]',
      '#main header span[dir="auto"][title]',
      '#main header span[dir="ltr"][title]'
    ],
    conversationHeader: ['[data-testid="conversation-header"]', '#main header'],
    chatPanel: [
      '[data-testid="conversation-panel-body"]',
      '[data-testid="conversation-panel-wrapper"]',
      '#main [role="application"]',
      '#main'
    ]
  };

  function firstMatch(selectors, root = document) {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function getCurrentChatName() {
    const titleEl = firstMatch(fallbackSelectors.conversationTitle);
    const raw = titleEl?.getAttribute('title') || titleEl?.textContent || '';
    const text = raw.trim();
    return text || null;
  }

  function getSettingsFromStorage() {
    return new Promise(resolve => {
      chrome.storage.local.get(['globalSettings', 'chatWallpapers'], result => {
        resolve({
          globalSettings: result.globalSettings || {},
          chatWallpapers: result.chatWallpapers || {}
        });
      });
    });
  }

  function toRgba(hex, alpha = 1) {
    if (typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
    let clean = hex.trim().replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, Number(alpha) || 0))})`;
  }

  function normalizeNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeColor(value, fallback) {
    return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
      ? value
      : fallback;
  }

  function cleanInternalKeys(settings) {
    if (!settings || typeof settings !== 'object') return {};
    const cleaned = { ...settings };
    delete cleaned.__repairTick;
    delete cleaned.__repairReason;
    return cleaned;
  }

  function normalizeGlobalSettings(settings) {
    const s = cleanInternalKeys(settings);
    return {
      ...s,
      enabled: s.enabled !== false,
      outBubbleColor: normalizeColor(s.outBubbleColor, '#144d37'),
      inBubbleColor: normalizeColor(s.inBubbleColor, '#242626'),
      outBubbleOpacity: normalizeNumber(s.outBubbleOpacity, 100, 0, 100),
      inBubbleOpacity: normalizeNumber(s.inBubbleOpacity, 100, 0, 100),
      blurIntensity: normalizeNumber(s.blurIntensity, 8, 2, 30),
      fontSize: s.fontSize == null || s.fontSize === '' ? null : normalizeNumber(s.fontSize, 14, 10, 22),
      headerColor: normalizeColor(s.headerColor, '#202c33'),
      convHeaderOpacity: normalizeNumber(s.convHeaderOpacity, 100, 0, 100),
      convHeaderBlur: normalizeNumber(s.convHeaderBlur, 0, 0, 30),
      chatlistHeaderColor: normalizeColor(s.chatlistHeaderColor, '#202c33'),
      chatlistHeaderOpacity: normalizeNumber(s.chatlistHeaderOpacity, 100, 0, 100),
      chatlistHeaderBlur: normalizeNumber(s.chatlistHeaderBlur, 0, 0, 30),
      sidebarTintColor: normalizeColor(s.sidebarTintColor, '#111b21'),
      sidebarTintOpacity: normalizeNumber(s.sidebarTintOpacity, 0, 0, 100),
      sidebarBlurIntensity: normalizeNumber(s.sidebarBlurIntensity, 8, 2, 30),
      sidebarColor: normalizeColor(s.sidebarColor, '#111b21'),
      chatCardBgColor: normalizeColor(s.chatCardBgColor, '#1d1f1f'),
      chatCardOpacity: normalizeNumber(s.chatCardOpacity, 100, 0, 100),
      chatCardBlurIntensity: normalizeNumber(s.chatCardBlurIntensity, 4, 2, 20),
      navStripColor: normalizeColor(s.navStripColor, '#202c33'),
      navStripOpacity: normalizeNumber(s.navStripOpacity, 100, 0, 100),
      navStripBlur: normalizeNumber(s.navStripBlur, 0, 0, 30)
    };
  }

  function ensureFallbackStyling(settings) {
    const existing = document.getElementById('wa-theme-selector-fallback-style');
    existing?.remove();

    const s = normalizeGlobalSettings(settings);
    if (s.enabled === false) return;

    const css = [];
    const header = firstMatch(fallbackSelectors.conversationHeader);
    if (header && s.headerColor) {
      header.style.setProperty('background-color', toRgba(s.headerColor, s.convHeaderOpacity / 100), 'important');
      const blur = Number(s.convHeaderBlur || 0);
      if (blur > 0) {
        header.style.setProperty('backdrop-filter', `blur(${blur}px) saturate(1.5)`, 'important');
        header.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px) saturate(1.5)`, 'important');
      }
    }

    const chatPanel = firstMatch(fallbackSelectors.chatPanel);
    if (chatPanel && s.fontFamily) css.push(`#main span[dir], #main .copyable-text { font-family: ${s.fontFamily} !important; }`);
    if (chatPanel && s.fontSize) css.push(`#main .copyable-text { font-size: ${Number(s.fontSize)}px !important; line-height: 1.4 !important; }`);

    if (css.length) {
      const style = document.createElement('style');
      style.id = 'wa-theme-selector-fallback-style';
      style.textContent = css.join('\n');
      document.head.appendChild(style);
    }
  }

  function openVideoDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(VIDEO_DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(VIDEO_STORE_NAME);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error || new Error('Failed to open video database'));
    });
  }

  async function idbGetVideo(key) {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(VIDEO_STORE_NAME, 'readonly').objectStore(VIDEO_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Failed to read video'));
    });
  }

  async function getPatchVideoObjectUrl(storageKey) {
    if (!storageKey) return null;
    if (activePatchObjectUrls.has(storageKey)) return activePatchObjectUrls.get(storageKey);

    let data = await idbGetVideo(storageKey).catch(() => null);
    if (!data) {
      const legacy = await chrome.storage.local.get(storageKey).catch(() => ({}));
      data = legacy?.[storageKey] || null;
    }
    if (!data) return null;

    let buffer;
    if (data instanceof Uint8Array) buffer = data.buffer;
    else if (data instanceof ArrayBuffer) buffer = data;
    else if (data?.buffer) buffer = data.buffer;
    else buffer = new Uint8Array(Object.values(data)).buffer;

    const url = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }));
    activePatchObjectUrls.set(storageKey, url);
    return url;
  }

  function resolveWallpaper(globalSettings, chatWallpapers) {
    const chatName = getCurrentChatName();
    const perChat = chatName ? chatWallpapers?.[chatName] : null;

    if (perChat?.wallpaperType === 'image' && perChat.wallpaperData) {
      return { type: 'image', data: perChat.wallpaperData, blur: Boolean(perChat.wallpaperBlur), source: 'per-chat' };
    }
    if (perChat?.wallpaperType === 'video' && (perChat.wallpaperStorageKey || perChat.wallpaperData)) {
      return {
        type: 'video',
        storageKey: perChat.wallpaperStorageKey,
        data: perChat.wallpaperData,
        blur: Boolean(perChat.wallpaperBlur),
        source: 'per-chat'
      };
    }
    if (globalSettings?.globalWallpaper) return { ...globalSettings.globalWallpaper, source: 'global' };
    return null;
  }

  function removeForcedWallpaper() {
    const overlay = document.getElementById(FORCE_BG_ID);
    const video = overlay?.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    overlay?.remove();
    document.getElementById(FORCE_BG_STYLE_ID)?.remove();
    const main = firstMatch(fallbackSelectors.main);
    if (main) delete main.dataset.waThemeForceBg;
  }

  async function forceWallpaperFallback(globalSettings, chatWallpapers) {
    const s = normalizeGlobalSettings(globalSettings);
    if (s.enabled === false) {
      removeForcedWallpaper();
      return;
    }

    const wallpaper = resolveWallpaper(globalSettings, chatWallpapers);
    const main = firstMatch(fallbackSelectors.main);
    if (!main || !wallpaper) {
      removeForcedWallpaper();
      return;
    }

    removeForcedWallpaper();
    main.dataset.waThemeForceBg = '1';
    main.style.setProperty('position', 'relative', 'important');
    main.style.setProperty('overflow', 'hidden', 'important');
    main.style.setProperty('background-color', 'transparent', 'important');

    const overlay = document.createElement('div');
    overlay.id = FORCE_BG_ID;

    if (wallpaper.type === 'image' && wallpaper.data) {
      overlay.style.setProperty('background-image', `url(${wallpaper.data})`, 'important');
      overlay.style.setProperty('background-size', 'cover', 'important');
      overlay.style.setProperty('background-position', 'center', 'important');
      overlay.style.setProperty('background-repeat', 'no-repeat', 'important');
      if (wallpaper.blur) {
        overlay.style.setProperty('filter', `blur(${s.blurIntensity || 8}px)`, 'important');
        overlay.style.setProperty('transform', 'scale(1.05)', 'important');
      }
    } else if (wallpaper.type === 'video') {
      const storageKey = wallpaper.storageKey || wallpaper.idbKey;
      const url = storageKey ? await getPatchVideoObjectUrl(storageKey) : wallpaper.data;
      if (!url) return;
      const video = document.createElement('video');
      video.src = url;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${wallpaper.blur ? `filter:blur(${s.blurIntensity || 8}px);transform:scale(1.05);` : ''}`;
      overlay.appendChild(video);
      video.play?.().catch(() => {});
    }

    main.insertBefore(overlay, main.firstChild);

    const style = document.createElement('style');
    style.id = FORCE_BG_STYLE_ID;
    style.textContent = `
      #${FORCE_BG_ID} {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 0 !important;
        pointer-events: none !important;
        overflow: hidden !important;
      }
      #main[data-wa-theme-force-bg="1"] > *:not(#${FORCE_BG_ID}) {
        position: relative !important;
        z-index: 1 !important;
      }
      #main[data-wa-theme-force-bg="1"],
      #main[data-wa-theme-force-bg="1"] > div,
      #main[data-wa-theme-force-bg="1"] > div > div,
      #main[data-wa-theme-force-bg="1"] [data-testid="conversation-panel-wrapper"],
      #main[data-wa-theme-force-bg="1"] [data-testid="conversation-panel-body"],
      #main[data-wa-theme-force-bg="1"] [data-testid="conversation-background-default_chat_wallpaper"],
      #main[data-wa-theme-force-bg="1"] [role="application"] {
        background-color: transparent !important;
        background-image: none !important;
      }
      #main[data-wa-theme-force-bg="1"] .message-in,
      #main[data-wa-theme-force-bg="1"] .message-out,
      #main[data-wa-theme-force-bg="1"] .message-in *,
      #main[data-wa-theme-force-bg="1"] .message-out * {
        background-image: initial;
      }
    `;
    document.head.appendChild(style);
    console.log(LOG_PREFIX, `forced chat wallpaper fallback applied (${wallpaper.source || 'unknown'} ${wallpaper.type})`);
  }

  async function normalizeStoredGlobalSettings() {
    try {
      const { globalSettings = {} } = await chrome.storage.local.get('globalSettings');
      const normalized = normalizeGlobalSettings(globalSettings);
      const before = JSON.stringify(cleanInternalKeys(globalSettings));
      const after = JSON.stringify(normalized);
      if (before !== after) await chrome.storage.local.set({ globalSettings: normalized });
    } catch (err) {
      console.warn(LOG_PREFIX, 'storage normalization failed:', err);
    }
  }

  async function reapplyFallbacks() {
    try {
      const { globalSettings, chatWallpapers } = await getSettingsFromStorage();
      ensureFallbackStyling(globalSettings);
      await forceWallpaperFallback(globalSettings, chatWallpapers);
    } catch (err) {
      console.warn(LOG_PREFIX, 'fallback reapply failed:', err);
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false;
    if (msg.type === 'GET_CURRENT_CHAT_SAFE') {
      sendResponse({ chatName: getCurrentChatName() });
      return true;
    }
    if (msg.type === 'FORCE_WA_THEME_WALLPAPER') {
      reapplyFallbacks()
        .then(() => sendResponse({ ok: true, chatName: getCurrentChatName() }))
        .catch(error => sendResponse({ ok: false, error: String(error) }));
      return true;
    }
    if (msg.type === 'NORMALIZE_WA_THEME_STORAGE') {
      normalizeStoredGlobalSettings()
        .then(() => sendResponse({ ok: true }))
        .catch(error => sendResponse({ ok: false, error: String(error) }));
      return true;
    }
    return false;
  });

  const debouncedReapply = (() => {
    let t = null;
    return () => {
      clearTimeout(t);
      t = setTimeout(reapplyFallbacks, 250);
    };
  })();

  const root = document.body || document.documentElement;
  if (root) {
    const observer = new MutationObserver(debouncedReapply);
    observer.observe(root, { childList: true, subtree: true });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.globalSettings || changes.chatWallpapers)) debouncedReapply();
  });

  normalizeStoredGlobalSettings();
  reapplyFallbacks();
  console.log(LOG_PREFIX, 'loaded');
})();
