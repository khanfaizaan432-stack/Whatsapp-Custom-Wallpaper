// =============================================================================
// WhatsApp Themes — content.js v8
// Changes from v7:
//   • Sidebar wallpaper now targets #side's PARENT container, covering both
//     the left nav strip and #side in a single overlay
//   • Left nav strip + inner #side header go transparent when sidebar wallpaper active
//   • Chat card transparency feature removed entirely (was inconsistent)
//   • Bubble observer reverted to immediate stamping (no debounce/batch)
// =============================================================================
console.log('[WA Themes] ✅ content.js v8 loaded at', new Date().toISOString());

// ---------------------------------------------------------------------------
// SELECTORS
// ---------------------------------------------------------------------------
const SEL = {
  main:           '#main',
  chatBg:         '[data-testid="conversation-background-default_chat_wallpaper"]',
  chatPanel:      '[data-testid="conversation-panel-body"]',
  header:         '[data-testid="conversation-header"]',
  chatlistHeader: '[data-testid="chatlist-header"]',
  chatTitle:      '[data-testid="conversation-info-header-chat-title"]',
  menuBtn:        '[data-testid="conversation-header"] [aria-label="Menu"][data-tab="6"]',
  dropdownMenu:   '[role="menu"]',
  // sidebarFull = ENTIRE left panel (includes chatlist-header, search, pane-side)
  sidebarFull:    '#side',
  leftPanel:      '#pane-side',
  chatList:       '[data-testid="chat-list"]',
  chatListItem:   '[data-testid="cell-frame-container"]',
  bubbleOut:      '.message-out',
  bubbleIn:       '.message-in',
  bubbleBg:       '._amk6',
};

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
let currentChatName  = null;
let globalSettings   = {};
let chatSettings     = {};
let styleEl          = null;
let bgOverlay        = null;
let sidebarOverlay   = null;
let menuObserver     = null;
let chatObserver     = null;
let bubbleObserver   = null;
let chatCardObserver = null;

// objectURL registry — storageKey → objectURL string
// Must revoke URLs when re-applying or removing wallpapers to prevent memory leaks
const activeObjectUrls = {};

// Tracks the parent element that received the sidebar wallpaper (parent of #side)
let sidebarContainerEl = null;

// ---------------------------------------------------------------------------
// DEFAULTS
// ---------------------------------------------------------------------------
function getDefaults() {
  return {
    enabled:               true,
    outBubbleColor:        '#144d37',
    outBubbleOpacity:      100,
    blurOutBubble:         false,
    inBubbleColor:         '#242626',
    inBubbleOpacity:       100,
    blurInBubble:          false,
    blurIntensity:         8,
    fontFamily:            null,
    fontSize:              null,
    // Conversation header (top bar when chat open)
    headerColor:           '#202c33',
    convHeaderOpacity:     100,
    convHeaderBlur:        0,
    // Chatlist header (bar at top of sidebar)
    chatlistHeaderColor:   '#202c33',
    chatlistHeaderOpacity: 100,
    chatlistHeaderBlur:    0,
    // Wallpapers
    globalWallpaper:       null,
    sidebarWallpaper:      null,
    // Sidebar
    sidebarTintColor:      '#111b21',
    sidebarTintOpacity:    0,
    blurSidebar:           false,
    sidebarBlurIntensity:  8,
    sidebarColor:          null,
    // Chat cards (individual conversation rows in the chat list)
    chatCardBgColor:       '#1d1f1f',
    chatCardOpacity:       100,
    chatCardBlur:          false,
    chatCardBlurIntensity: 4,
    // Nav strip (leftmost icon panel: Chats/Status/Channels)
    navStripColor:         '#202c33',
    navStripOpacity:       100,
    navStripBlur:          0,
  };
}

