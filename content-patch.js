// =============================================================================
// WhatsApp Themes — content-patch.js v1.1.0
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

  function ensureFallbackStyling(settings) {
    const existing = document.getElementById('wa-theme-selector-fallback-style');
    existing?.remove();

    if (settings.enabled === false) return;

    const css = [];
    const header = firstMatch(fallbackSelectors.conversationHeader);
    if (header && settings.headerColor) {
      header.style.setProperty(
        'background-color',
        toRgba(settings.headerColor, (settings.convHeaderOpacity ?? 100) / 100),
        'important'
      );
      const blur = Number(settings.convHeaderBlur || 0);
      if (blur > 0) {
        header.style.setProperty('backdrop-filter', `blur(${blur}px) saturate(1.5)`, 'important');
        header.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px) saturate(1.5)`, 'important');
      }
    }

    const chatPanel = firstMatch(fallbackSelectors.chatPanel);
    if (chatPanel && settings.fontFamily) {
      css.push(`#main span[dir], #main .copyable-text { font-family: ${settings.fontFamily} !important; }`);
    }
    if (chatPanel && settings.fontSize) {
      css.push(`#main .copyable-text { font-size: ${Number(settings.fontSize)}px !important; line-height: 1.4 !important; }`);
    }

    if (css.length) {
      const style = document.createElement('style');
      style.id = 'wa-theme-selector-fallback-style';
      style.textContent = css.join('\n');
      document.head.appendChild(style);
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

  // Popup compatibility: always answer GET_CURRENT_CHAT_SAFE, even if the original
  // content listener failed to detect the title because WhatsApp changed attrs.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'GET_CURRENT_CHAT_SAFE') return false;
    sendResponse({ chatName: getCurrentChatName() });
    return true;
  });

  // Re-run lightweight fallback styling when WhatsApp mutates the chat header.
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

  reapplyFallbacks();
  console.log(LOG_PREFIX, 'loaded');
})();
