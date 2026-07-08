// =============================================================================
// WhatsApp Themes — content-patch.js v1.2.0
// Runtime hardening loaded after content.js.
//
// This file intentionally does not replace content.js. It adds defensive fixes
// around extension messaging, WhatsApp selector churn, and common failure paths.
// =============================================================================
(() => {
  'use strict';

  const PATCH_ID = 'wa-theme-stability-patch';
  if (window[PATCH_ID]) return;
  window[PATCH_ID] = true;

  const LOG_PREFIX = '[WA Themes Patch]';

  const fallbackSelectors = {
    main: ['#main', '[role="application"] main', '[data-testid="conversation-panel-wrapper"]'],
    conversationTitle: [
      '[data-testid="conversation-info-header-chat-title"]',
      'header span[title]',
      '#main header span[dir="auto"][title]',
      '#main header span[dir="ltr"][title]'
    ],
    conversationHeader: ['[data-testid="conversation-header"]', '#main header'],
    chatPanel: ['[data-testid="conversation-panel-body"]', '#main [role="application"]', '#main']
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
      header.style.setProperty(
        'background-color',
        toRgba(s.headerColor, s.convHeaderOpacity / 100),
        'important'
      );
      const blur = Number(s.convHeaderBlur || 0);
      if (blur > 0) {
        header.style.setProperty('backdrop-filter', `blur(${blur}px) saturate(1.5)`, 'important');
        header.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px) saturate(1.5)`, 'important');
      }
    }

    const chatPanel = firstMatch(fallbackSelectors.chatPanel);
    if (chatPanel && s.fontFamily) {
      css.push(`#main span[dir], #main .copyable-text { font-family: ${s.fontFamily} !important; }`);
    }
    if (chatPanel && s.fontSize) {
      css.push(`#main .copyable-text { font-size: ${Number(s.fontSize)}px !important; line-height: 1.4 !important; }`);
    }

    if (css.length) {
      const style = document.createElement('style');
      style.id = 'wa-theme-selector-fallback-style';
      style.textContent = css.join('\n');
      document.head.appendChild(style);
    }
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
      const { globalSettings } = await getSettingsFromStorage();
      ensureFallbackStyling(globalSettings);
    } catch (err) {
      console.warn(LOG_PREFIX, 'fallback reapply failed:', err);
    }
  }

  // Popup/content compatibility helpers.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false;
    if (msg.type === 'GET_CURRENT_CHAT_SAFE') {
      sendResponse({ chatName: getCurrentChatName() });
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
    if (area === 'local' && changes.globalSettings) debouncedReapply();
  });

  normalizeStoredGlobalSettings();
  reapplyFallbacks();
  console.log(LOG_PREFIX, 'loaded');
})();