// ---------------------------------------------------------------------------
// UTILITY
// ---------------------------------------------------------------------------
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function genId() {
  return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function base64ToBlob(dataUrl, fallbackMime) {
  const parts = dataUrl.split(',');
  const mime  = (parts[0].match(/:(.*?);/) || [])[1] || fallbackMime;
  const bstr  = atob(parts[1]);
  const u8    = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

// ---------------------------------------------------------------------------
// INDEXEDDB VIDEO STORAGE
// chrome.storage.local has a 5MB per-item hard cap — useless for video files.
// IndexedDB has no meaningful size limit in Chrome. All video blobs go here.
// The storageKey in globalSettings/chatSettings is the IDB record key.
// ---------------------------------------------------------------------------
let _idb = null;
async function openVideoDB() {
  if (_idb) return _idb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wa-themes-videos', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('videos');
    req.onsuccess       = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror         = e => reject(e.target.error);
  });
}
async function idbGet(key) {
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('videos', 'readonly').objectStore('videos').get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}
async function idbSet(key, value) {
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('videos', 'readwrite').objectStore('videos').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
async function idbDelete(key) {
  if (!key) return;
  const db = await openVideoDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('videos', 'readwrite').objectStore('videos').delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// OBJECT URL MANAGEMENT
// ---------------------------------------------------------------------------
function trackUrl(key, url) {
  if (activeObjectUrls[key]) URL.revokeObjectURL(activeObjectUrls[key]);
  activeObjectUrls[key] = url;
}

function revokeUrl(key) {
  if (activeObjectUrls[key]) {
    URL.revokeObjectURL(activeObjectUrls[key]);
    delete activeObjectUrls[key];
  }
}

// Reads video from IDB (new path) or chrome.storage.local (legacy fallback),
// creates a Blob URL, and caches it for the lifetime of the page.
async function getVideoObjectUrl(storageKey) {
  if (activeObjectUrls[storageKey]) return activeObjectUrls[storageKey];
  try {
    // Try IDB first (all new uploads go here, no size limit)
    let data = await idbGet(storageKey);

    // Legacy fallback: old videos stored in chrome.storage.local (<5MB)
    if (!data) {
      const result = await chrome.storage.local.get(storageKey);
      data = result[storageKey] ?? null;
    }

    if (!data) {
      console.warn('[WA Themes] Video not found for key:', storageKey);
      return null;
    }

    // Normalise to ArrayBuffer — stored value may be Uint8Array or plain object after JSON round-trip
    let buffer;
    if (data instanceof Uint8Array) buffer = data.buffer;
    else if (data.buffer)           buffer = data.buffer;
    else                            buffer = new Uint8Array(Object.values(data)).buffer;

    const blob = new Blob([buffer], { type: 'video/mp4' });
    const url  = URL.createObjectURL(blob);
    trackUrl(storageKey, url);
    return url;
  } catch (err) {
    console.error('[WA Themes] Failed to load video:', storageKey, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// VIDEO EVENT HANDLERS (loop / stall / error)
// ---------------------------------------------------------------------------
function attachVideoHandlers(videoEl, storageKey) {
  // Force restart if loop attribute silently fails
  videoEl.addEventListener('ended', () => {
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
  });

  // Re-load if the browser's buffer stalls out
  videoEl.addEventListener('stalled', () => {
    videoEl.load();
    videoEl.play().catch(() => {});
  });

  // On decode error, revoke old URL and get a fresh one
  videoEl.addEventListener('error', () => {
    setTimeout(async () => {
      if (!storageKey) return;
      revokeUrl(storageKey); // force fresh URL
      const url = await getVideoObjectUrl(storageKey);
      if (url) { videoEl.src = url; videoEl.load(); videoEl.play().catch(() => {}); }
    }, 1000);
  });
}

// ---------------------------------------------------------------------------
// STORAGE
// ---------------------------------------------------------------------------
async function loadStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(['globalSettings', 'chatWallpapers'], result => {
      globalSettings = Object.assign(getDefaults(), result.globalSettings || {});
      chatSettings   = result.chatWallpapers || {};
      resolve();
    });
  });
}

// One-time migration: convert any legacy base64 video blobs to Uint8Array storage keys.
// Called once after initial loadStorage(). Safe to call repeatedly (skips if already migrated).
async function migrateBase64Videos() {
  let dirty = false;

  // Helper: returns true only if value is a base64 data-URL string — skips
  // Uint8Arrays, plain objects, or blob URLs that may be left from prior runs.
  const isBase64DataUrl = v => typeof v === 'string' && v.startsWith('data:');

  // --- Global wallpaper ---
  const gw = globalSettings.globalWallpaper;
  if (gw?.type === 'video' && isBase64DataUrl(gw?.data)) {
    try {
      const key = 'wa_vid_global';
      const ab  = await base64ToBlob(gw.data, 'video/mp4').arrayBuffer();
      await idbSet(key, new Uint8Array(ab));
      globalSettings.globalWallpaper = { type: 'video', storageKey: key };
      dirty = true;
      console.log('[WA Themes] Migrated global video → IDB');
    } catch (e) { console.error('[WA Themes] Migration failed (global):', e); }
  }

  // --- Sidebar wallpaper ---
  const sw = globalSettings.sidebarWallpaper;
  if (sw?.type === 'video' && isBase64DataUrl(sw?.data)) {
    try {
      const key = 'wa_vid_sidebar';
      const ab  = await base64ToBlob(sw.data, 'video/mp4').arrayBuffer();
      await idbSet(key, new Uint8Array(ab));
      globalSettings.sidebarWallpaper = { type: 'video', storageKey: key };
      dirty = true;
      console.log('[WA Themes] Migrated sidebar video → IDB');
    } catch (e) { console.error('[WA Themes] Migration failed (sidebar):', e); }
  }

  // --- Per-chat wallpapers ---
  for (const [chatName, cs] of Object.entries(chatSettings)) {
    if (cs.wallpaperType === 'video' && isBase64DataUrl(cs.wallpaperData)) {
      try {
        const key = `wa_vid_chat_${genId()}`;
        const ab  = await base64ToBlob(cs.wallpaperData, 'video/mp4').arrayBuffer();
        await idbSet(key, new Uint8Array(ab));
        chatSettings[chatName] = { ...cs, wallpaperData: null, wallpaperStorageKey: key };
        dirty = true;
        console.log('[WA Themes] Migrated per-chat video:', chatName);
      } catch (e) { console.error('[WA Themes] Migration failed (chat):', chatName, e); }
    }
  }

  if (dirty) {
    await chrome.storage.local.set({ globalSettings, chatWallpapers: chatSettings });
    console.log('[WA Themes] ✅ Video migration complete');
  }
}

async function persistChatSettings(chatName, data) {
  chatSettings[chatName] = data;
  return chrome.storage.local.set({ chatWallpapers: chatSettings });
}

async function deleteChatSettings(chatName) {
  const cs = chatSettings[chatName];
  if (cs?.wallpaperStorageKey) {
    await chrome.storage.local.remove(cs.wallpaperStorageKey);
    revokeUrl(cs.wallpaperStorageKey);
  }
  delete chatSettings[chatName];
  return chrome.storage.local.set({ chatWallpapers: chatSettings });
}

// ---------------------------------------------------------------------------
// GLOBAL CSS (font, headers, sidebar solid colour, chat-card transparency)
// Bubbles are done inline via stampBubbleColour — not here.
// ---------------------------------------------------------------------------
function applyGlobalCSS() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'wa-theme-global-style';
    document.head.appendChild(styleEl);
  }
  if (!globalSettings.enabled) { styleEl.textContent = ''; return; }

  const s   = globalSettings;
  let   css = '/* WA Themes v7 */\n';

  // ── Font ──────────────────────────────────────────────────────────────────
  if (s.fontFamily) {
    css += `${SEL.chatPanel} .copyable-text,
            ${SEL.chatPanel} span[dir="ltr"],
            ${SEL.chatPanel} span[dir="auto"] { font-family:${s.fontFamily}!important; }\n`;
  }
  if (s.fontSize) {
    css += `${SEL.chatPanel} .copyable-text { font-size:${s.fontSize}px!important; line-height:1.4!important; }\n`;
  }

  // ── Conversation header (top bar when a chat is open) ─────────────────────
  {
    const color  = s.headerColor        || '#202c33';
    const alpha  = (s.convHeaderOpacity ?? 100) / 100;
    const blurPx = s.convHeaderBlur     ?? 0;
    css += `${SEL.header} {\n`;
    css += `  background-color: ${hexToRgba(color, alpha)} !important;\n`;
    if (blurPx > 0) {
      css += `  backdrop-filter: blur(${blurPx}px) saturate(1.5) !important;\n`;
      css += `  -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.5) !important;\n`;
    }
    css += `}\n`;
  }

  // ── Chatlist header (bar at top of sidebar — also targets obfuscated classes) ──
  {
    const color  = s.chatlistHeaderColor   || '#202c33';
    const alpha  = (s.chatlistHeaderOpacity ?? 100) / 100;
    const blurPx = s.chatlistHeaderBlur    ?? 0;
    css += `${SEL.chatlistHeader}, .xq3y45c, .xbyj736 {\n`;
    css += `  background-color: ${hexToRgba(color, alpha)} !important;\n`;
    if (blurPx > 0) {
      css += `  backdrop-filter: blur(${blurPx}px) saturate(1.5) !important;\n`;
      css += `  -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.5) !important;\n`;
    }
    css += `}\n`;
  }

  // ── Nav strip (leftmost icon panel — Chats/Status/Channels) ─────────────
  // [data-testid="chatlist-header"] is the nav strip header itself. Its direct
  // parent is an anonymous wrapper div (bg:rgb(29,31,31)) — targeted via :has().
  // When wallpaper is active these are overridden to transparent below.
  {
    const color  = s.navStripColor   || '#202c33';
    const alpha  = (s.navStripOpacity ?? 100) / 100;
    const blurPx = s.navStripBlur    ?? 0;
    const rgba   = hexToRgba(color, alpha);
    // Target the wrapper div (direct parent of chatlist-header) via :has()
    css += `div:has(> [data-testid="chatlist-header"]) { background-color: ${rgba} !important; }\n`;
    css += `[data-testid="chatlist-header"] { background-color: ${rgba} !important;\n`;
    if (blurPx > 0) {
      css += `  backdrop-filter: blur(${blurPx}px) saturate(1.5) !important;\n`;
      css += `  -webkit-backdrop-filter: blur(${blurPx}px) saturate(1.5) !important;\n`;
    }
    css += `}\n`;
    css += `[data-testid="chatlist-header"] * { background-color: ${rgba} !important; }\n`;
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  if (s.sidebarColor && !s.sidebarWallpaper) {
    css += `${SEL.sidebarFull} { background-color:${s.sidebarColor}!important; }\n`;
  }
  if (s.sidebarWallpaper) {
    css += `${SEL.sidebarFull} { background-color: transparent !important; }\n`;
    css += `${SEL.leftPanel}   { background-color: transparent !important; }\n`;
    css += `#side > div:not(#pane-side) { background-color: transparent !important; }\n`;
    // Nav strip header + its wrapper div + all descendants → transparent
    css += `div:has(> [data-testid="chatlist-header"]),
            [data-testid="chatlist-header"],
            [data-testid="chatlist-header"] *
            { background-color: transparent !important; background-image: none !important; }\n`;
  }

  // ── Chat cards ────────────────────────────────────────────────────────────
  // CSS layer for initial paint; chatCardObserver handles WA's virtual-list
  // inline-style overrides by watching style attribute mutations on each card.
  {
    const alpha  = (s.chatCardOpacity ?? 100) / 100;
    const base   = s.chatCardBgColor || '#1d1f1f';
    const rgba   = hexToRgba(base, alpha);
    const blurPx = s.chatCardBlurIntensity || 4;
    const doBlur = s.chatCardBlur;
    // Target WA's cell-frame-container and its painted child divs
    css += `[data-testid="cell-frame-container"],
            [data-testid="cell-frame-container"] > div,
            [data-testid="cell-frame-container"] > div > div {
              background-color: ${rgba} !important;
              ${doBlur ? `backdrop-filter: blur(${blurPx}px) !important;
                          -webkit-backdrop-filter: blur(${blurPx}px) !important;` : ''}
            }\n`;
  }

  styleEl.textContent = css;
}

// ---------------------------------------------------------------------------
// BUBBLE COLOUR — inline style injection, per-chat override aware
// ---------------------------------------------------------------------------
function resolvedBubbleSettings(isOut) {
  const cs = currentChatName ? chatSettings[currentChatName] : null;
  const gs = globalSettings;
  const colour  = (isOut ? cs?.outBubbleColor  : cs?.inBubbleColor)
               ?? (isOut ? gs.outBubbleColor    : gs.inBubbleColor);
  const opacity = (isOut ? cs?.outBubbleOpacity : cs?.inBubbleOpacity)
               ?? (isOut ? gs.outBubbleOpacity   : gs.inBubbleOpacity) ?? 100;
  const doBlur  = (isOut ? cs?.blurOutBubble    : cs?.blurInBubble)
               ?? (isOut ? gs.blurOutBubble      : gs.blurInBubble)    ?? false;
  const blurPx  = cs?.bubbleBlurIntensity ?? gs.blurIntensity ?? 8;
  return { colour, opacity, doBlur, blurPx };
}

function findBubbleBgEl(bubbleEl) {
  const known = bubbleEl.querySelector(SEL.bubbleBg);
  if (known) return known;
  for (const el of bubbleEl.querySelectorAll('div')) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return el;
  }
  return null;
}

