// =============================================================================
// WhatsApp Themes — content-patch.js v1.1.0
// Runtime hardening layer loaded after content.js.
//
// Why this file exists:
// - WhatsApp Web changes test IDs/classes often. This patch adds fallback selectors
//   and safer re-application without rewriting the original extension logic.
// - It validates stored theme values before content.js consumes them.
// - It repairs overlays if WhatsApp re-renders #main or #side after initial load.
// =============================================================================
(() => {
  'use strict';

  const PATCH_TAG = '[WA Themes patch]';
  const REPAIR_DELAY_MS = 350;
  let repairTimer = null;

  const FALLBACK_SELECTORS = {
    main: ['#main', '[role="application"] [tabindex="-1"]'],
    chatTitle: [
      '[data-testid="conversation-info-header-chat-title"]',
      'header [dir="auto"][title]',
      '#main header span[title]',
      '#main header [dir="auto"]',
    ],
    chatPanel: [
      '[data-testid="conversation-panel-body"]',
      '#main [role="application"]',
      '#main .copyable-area',
    ],
    chatlistHeader: [
      '[data-testid="chatlist-header"]',
      '#side header',
      '#side [role="banner"]',
    ],
    chatListItem: [
      '[data-testid="cell-frame-container"]',
      '#pane-side [role="listitem"]',
      '#pane-side [tabindex="-1"]',
    ],
  };

  function first(selectors, root = document) {
    for (const selector of selectors) {
      try {
        const el = root.querySelector(selector);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function all(selectors, root = document) {
    const out = [];
    const seen = new Set();
    for (const selector of selectors) {
      try {
        for (const el of root.querySelectorAll(selector)) {
          if (!seen.has(el)) {
            seen.add(el);
            out.push(el);
          }
        }
      } catch (_) {}
    }
    return out;
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function safeHex(value, fallback) {
    return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
      ? value
      : fallback;
  }

  function sanitizeWallpaper(wallpaper) {
    if (!wallpaper || typeof wallpaper !== 'object') return null;
    if (wallpaper.type === 'image' && typeof wallpaper.data === 'string' && wallpaper.data.startsWith('data:image/')) {
      return { ...wallpaper, blur: Boolean(wallpaper.blur) };
    }
    if (wallpaper.type === 'video' && (typeof wallpaper.storageKey === 'string' || typeof wallpaper.data === 'string')) {
      return { ...wallpaper, blur: Boolean(wallpaper.blur) };
    }
    return null;
  }

  function sanitizeGlobalSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    return {
      ...s,
      enabled: s.enabled !== false,
      outBubbleColor: safeHex(s.outBubbleColor, '#144d37'),
      inBubbleColor: safeHex(s.inBubbleColor, '#242626'),
      outBubbleOpacity: clampNumber(s.outBubbleOpacity, 0, 100, 100),
      inBubbleOpacity: clampNumber(s.inBubbleOpacity, 0, 100, 100),
      blurIntensity: clampNumber(s.blurIntensity, 2, 30, 8),
      fontSize: s.fontSize === null || s.fontSize === '' ? null : clampNumber(s.fontSize, 10, 22, 14),
      headerColor: safeHex(s.headerColor, '#202c33'),
      convHeaderOpacity: clampNumber(s.convHeaderOpacity, 0, 100, 100),
      convHeaderBlur: clampNumber(s.convHeaderBlur, 0, 30, 0),
      chatlistHeaderColor: safeHex(s.chatlistHeaderColor, '#202c33'),
      chatlistHeaderOpacity: clampNumber(s.chatlistHeaderOpacity, 0, 100, 100),
      chatlistHeaderBlur: clampNumber(s.chatlistHeaderBlur, 0, 30, 0),
      sidebarTintColor: safeHex(s.sidebarTintColor, '#111b21'),
      sidebarTintOpacity: clampNumber(s.sidebarTintOpacity, 0, 100, 0),
      sidebarBlurIntensity: clampNumber(s.sidebarBlurIntensity, 2, 30, 8),
      sidebarColor: safeHex(s.sidebarColor, '#111b21'),
      chatCardBgColor: safeHex(s.chatCardBgColor, '#1d1f1f'),
      chatCardOpacity: clampNumber(s.chatCardOpacity, 0, 100, 100),
      chatCardBlurIntensity: clampNumber(s.chatCardBlurIntensity, 2, 20, 4),
      navStripColor: safeHex(s.navStripColor, '#202c33'),
      navStripOpacity: clampNumber(s.navStripOpacity, 0, 100, 100),
      navStripBlur: clampNumber(s.navStripBlur, 0, 30, 0),
      globalWallpaper: sanitizeWallpaper(s.globalWallpaper),
      sidebarWallpaper: sanitizeWallpaper(s.sidebarWallpaper),
    };
  }

  function sanitizeChatSettings(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const cleaned = {};
    for (const [chatName, value] of Object.entries(raw)) {
      if (!chatName || !value || typeof value !== 'object') continue;
      const wallpaperType = value.wallpaperType === 'image' || value.wallpaperType === 'video' ? value.wallpaperType : null;
      const wallpaperData = typeof value.wallpaperData === 'string' ? value.wallpaperData : null;
      const wallpaperStorageKey = typeof value.wallpaperStorageKey === 'string' ? value.wallpaperStorageKey : null;
      cleaned[chatName] = {
        ...value,
        wallpaperType,
        wallpaperData,
        wallpaperStorageKey,
        wallpaperBlur: Boolean(value.wallpaperBlur),
        outBubbleColor: value.outBubbleColor ? safeHex(value.outBubbleColor, '#144d37') : null,
        inBubbleColor: value.inBubbleColor ? safeHex(value.inBubbleColor, '#242626') : null,
        outBubbleOpacity: value.outBubbleOpacity == null ? null : clampNumber(value.outBubbleOpacity, 0, 100, 100),
        inBubbleOpacity: value.inBubbleOpacity == null ? null : clampNumber(value.inBubbleOpacity, 0, 100, 100),
        bubbleBlurIntensity: clampNumber(value.bubbleBlurIntensity, 2, 30, 8),
      };
    }
    return cleaned;
  }

  async function normalizeStoredSettings() {
    try {
      const result = await chrome.storage.local.get(['globalSettings', 'chatWallpapers']);
      const globalSettings = sanitizeGlobalSettings(result.globalSettings || {});
      const chatWallpapers = sanitizeChatSettings(result.chatWallpapers || {});
      await chrome.storage.local.set({ globalSettings, chatWallpapers });
    } catch (err) {
      console.warn(PATCH_TAG, 'storage normalization skipped:', err);
    }
  }

  function getCurrentChatNameFallback() {
    const titleEl = first(FALLBACK_SELECTORS.chatTitle);
    const title = titleEl?.getAttribute('title') || titleEl?.textContent || '';
    return title.trim() || null;
  }

  function scheduleRepair(reason) {
    clearTimeout(repairTimer);
    repairTimer = setTimeout(async () => {
      try {
        await normalizeStoredSettings();
        const chatName = getCurrentChatNameFallback();
        chrome.runtime.sendMessage({
          type: 'WA_THEMES_PATCH_HEALTHCHECK',
          reason,
          chatName,
          at: new Date().toISOString(),
        }).catch(() => {});
        chrome.storage.local.get(['globalSettings', 'chatWallpapers'], () => {
          // Force content.js storage watcher to fire even if WhatsApp re-rendered
          // without settings changing.
          chrome.storage.local.set({ waThemesLastRepair: Date.now() }).catch(() => {});
        });
      } catch (err) {
        console.warn(PATCH_TAG, 'repair failed:', err);
      }
    }, REPAIR_DELAY_MS);
  }

  function installDomRepairObserver() {
    const root = document.querySelector('#app') || document.body;
    if (!root) return;
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const element = node;
          if (
            element.matches?.('#main,#side,#pane-side') ||
            first(FALLBACK_SELECTORS.main, element) ||
            first(FALLBACK_SELECTORS.chatlistHeader, element) ||
            first(FALLBACK_SELECTORS.chatPanel, element)
          ) {
            scheduleRepair('wa-dom-rerender');
            return;
          }
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function installFallbackCurrentChatResponder() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type !== 'GET_CURRENT_CHAT_FALLBACK') return;
      sendResponse({ chatName: getCurrentChatNameFallback() });
      return true;
    });
  }

  function patchChatCardsOnIdle() {
    requestAnimationFrame(() => {
      const cards = all(FALLBACK_SELECTORS.chatListItem);
      if (!cards.length) return;
      chrome.storage.local.get('globalSettings', ({ globalSettings }) => {
        const s = sanitizeGlobalSettings(globalSettings || {});
        if (!s.enabled) return;
        const alpha = s.chatCardOpacity / 100;
        const hex = s.chatCardBgColor.replace('#', '');
        const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        const rgba = `rgba(${r},${g},${b},${alpha})`;
        for (const card of cards) {
          card.style.setProperty('background-color', rgba, 'important');
        }
      });
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRepair('tab-visible');
  });

  window.addEventListener('focus', () => scheduleRepair('window-focus'));

  normalizeStoredSettings()
    .then(() => {
      installDomRepairObserver();
      installFallbackCurrentChatResponder();
      patchChatCardsOnIdle();
      scheduleRepair('patch-loaded');
      console.log(PATCH_TAG, 'loaded');
    })
    .catch(err => console.warn(PATCH_TAG, 'load failed:', err));
})();
