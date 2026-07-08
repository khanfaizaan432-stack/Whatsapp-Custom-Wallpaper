// =============================================================================
// WhatsApp Themes — content-diagnostics.js v1.6.2
// Lightweight diagnostics endpoint for the popup.
// =============================================================================
(() => {
  'use strict';

  const DIAG_ID = 'wa-theme-content-diagnostics';
  if (window[DIAG_ID]) return;
  window[DIAG_ID] = true;

  const SELECTORS = {
    main: ['#main', '[data-testid="conversation-panel-wrapper"]', '[role="application"] main'],
    conversationTitle: [
      '[data-testid="conversation-info-header-chat-title"]',
      'header span[title]',
      '#main header span[dir="auto"][title]',
      '#main header span[dir="ltr"][title]'
    ],
    forcedOverlay: ['#wa-theme-force-bg-overlay'],
    originalOverlay: ['#wa-theme-bg-overlay'],
    sidebarOverlay: ['#wa-theme-sidebar-video', '#wa-theme-sidebar-style'],
    forcedStyle: ['#wa-theme-force-bg-style'],
    globalStyle: ['#wa-theme-global-style'],
  };

  function firstMatch(selectors, root = document) {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (el) return { selector, el };
    }
    return { selector: null, el: null };
  }

  function getCurrentChatName() {
    const { el } = firstMatch(SELECTORS.conversationTitle);
    const raw = el?.getAttribute('title') || el?.textContent || '';
    return raw.trim() || null;
  }

  function getStorage(keys) {
    return chrome.storage.local.get(keys);
  }

  function summarizeWallpaper(wallpaper) {
    if (!wallpaper) return null;
    return {
      type: wallpaper.type || null,
      hasData: Boolean(wallpaper.data),
      hasStorageKey: Boolean(wallpaper.storageKey || wallpaper.idbKey),
      blur: Boolean(wallpaper.blur),
    };
  }

  function summarizePerChat(chatSettings) {
    if (!chatSettings) return null;
    return {
      wallpaperType: chatSettings.wallpaperType || null,
      hasWallpaperData: Boolean(chatSettings.wallpaperData),
      hasWallpaperStorageKey: Boolean(chatSettings.wallpaperStorageKey),
      wallpaperBlur: Boolean(chatSettings.wallpaperBlur),
      hasBubbleOverrides: Boolean(
        chatSettings.outBubbleColor ||
        chatSettings.inBubbleColor ||
        chatSettings.outBubbleOpacity != null ||
        chatSettings.inBubbleOpacity != null
      ),
    };
  }

  async function buildDiagnostics() {
    const { globalSettings = {}, chatWallpapers = {} } = await getStorage(['globalSettings', 'chatWallpapers']);
    const chatName = getCurrentChatName();
    const perChat = chatName ? chatWallpapers[chatName] : null;
    const main = firstMatch(SELECTORS.main);
    const forcedOverlay = firstMatch(SELECTORS.forcedOverlay);
    const originalOverlay = firstMatch(SELECTORS.originalOverlay);
    const forcedStyle = firstMatch(SELECTORS.forcedStyle);
    const globalStyle = firstMatch(SELECTORS.globalStyle);
    const sidebarOverlay = firstMatch(SELECTORS.sidebarOverlay);

    return {
      ok: true,
      timestamp: new Date().toISOString(),
      location: location.href,
      contentDiagnosticsLoaded: true,
      extensionVersion: chrome.runtime.getManifest().version,
      currentChatName: chatName,
      mainFound: Boolean(main.el),
      mainSelector: main.selector,
      globalEnabled: globalSettings.enabled !== false,
      globalWallpaper: summarizeWallpaper(globalSettings.globalWallpaper),
      sidebarWallpaper: summarizeWallpaper(globalSettings.sidebarWallpaper),
      perChatWallpaper: summarizePerChat(perChat),
      chatThemeCount: Object.keys(chatWallpapers || {}).length,
      forcedOverlayMounted: Boolean(forcedOverlay.el),
      forcedOverlaySelector: forcedOverlay.selector,
      originalOverlayMounted: Boolean(originalOverlay.el),
      forcedStyleMounted: Boolean(forcedStyle.el),
      globalStyleMounted: Boolean(globalStyle.el),
      sidebarOverlayMounted: Boolean(sidebarOverlay.el),
      bodyReady: Boolean(document.body),
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'GET_WA_THEME_DIAGNOSTICS') return false;
    buildDiagnostics()
      .then(sendResponse)
      .catch(error => sendResponse({ ok: false, error: String(error) }));
    return true;
  });

  console.log('[WA Themes Diagnostics] loaded');
})();