function stampBubbleColour(bubbleEl) {
  if (!globalSettings.enabled) return;
  const isOut = bubbleEl.classList.contains('message-out');
  const { colour, opacity, doBlur, blurPx } = resolvedBubbleSettings(isOut);
  if (!colour) return;
  const bgEl = findBubbleBgEl(bubbleEl);
  if (!bgEl) return;
  bgEl.style.setProperty('background-color', hexToRgba(colour, opacity / 100), 'important');
  if (doBlur) {
    bgEl.style.setProperty('backdrop-filter',         `blur(${blurPx}px)`, 'important');
    bgEl.style.setProperty('-webkit-backdrop-filter', `blur(${blurPx}px)`, 'important');
  } else {
    bgEl.style.removeProperty('backdrop-filter');
    bgEl.style.removeProperty('-webkit-backdrop-filter');
  }
}

function stampAllVisibleBubbles() {
  document.querySelectorAll('.message-out, .message-in').forEach(stampBubbleColour);
}

function setupBubbleObserver() {
  if (bubbleObserver) { bubbleObserver.disconnect(); bubbleObserver = null; }
  stampAllVisibleBubbles();
  bubbleObserver = new MutationObserver(mutations => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.classList?.contains('message-out') || node.classList?.contains('message-in')) {
          stampBubbleColour(node);
        } else {
          node.querySelectorAll?.('.message-out, .message-in').forEach(stampBubbleColour);
        }
      }
    }
  });
  const panel = document.querySelector(SEL.chatPanel) || document.querySelector(SEL.main) || document.body;
  bubbleObserver.observe(panel, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// CHAT CARD STAMPING
//
// WA's virtual list calls el.style.setProperty('background-color', …, 'important')
// directly on newly rendered cards AFTER DOM insertion, beating CSS !important.
// Fix: MutationObserver that watches BOTH childList (new cards) AND attributes
// (WA's inline style write). We compare the current value to what we want — if
// it already matches, we skip to avoid infinite mutation loops.
// ---------------------------------------------------------------------------
function resolvedChatCardStyle() {
  const s     = globalSettings;
  const alpha = (s.chatCardOpacity ?? 100) / 100;
  const rgba  = hexToRgba(s.chatCardBgColor || '#1d1f1f', alpha);
  const blur  = s.chatCardBlur ? (s.chatCardBlurIntensity || 4) : 0;
  return { rgba, blur };
}

function stampChatCard(el) {
  if (!globalSettings.enabled) return;
  const { rgba, blur } = resolvedChatCardStyle();
  // Stamp the container and direct children (WA spreads bg across multiple divs)
  const targets = [el, ...el.querySelectorAll(':scope > div, :scope > div > div')];
  for (const t of targets) {
    if (t.style.getPropertyValue('background-color') !== rgba) {
      t.style.setProperty('background-color', rgba, 'important');
    }
    if (blur > 0) {
      t.style.setProperty('backdrop-filter',         `blur(${blur}px)`, 'important');
      t.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px)`, 'important');
    } else {
      t.style.removeProperty('backdrop-filter');
      t.style.removeProperty('-webkit-backdrop-filter');
    }
  }
}

function stampAllChatCards() {
  document.querySelectorAll(SEL.chatListItem).forEach(stampChatCard);
}

function setupChatCardObserver() {
  if (chatCardObserver) { chatCardObserver.disconnect(); chatCardObserver = null; }
  stampAllChatCards();

  chatCardObserver = new MutationObserver(mutations => {
    for (const mut of mutations) {
      // New card inserted by virtual list
      if (mut.type === 'childList') {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.(SEL.chatListItem)) {
            stampChatCard(node);
          } else {
            node.querySelectorAll?.(SEL.chatListItem).forEach(stampChatCard);
          }
        }
      }
      // WA stamped its own inline background — override immediately
      if (mut.type === 'attributes' && mut.attributeName === 'style') {
        const el   = mut.target;
        const card = el.closest?.(SEL.chatListItem);
        if (card) stampChatCard(card);
      }
    }
  });

  // Observe the chatlist for new children AND watch existing cards for style changes
  const chatList = document.querySelector(SEL.chatList)
                || document.querySelector(SEL.leftPanel)
                || document.querySelector(SEL.sidebarFull);
  if (!chatList) return;

  // childList+subtree catches new cards; attributes on subtree catches WA's inline writes
  chatCardObserver.observe(chatList, {
    childList:  true,
    subtree:    true,
    attributes: true,
    attributeFilter: ['style'],
  });
}

function reapplyBubbleColours() {
  if (bubbleObserver) { bubbleObserver.disconnect(); bubbleObserver = null; }
  setupBubbleObserver();
}

// ---------------------------------------------------------------------------
// CHAT BACKGROUND (per-chat + global fallback)
// ---------------------------------------------------------------------------
async function applyPerChatBackground(chatName) {
  removeBackgroundOverlay();
  const cs = chatSettings[chatName] || {};

  let wallpaper = null;

  // Per-chat image
  if (cs.wallpaperType === 'image' && cs.wallpaperData) {
    wallpaper = { type: 'image', data: cs.wallpaperData, blur: cs.wallpaperBlur };
  }
  // Per-chat video (new storage-key path)
  else if (cs.wallpaperType === 'video' && cs.wallpaperStorageKey) {
    wallpaper = { type: 'video', storageKey: cs.wallpaperStorageKey, blur: cs.wallpaperBlur };
  }
  // Legacy per-chat video (base64 — will be migrated next load, apply it for now)
  else if (cs.wallpaperType === 'video' && cs.wallpaperData) {
    wallpaper = { type: 'video', data: cs.wallpaperData, blur: cs.wallpaperBlur };
  }
  // Fall back to global
  else if (globalSettings.globalWallpaper) {
    wallpaper = globalSettings.globalWallpaper;
  }

  if (wallpaper) await applyWallpaper(wallpaper);
}

async function applyWallpaper(wallpaper) {
  const mainEl = document.querySelector(SEL.main);
  if (!mainEl) return;
  suppressWABackground(true);

  const overlay = document.createElement('div');
  overlay.id = 'wa-theme-bg-overlay';
  overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;overflow:hidden;pointer-events:none;';

  if (wallpaper.type === 'image') {
    overlay.style.backgroundImage    = `url(${wallpaper.data})`;
    overlay.style.backgroundSize     = 'cover';
    overlay.style.backgroundPosition = 'center';
    overlay.style.backgroundRepeat   = 'no-repeat';
    if (wallpaper.blur) {
      overlay.style.filter    = `blur(${globalSettings.blurIntensity || 8}px)`;
      overlay.style.transform = 'scale(1.05)';
    }
  } else if (wallpaper.type === 'video') {
    // Resolve URL — prefer storageKey path; fall back to legacy data URL
    const storageKey = wallpaper.storageKey || wallpaper.idbKey;
    const url = storageKey ? await getVideoObjectUrl(storageKey) : wallpaper.data;
    if (!url) return;

    const v = document.createElement('video');
    v.src = url; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
      ${wallpaper.blur ? `filter:blur(${globalSettings.blurIntensity || 8}px);transform:scale(1.05);` : ''}`;
    attachVideoHandlers(v, storageKey);
    overlay.appendChild(v);
  }

  mainEl.style.position = 'relative';
  mainEl.style.overflow = 'hidden';
  mainEl.insertBefore(overlay, mainEl.firstChild);
  bgOverlay = overlay;
}

function removeBackgroundOverlay() {
  if (bgOverlay) {
    const v = bgOverlay.querySelector('video');
    if (v) { v.pause(); v.src = ''; v.load(); }
    bgOverlay.remove();
    bgOverlay = null;
  }
  suppressWABackground(false);
}

function suppressWABackground(on) {
  const id = 'wa-theme-bg-suppress';
  document.getElementById(id)?.remove();
  if (!on) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = `${SEL.chatBg}{background-image:none!important;background-color:transparent!important;}`;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// SIDEBAR BACKGROUND — applied to the PARENT of #side
//
// By targeting the parent container (which holds both the left nav strip and #side),
// the wallpaper now covers the full left half of the UI:
//   • The left nav strip   (Chats/Status/Channels icons — sibling of #side)
//   • The chatlist header  (inner header inside #side — made transparent)
//   • The search bar + chat list (inside #side — transparent backgrounds)
//
// For images: background-image set on the container; ::before applies blur/tint.
//   All direct children get z-index:1 to sit above the ::before layer.
//
// For videos: absolutely-positioned div inserted as first child of container.
//   CSS lifts all other children above it via z-index:1.
// ---------------------------------------------------------------------------
async function applySidebarBackground() {
  removeSidebarBackground();
  const wp = globalSettings.sidebarWallpaper;
  if (!wp) return;

  const sideEl = document.querySelector(SEL.sidebarFull);
  if (!sideEl) { console.warn('[WA Themes] #side not found'); return; }

  // Target the PARENT of #side — this contains both #side and the left nav strip
  const container = sideEl.parentElement;
  if (!container) { console.warn('[WA Themes] #side parent not found'); return; }

  const blurPx  = globalSettings.sidebarBlurIntensity || 8;
  const doBlur  = globalSettings.blurSidebar;
  const tintA   = (globalSettings.sidebarTintOpacity ?? 0) / 100;
  const tintCol = globalSettings.sidebarTintColor || '#111b21';

  // Tag the container so our CSS can select it without a stable ID/class
  container.dataset.waThemeContainer = '1';
  sidebarContainerEl = container;

  // Shared transparency CSS — makes every painted layer between the container
  // background and the chat list transparent, so the wallpaper shows through.
  //   • #side and #pane-side        — the main left panel elements
  //   • [data-testid=chatlist-header] and ALL its descendants — nav strip + nested divs
  //   • #side > div:not(#pane-side)  — search bar (48px) and filter tab bar (42px),
  //                                    both are direct #side children with no stable id
  //   • #side header                 — any inner header element inside #side
  const transparencyCss = `
    #side,
    ${SEL.leftPanel},
    div:has(> [data-testid="chatlist-header"]),
    [data-testid="chatlist-header"],
    [data-testid="chatlist-header"] *,
    #side > div:not(#pane-side),
    #side > div:not(#pane-side) *,
    #side header {
      background-color: transparent !important;
      background-image: none !important;
    }
  `;

  if (wp.type === 'image') {
    // Apply background directly on the container — covers full width (nav strip + #side)
    container.style.setProperty('background-image',    `url(${wp.data})`);
    container.style.setProperty('background-size',     'cover');
    container.style.setProperty('background-position', 'center');
    container.style.setProperty('background-repeat',   'no-repeat');

    const st = document.createElement('style');
    st.id = 'wa-theme-sidebar-style';
    st.textContent = `
      [data-wa-theme-container] {
        position: relative !important;
        overflow: hidden !important;
      }
      /* ::before inherits background-image and applies blur/tint on top */
      [data-wa-theme-container]::before {
        content: ''; position: absolute; inset: 0;
        background: inherit; z-index: 0; pointer-events: none;
        ${doBlur ? `filter: blur(${blurPx}px); transform: scale(1.05);` : ''}
        ${tintA > 0 ? `box-shadow: inset 0 0 0 9999px ${hexToRgba(tintCol, tintA)};` : ''}
      }
      /* Lift all direct children above the ::before background layer */
      [data-wa-theme-container] > * { position: relative !important; z-index: 1 !important; }
      ${transparencyCss}
    `;
    document.head.appendChild(st);
    sidebarOverlay = st;

  } else if (wp.type === 'video') {
    const storageKey = wp.storageKey || wp.idbKey;
    const url = storageKey ? await getVideoObjectUrl(storageKey) : wp.data;
    if (!url) return;

    const vidContainer = document.createElement('div');
    vidContainer.id = 'wa-theme-sidebar-video';
    vidContainer.style.cssText = `
      position: absolute; inset: 0;
      z-index: 0; pointer-events: none; overflow: hidden;
    `;

    const v = document.createElement('video');
    v.src = url; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.style.cssText = `width:100%; height:100%; object-fit:cover;
      ${doBlur ? `filter:blur(${blurPx}px); transform:scale(1.05);` : ''}`;
    attachVideoHandlers(v, storageKey);
    vidContainer.appendChild(v);

    if (tintA > 0) {
      const tint = document.createElement('div');
      tint.style.cssText = `position:absolute;inset:0;pointer-events:none;
        background-color:${hexToRgba(tintCol, tintA)};`;
      vidContainer.appendChild(tint);
    }

    container.style.setProperty('position', 'relative', 'important');
    container.style.setProperty('overflow',  'hidden',   'important');
    container.insertBefore(vidContainer, container.firstChild);
    sidebarOverlay = vidContainer;

    const st = document.createElement('style');
    st.id = 'wa-theme-sidebar-style';
    st.textContent = `
      [data-wa-theme-container] > *:not(#wa-theme-sidebar-video) {
        position: relative !important; z-index: 1 !important;
      }
      ${transparencyCss}
    `;
    document.head.appendChild(st);
  }

  console.log('[WA Themes] sidebar wallpaper applied to container (nav+side), type:', wp.type);
}

function removeSidebarBackground() {
  // Remove video container if present
  const vid = document.getElementById('wa-theme-sidebar-video');
  if (vid) {
    const v = vid.querySelector('video');
    if (v) { v.pause(); v.src = ''; v.load(); }
    vid.remove();
  }

  // Remove injected style tag
  document.getElementById('wa-theme-sidebar-style')?.remove();

  // Remove inline background + data attribute from the container (parent of #side)
  if (sidebarContainerEl) {
    sidebarContainerEl.style.removeProperty('background-image');
    sidebarContainerEl.style.removeProperty('background-size');
    sidebarContainerEl.style.removeProperty('background-position');
    sidebarContainerEl.style.removeProperty('background-repeat');
    sidebarContainerEl.style.removeProperty('position');
    sidebarContainerEl.style.removeProperty('overflow');
    delete sidebarContainerEl.dataset.waThemeContainer;
    sidebarContainerEl = null;
  }

  // Also clean up #side itself (v6/v7 leftovers where wallpaper was on #side)
  const sideEl = document.querySelector(SEL.sidebarFull);
  if (sideEl) {
    sideEl.style.removeProperty('background-image');
    sideEl.style.removeProperty('background-size');
    sideEl.style.removeProperty('background-position');
    sideEl.style.removeProperty('background-repeat');
    sideEl.style.removeProperty('position');
    sideEl.style.removeProperty('overflow');
  }

  // Also remove legacy inline styles from #pane-side
  const paneEl = document.querySelector(SEL.leftPanel);
  if (paneEl) {
    paneEl.style.removeProperty('background-image');
    paneEl.style.removeProperty('background-size');
    paneEl.style.removeProperty('background-position');
    paneEl.style.removeProperty('background-repeat');
  }

  // Revoke objectURL if there was one for the sidebar video
  const wp = globalSettings.sidebarWallpaper;
  if (wp?.storageKey) revokeUrl(wp.storageKey);
  if (wp?.idbKey)     revokeUrl(wp.idbKey);

  sidebarOverlay = null;

  // Legacy cleanup
  document.getElementById('wa-theme-sidebar-z')?.remove();
  document.getElementById('wa-theme-sidebar-overlay')?.remove();
}

// ---------------------------------------------------------------------------
// CHAT CHANGE DETECTION — narrowed to #main only, no characterData
// ---------------------------------------------------------------------------
function setupChatObserver() {
  if (chatObserver) chatObserver.disconnect();
  chatObserver = new MutationObserver(() => {
    const titleEl = document.querySelector(SEL.chatTitle);
    if (!titleEl) return;
    const newName = titleEl.innerText?.trim();
    if (newName && newName !== currentChatName) {
      currentChatName = newName;
      console.log('[WA Themes] chat switched to:', currentChatName);
      applyPerChatBackground(currentChatName);
      reapplyBubbleColours();
    }
  });
  // Only observe #main — the chat title lives here; no reason to watch the whole app
  const root = document.querySelector(SEL.main) || document.querySelector('#app') || document.body;
  chatObserver.observe(root, { childList: true, subtree: true }); // no characterData
}

// ---------------------------------------------------------------------------
// THREE-DOT MENU INJECTION (needs to observe body for menu appearance — kept as-is)
// ---------------------------------------------------------------------------
function setupMenuObserver() {
  if (menuObserver) menuObserver.disconnect();
  menuObserver = new MutationObserver(mutations => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const menu = node.matches?.(SEL.dropdownMenu) ? node : node.querySelector?.(SEL.dropdownMenu);
        if (menu) setTimeout(() => tryInjectMenuOption(menu), 80);
      }
    }
  });
  menuObserver.observe(document.body, { childList: true, subtree: true });
}

function tryInjectMenuOption(menuEl) {
  if (!document.querySelector(SEL.header) || !document.querySelector(SEL.chatTitle)) return;
  if (menuEl.querySelector('#wa-theme-menu-item')) return;

  const itemContainer = menuEl.querySelector('div') || menuEl;
  const existingItem  = itemContainer.querySelector('[role="menuitem"]') || itemContainer.querySelector('button');
  if (!existingItem) return;

  const btn = document.createElement('button');
  btn.id = 'wa-theme-menu-item';
  btn.role = 'menuitem';
  btn.className = existingItem.className;
  btn.setAttribute('aria-label', 'Chat Wallpaper');
  btn.style.cssText = 'display:flex;align-items:center;gap:14px;width:100%;cursor:pointer;background:none;border:none;color:inherit;';
  btn.innerHTML = `
    <span style="display:flex;align-items:center;opacity:.65;flex-shrink:0;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 3H3C1.9 3 1 3.9 1 5v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0
                 16H3V5h18v14zm-5-7l-3 3.86L9 10l-4 5h14l-4-5z"/>
      </svg>
    </span>
    <span>Chat Wallpaper</span>
  `;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    setTimeout(() => openChatSettingsModal(currentChatName), 60);
  });

  itemContainer.insertBefore(btn, itemContainer.firstChild);
  console.log('[WA Themes] menu item injected for:', currentChatName);
}

// ---------------------------------------------------------------------------
// PER-CHAT SETTINGS MODAL
// ---------------------------------------------------------------------------
function openChatSettingsModal(chatName) {
  document.getElementById('wa-theme-modal')?.remove();
  if (!chatName) { showToast('No chat open.', 'error'); return; }

  const existing = chatSettings[chatName] || {};
  // pendingWp tracks a newly chosen wallpaper before Save is clicked
  let pendingWpData = null;   // base64 for images; null for videos
  let pendingWpType = null;   // 'image' | 'video' | null
  let pendingWpFile = null;   // File object — only set for videos

  const modal = document.createElement('div');
  modal.id = 'wa-theme-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100000;
    display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    overflow-y:auto;padding:20px 0;
  `;

  const hasExistingWp = existing.wallpaperType && (existing.wallpaperData || existing.wallpaperStorageKey);

  modal.innerHTML = `
    <style>
      @keyframes waTIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
      #wa-tm-inner button:hover{opacity:.85;}
      .wa-tm-section{margin-bottom:18px;}
      .wa-tm-stitle{font-size:11px;font-weight:600;color:#00a884;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:10px;}
      .wa-tm-row{display:flex;align-items:center;justify-content:space-between;
                 gap:8px;margin-bottom:9px;}
      .wa-tm-row label{color:#d1d7db;font-size:13px;flex:1;}
      .wa-tm-range{width:100px;accent-color:#00a884;}
      .wa-tm-rlabel{font-size:11px;color:#8696a0;min-width:34px;text-align:right;}
      .wa-tm-toggle{position:relative;display:inline-block;width:38px;height:21px;flex-shrink:0;}
      .wa-tm-toggle input{opacity:0;width:0;height:0;}
      .wa-tm-slider{position:absolute;cursor:pointer;inset:0;background:#374d58;border-radius:21px;transition:background .25s;}
      .wa-tm-slider::before{content:'';position:absolute;height:15px;width:15px;left:3px;bottom:3px;
                             background:#ccc;border-radius:50%;transition:transform .25s,background .25s;}
      .wa-tm-toggle input:checked+.wa-tm-slider{background:#00a884;}
      .wa-tm-toggle input:checked+.wa-tm-slider::before{transform:translateX(17px);background:white;}
      .wa-tm-bubble-group{background:#172027;border-radius:8px;padding:8px 10px 4px;margin-bottom:10px;}
      .wa-tm-bglabel{font-size:11px;font-weight:600;color:#8696a0;text-transform:uppercase;
                     letter-spacing:.4px;margin-bottom:8px;}
    </style>

    <div id="wa-tm-inner" style="
      background:#1f2c33;border-radius:14px;padding:24px 26px 22px;
      width:460px;max-width:94vw;color:#e9edef;
      box-shadow:0 24px 72px rgba(0,0,0,.6);animation:waTIn .18s ease;
    ">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
        <div>
          <div style="font-size:17px;font-weight:600;margin-bottom:3px;">Chat Settings</div>
          <div style="font-size:12px;color:#8696a0;max-width:280px;
                      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(chatName)}</div>
        </div>
        <button id="wa-modal-close" style="background:none;border:none;color:#8696a0;
                font-size:20px;cursor:pointer;padding:0 0 0 12px;">✕</button>
      </div>

      <!-- WALLPAPER -->
      <div class="wa-tm-section">
        <div class="wa-tm-stitle">🖼️ Wallpaper</div>
        <div id="wa-modal-preview" style="
          width:100%;height:130px;border-radius:10px;background:#2a3942;
          margin-bottom:12px;overflow:hidden;position:relative;
          display:flex;align-items:center;justify-content:center;color:#8696a0;font-size:13px;
        ">${hasExistingWp ? '' : 'No wallpaper set'}</div>
        <div style="display:flex;gap:9px;margin-bottom:10px;">
          <button id="wa-btn-img" style="flex:1;padding:9px;border-radius:8px;border:1px solid #374d58;
            background:#2a3942;color:#e9edef;cursor:pointer;font-size:12px;">📷 Image</button>
          <button id="wa-btn-vid" style="flex:1;padding:9px;border-radius:8px;border:1px solid #374d58;
            background:#2a3942;color:#e9edef;cursor:pointer;font-size:12px;">🎬 Video</button>
          ${hasExistingWp ? `
          <button id="wa-btn-wp-remove" style="padding:9px 13px;border-radius:8px;
            border:1px solid #374d58;background:transparent;color:#8696a0;cursor:pointer;font-size:12px;">✕</button>` : ''}
        </div>
        <input type="file" id="wa-file-img" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">
        <input type="file" id="wa-file-vid" accept="video/mp4,video/webm" style="display:none">
        <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:12px;
                       color:#d1d7db;margin-bottom:4px;">
          <input type="checkbox" id="wa-opt-blur" ${existing.wallpaperBlur ? 'checked' : ''} style="accent-color:#00a884;">
          Blur this wallpaper
        </label>
      </div>

      <!-- BUBBLE OVERRIDES -->
      <div class="wa-tm-section">
        <div class="wa-tm-stitle">💬 Bubble Overrides <span style="font-size:10px;color:#8696a0;text-transform:none;font-weight:400;">(leave blank = use global)</span></div>

        <div class="wa-tm-bubble-group">
          <div class="wa-tm-bglabel">↑ Your messages</div>
          <div class="wa-tm-row">
            <label>Enable override</label>
            <label class="wa-tm-toggle">
              <input type="checkbox" id="wa-out-override" ${existing.outBubbleColor ? 'checked' : ''}>
              <span class="wa-tm-slider"></span>
            </label>
          </div>
          <div id="wa-out-controls" style="${existing.outBubbleColor ? '' : 'opacity:.35;pointer-events:none;'}">
            <div class="wa-tm-row">
              <label>Colour</label>
              <input type="color" id="wa-out-color" value="${existing.outBubbleColor || '#144d37'}"
                style="width:36px;height:26px;border:1px solid #374d58;border-radius:6px;
                       background:#2a3942;cursor:pointer;flex-shrink:0;">
            </div>
            <div class="wa-tm-row">
              <label>Opacity</label>
              <input type="range" id="wa-out-opacity" class="wa-tm-range"
                min="0" max="100" value="${existing.outBubbleOpacity ?? 100}" step="1">
              <span class="wa-tm-rlabel"><span id="wa-out-opval">${existing.outBubbleOpacity ?? 100}</span>%</span>
            </div>
            <div class="wa-tm-row">
              <label>Blur / glass</label>
              <label class="wa-tm-toggle">
                <input type="checkbox" id="wa-out-blur" ${existing.blurOutBubble ? 'checked' : ''}>
                <span class="wa-tm-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="wa-tm-bubble-group">
          <div class="wa-tm-bglabel">↓ Their messages</div>
          <div class="wa-tm-row">
            <label>Enable override</label>
            <label class="wa-tm-toggle">
              <input type="checkbox" id="wa-in-override" ${existing.inBubbleColor ? 'checked' : ''}>
              <span class="wa-tm-slider"></span>
            </label>
          </div>
          <div id="wa-in-controls" style="${existing.inBubbleColor ? '' : 'opacity:.35;pointer-events:none;'}">
            <div class="wa-tm-row">
              <label>Colour</label>
              <input type="color" id="wa-in-color" value="${existing.inBubbleColor || '#242626'}"
                style="width:36px;height:26px;border:1px solid #374d58;border-radius:6px;
                       background:#2a3942;cursor:pointer;flex-shrink:0;">
            </div>
            <div class="wa-tm-row">
              <label>Opacity</label>
              <input type="range" id="wa-in-opacity" class="wa-tm-range"
                min="0" max="100" value="${existing.inBubbleOpacity ?? 100}" step="1">
              <span class="wa-tm-rlabel"><span id="wa-in-opval">${existing.inBubbleOpacity ?? 100}</span>%</span>
            </div>
            <div class="wa-tm-row">
              <label>Blur / glass</label>
              <label class="wa-tm-toggle">
                <input type="checkbox" id="wa-in-blur" ${existing.blurInBubble ? 'checked' : ''}>
                <span class="wa-tm-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="wa-tm-row" style="padding-top:6px;border-top:1px solid #2a3942;margin-top:4px;">
          <label>Blur intensity <span style="font-size:10px;color:#8696a0">(this chat)</span></label>
          <input type="range" id="wa-bubble-blur-px" class="wa-tm-range"
            min="2" max="30" value="${existing.bubbleBlurIntensity || 8}" step="1">
          <span class="wa-tm-rlabel"><span id="wa-blur-pxval">${existing.bubbleBlurIntensity || 8}</span>px</span>
        </div>
      </div>

      <!-- ACTIONS -->
      <div style="display:flex;gap:10px;">
        <button id="wa-btn-save" style="flex:1;padding:11px;border-radius:8px;border:none;
          background:#00a884;color:white;cursor:pointer;font-size:14px;font-weight:600;">Save</button>
        ${Object.keys(existing).length ? `
        <button id="wa-btn-remove-all" style="padding:11px 14px;border-radius:8px;
          border:1px solid #ea0038;background:transparent;color:#ea0038;cursor:pointer;font-size:12px;">
          Remove All</button>` : ''}
        <button id="wa-btn-cancel" style="padding:11px 14px;border-radius:8px;
          border:1px solid #374d58;background:transparent;color:#8696a0;cursor:pointer;font-size:12px;">
          Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Pre-fill existing wallpaper preview
  if (hasExistingWp) {
    if (existing.wallpaperType === 'video' && existing.wallpaperStorageKey) {
      // Async preview for storage-key videos
      getVideoObjectUrl(existing.wallpaperStorageKey).then(url => {
        if (url) renderModalPreview(modal, 'video', url);
      });
    } else if (existing.wallpaperData) {
      renderModalPreview(modal, existing.wallpaperType, existing.wallpaperData);
    }
  }

  // Override toggles
  modal.querySelector('#wa-out-override').addEventListener('change', e => {
    modal.querySelector('#wa-out-controls').style.cssText =
      e.target.checked ? '' : 'opacity:.35;pointer-events:none;';
  });
  modal.querySelector('#wa-in-override').addEventListener('change', e => {
    modal.querySelector('#wa-in-controls').style.cssText =
      e.target.checked ? '' : 'opacity:.35;pointer-events:none;';
  });

  // Live range labels
  modal.querySelector('#wa-out-opacity').addEventListener('input',   e => modal.querySelector('#wa-out-opval').textContent  = e.target.value);
  modal.querySelector('#wa-in-opacity').addEventListener('input',    e => modal.querySelector('#wa-in-opval').textContent   = e.target.value);
  modal.querySelector('#wa-bubble-blur-px').addEventListener('input', e => modal.querySelector('#wa-blur-pxval').textContent = e.target.value);

  // Upload buttons
  modal.querySelector('#wa-btn-img').addEventListener('click', () => modal.querySelector('#wa-file-img').click());
  modal.querySelector('#wa-btn-vid').addEventListener('click', () => modal.querySelector('#wa-file-vid').click());

  // Image upload — read as data URL for storage (images are small, base64 is fine)
  modal.querySelector('#wa-file-img').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      pendingWpData = ev.target.result;
      pendingWpType = 'image';
      pendingWpFile = null;
      renderModalPreview(modal, 'image', pendingWpData);
    };
    r.readAsDataURL(f);
  });

  // Video upload — keep File reference; preview via objectURL; save as ArrayBuffer on Save
  modal.querySelector('#wa-file-vid').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    pendingWpType = 'video';
    pendingWpFile = f;
    pendingWpData = null; // not needed for videos
    const previewUrl = URL.createObjectURL(f);
    renderModalPreview(modal, 'video', previewUrl);
    // Preview URL will be GC'd when modal closes — no need to track
  });

  // Remove wallpaper
  modal.querySelector('#wa-btn-wp-remove')?.addEventListener('click', () => {
    pendingWpData = null; pendingWpType = '__removed__'; pendingWpFile = null;
    modal.querySelector('#wa-modal-preview').innerHTML = 'No wallpaper set';
  });

  // Save
  modal.querySelector('#wa-btn-save').addEventListener('click', async () => {
    const outOverride = modal.querySelector('#wa-out-override').checked;
    const inOverride  = modal.querySelector('#wa-in-override').checked;

    let finalWpType        = existing.wallpaperType        || null;
    let finalWpData        = existing.wallpaperData        || null;
    let finalWpStorageKey  = existing.wallpaperStorageKey  || null;

    if (pendingWpType === '__removed__') {
      // User explicitly removed wallpaper
      if (existing.wallpaperStorageKey) {
        await chrome.storage.local.remove(existing.wallpaperStorageKey);
        revokeUrl(existing.wallpaperStorageKey);
      }
      finalWpType = null; finalWpData = null; finalWpStorageKey = null;

    } else if (pendingWpType === 'image') {
      // Replace with image — clean up any old video key
      if (existing.wallpaperStorageKey) {
        await chrome.storage.local.remove(existing.wallpaperStorageKey);
        revokeUrl(existing.wallpaperStorageKey);
      }
      finalWpType = 'image'; finalWpData = pendingWpData; finalWpStorageKey = null;

    } else if (pendingWpType === 'video' && pendingWpFile) {
      // New video upload — save as Uint8Array, reuse existing storage key if already a video
      const key = finalWpStorageKey || `wa_vid_chat_${genId()}`;
      try {
        const ab = await pendingWpFile.arrayBuffer();
        await chrome.storage.local.set({ [key]: new Uint8Array(ab) });
        revokeUrl(key); // revoke stale objectURL for this key (if any)
        finalWpType = 'video'; finalWpData = null; finalWpStorageKey = key;
      } catch (err) {
        showToast('Failed to save video — try a smaller file.', 'error');
        console.error('[WA Themes] Video save error:', err);
        return;
      }
    }
    // else: pendingWpType is null → keep existing unchanged

    const payload = {
      wallpaperType:       finalWpType,
      wallpaperData:       finalWpData,
      wallpaperStorageKey: finalWpStorageKey,
      wallpaperBlur:       modal.querySelector('#wa-opt-blur').checked,
      outBubbleColor:      outOverride ? modal.querySelector('#wa-out-color').value          : null,
      outBubbleOpacity:    outOverride ? parseInt(modal.querySelector('#wa-out-opacity').value) : null,
      blurOutBubble:       outOverride ? modal.querySelector('#wa-out-blur').checked          : null,
      inBubbleColor:       inOverride  ? modal.querySelector('#wa-in-color').value           : null,
      inBubbleOpacity:     inOverride  ? parseInt(modal.querySelector('#wa-in-opacity').value)  : null,
      blurInBubble:        inOverride  ? modal.querySelector('#wa-in-blur').checked           : null,
      bubbleBlurIntensity: parseInt(modal.querySelector('#wa-bubble-blur-px').value),
    };

    const hasAnything = payload.wallpaperData || payload.wallpaperStorageKey
                     || payload.outBubbleColor || payload.inBubbleColor;
    if (!hasAnything) { showToast('Nothing to save — set a wallpaper or bubble override first.', 'error'); return; }

    await persistChatSettings(chatName, payload);
    if (chatName === currentChatName) {
      await applyPerChatBackground(chatName);
      reapplyBubbleColours();
    }
    modal.remove();
    showToast('Chat settings saved ✓');
  });

  // Remove ALL settings for this chat
  modal.querySelector('#wa-btn-remove-all')?.addEventListener('click', async () => {
    await deleteChatSettings(chatName);
    if (chatName === currentChatName) {
      removeBackgroundOverlay();
      reapplyBubbleColours();
    }
    modal.remove();
    showToast('Chat settings removed.');
  });

  // Close
  const close = () => modal.remove();
  modal.querySelector('#wa-modal-close').addEventListener('click', close);
  modal.querySelector('#wa-btn-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

function renderModalPreview(modal, type, data) {
  const p = modal.querySelector('#wa-modal-preview');
  p.innerHTML = '';
  const el = type === 'video' ? document.createElement('video') : document.createElement('img');
  if (type === 'video') { el.autoplay = true; el.loop = true; el.muted = true; el.playsInline = true; }
  el.src = data;
  el.style.cssText = 'width:100%;height:100%;object-fit:cover;';
  p.appendChild(el);
}

// ---------------------------------------------------------------------------
// TOAST
// ---------------------------------------------------------------------------
function showToast(message, type = 'success') {
  document.getElementById('wa-theme-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'wa-theme-toast';
  const bg = type === 'error' ? '#ea0038' : type === 'warn' ? '#f0ad00' : '#00a884';
  toast.style.cssText = `
    position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
    background:${bg};color:white;padding:10px 20px;border-radius:20px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;font-weight:500;z-index:200000;
    box-shadow:0 4px 16px rgba(0,0,0,.3);pointer-events:none;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ---------------------------------------------------------------------------
// MESSAGE LISTENER + STORAGE WATCHER
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SETTINGS_UPDATED') {
    loadStorage().then(async () => {
      applyGlobalCSS();
      reapplyBubbleColours();
      stampAllChatCards();
      setupChatCardObserver();
      if (currentChatName) await applyPerChatBackground(currentChatName);
      await applySidebarBackground();
      console.log('[WA Themes] settings refreshed via message');
    });
    sendResponse({ ok: true }); return true;
  }
  if (msg.type === 'GET_CURRENT_CHAT') {
    sendResponse({ chatName: currentChatName }); return true;
  }
});

// Backup: watch storage directly — fires even if message passing fails.
// Debounced 200ms so rapid successive saves don't cause multiple full reapplies.
const _debouncedStorageRefresh = debounce(async () => {
  console.log('[WA Themes] storage changed — reapplying');
  await loadStorage();
  applyGlobalCSS();
  reapplyBubbleColours();
  stampAllChatCards();
  setupChatCardObserver();
  if (currentChatName) await applyPerChatBackground(currentChatName);
  await applySidebarBackground();
}, 200);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.globalSettings && !changes.chatWallpapers) return;
  _debouncedStorageRefresh();
});

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------
async function init() {
  try {
    console.log('[WA Themes] init() running...');
    await loadStorage();
    await migrateBase64Videos();  // no-op if nothing to migrate

    applyGlobalCSS();

    const titleEl = document.querySelector(SEL.chatTitle);
    if (titleEl) {
      currentChatName = titleEl.innerText?.trim() || null;
      if (currentChatName) await applyPerChatBackground(currentChatName);
    }

    setupBubbleObserver();
    setupChatCardObserver();
    setupChatObserver();
    setupMenuObserver();
    await applySidebarBackground();
    console.log('[WA Themes] all systems running ✅');
  } catch (err) {
    console.error('[WA Themes] ❌ init() crashed:', err);
  }
}

function tryBoot() {
  if (document.querySelector(SEL.main) || document.querySelector(SEL.leftPanel)) {
    console.log('[WA Themes] DOM ready — booting');
    init(); return true;
  }
  return false;
}

if (!tryBoot()) {
  const bo = new MutationObserver(() => { if (tryBoot()) bo.disconnect(); });
  bo.observe(document.body, { childList: true, subtree: true });
}
