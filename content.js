// =============================================================================
// WhatsApp Themes — content.js v6
// =============================================================================
console.log('[WA Themes] ✅ content.js v6 loaded at', new Date().toISOString());

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
  // sidebarFull = full left panel incl. header/search bar (position:relative overflow:hidden)
  // leftPanel   = only the scrolling chat list inside it — DO NOT break overflow:auto on this
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
let chatSettings     = {};   // { [chatName]: { wallpaperType, wallpaperData, wallpaperBlur,
                             //                 outBubbleColor, outBubbleOpacity, blurOutBubble,
                             //                 inBubbleColor,  inBubbleOpacity,  blurInBubble,
                             //                 bubbleBlurIntensity } }
let styleEl          = null;
let bgOverlay        = null;
let sidebarOverlay   = null;
let menuObserver     = null;
let chatObserver     = null;
let bubbleObserver   = null;

// ---------------------------------------------------------------------------
// DEFAULTS
// ---------------------------------------------------------------------------
function getDefaults() {
  return {
    enabled:              true,
    outBubbleColor:       '#144d37',
    outBubbleOpacity:     100,
    blurOutBubble:        false,
    inBubbleColor:        '#242626',
    inBubbleOpacity:      100,
    blurInBubble:         false,
    blurIntensity:        8,
    fontFamily:           null,
    fontSize:             null,
    headerColor:          null,
    globalWallpaper:      null,
    sidebarWallpaper:     null,
    sidebarTintColor:     '#111b21',
    sidebarTintOpacity:   0,
    blurSidebar:          false,
    sidebarBlurIntensity: 8,
    sidebarColor:         null,
    chatListBgColor:      '#1d1f1f',
    chatListOpacity:      100,
  };
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

async function persistChatSettings(chatName, data) {
  chatSettings[chatName] = data;
  return chrome.storage.local.set({ chatWallpapers: chatSettings });
}
async function deleteChatSettings(chatName) {
  delete chatSettings[chatName];
  return chrome.storage.local.set({ chatWallpapers: chatSettings });
}

// ---------------------------------------------------------------------------
// UTILITY
// ---------------------------------------------------------------------------
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function escapeHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---------------------------------------------------------------------------
// GLOBAL CSS (font, header, sidebar solid colour only — bubbles done inline)
// ---------------------------------------------------------------------------
function applyGlobalCSS() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'wa-theme-global-style';
    document.head.appendChild(styleEl);
  }
  if (!globalSettings.enabled) { styleEl.textContent = ''; return; }

  const s = globalSettings;
  let css = '/* WA Themes v6 */\n';

  if (s.fontFamily) {
    css += `${SEL.chatPanel} .copyable-text,
            ${SEL.chatPanel} span[dir="ltr"],
            ${SEL.chatPanel} span[dir="auto"] { font-family:${s.fontFamily}!important; }\n`;
  }
  if (s.fontSize) {
    css += `${SEL.chatPanel} .copyable-text { font-size:${s.fontSize}px!important; line-height:1.4!important; }\n`;
  }
  if (s.headerColor) {
    css += `${SEL.header}         { background-color:${s.headerColor}!important; }\n`;
    css += `${SEL.chatlistHeader} { background-color:${s.headerColor}!important; }\n`;
  }
  if (s.sidebarColor && !s.sidebarWallpaper) {
    css += `${SEL.leftPanel} { background-color:${s.sidebarColor}!important; }\n`;
  }

  // Chat card transparency — targets the cell container AND the inner content
  // wrapper where WA applies the actual surface colour.
  // ._ak73 = currently selected chat (has its own bg on the container).
  // Non-selected items carry their bg on an inner child div.
  // We target both levels with !important to win the specificity fight.
  if ((s.chatListOpacity ?? 100) < 100 || s.chatListBgColor) {
    const alpha = (s.chatListOpacity ?? 100) / 100;
    const base  = s.chatListBgColor || '#1d1f1f';
    const rgba  = hexToRgba(base, alpha);
    css += `
      [data-testid="cell-frame-container"],
      [data-testid="cell-frame-container"] > div,
      [data-testid="cell-frame-container"] > div > div {
        background-color: ${rgba} !important;
      }
    \n`;
  }

  styleEl.textContent = css;
}

// ---------------------------------------------------------------------------
// BUBBLE COLOUR — inline style injection, per-chat override aware
// ---------------------------------------------------------------------------
function resolvedBubbleSettings(isOut) {
  const cs  = currentChatName ? chatSettings[currentChatName] : null;
  const gs  = globalSettings;

  // Per-chat values win over global if set (non-null)
  const colour  = (isOut ? cs?.outBubbleColor  : cs?.inBubbleColor)
               ?? (isOut ? gs.outBubbleColor    : gs.inBubbleColor);
  const opacity = (isOut ? cs?.outBubbleOpacity : cs?.inBubbleOpacity)
               ?? (isOut ? gs.outBubbleOpacity   : gs.inBubbleOpacity)
               ?? 100;
  const doBlur  = (isOut ? cs?.blurOutBubble    : cs?.blurInBubble)
               ?? (isOut ? gs.blurOutBubble      : gs.blurInBubble)
               ?? false;
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
  if (bubbleObserver) bubbleObserver.disconnect();
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

function reapplyBubbleColours() {
  if (bubbleObserver) { bubbleObserver.disconnect(); bubbleObserver = null; }
  setupBubbleObserver();
}

// ---------------------------------------------------------------------------
// CHAT BACKGROUND (per-chat + global fallback)
// ---------------------------------------------------------------------------
function applyPerChatBackground(chatName) {
  removeBackgroundOverlay();
  const cs = chatSettings[chatName] || {};
  // Per-chat wallpaper takes priority over global
  const hasPerChat = cs.wallpaperType && cs.wallpaperData;
  const wallpaper  = hasPerChat
    ? { type: cs.wallpaperType, data: cs.wallpaperData, blur: cs.wallpaperBlur }
    : globalSettings.globalWallpaper || null;
  if (wallpaper) applyWallpaper(wallpaper);
}

function applyWallpaper(wallpaper) {
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
    const v = document.createElement('video');
    v.src=wallpaper.data; v.autoplay=true; v.loop=true; v.muted=true; v.playsInline=true;
    v.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
      ${wallpaper.blur ? `filter:blur(${globalSettings.blurIntensity||8}px);transform:scale(1.05);` : ''}`;
    overlay.appendChild(v);
  }

  mainEl.style.position = 'relative';
  mainEl.style.overflow = 'hidden';
  mainEl.insertBefore(overlay, mainEl.firstChild);
  bgOverlay = overlay;
}

function removeBackgroundOverlay() {
  bgOverlay?.remove(); bgOverlay = null;
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
// SIDEBAR BACKGROUND
// KEY INSIGHT: position:absolute overlays inside overflow:auto scroll WITH
// the content. Fix:
//   - Images  → apply background-image directly on #pane-side. CSS backgrounds
//               on an element are fixed to the element's box, not scrollable.
//               Blur via injected ::before pseudo-element rule.
//   - Video   → position:sticky + negative margin trick keeps it in viewport
//               while the list scrolls over it.
// No stacking CSS, no overflow mutation, no scroll breakage.
// ---------------------------------------------------------------------------
function applySidebarBackground() {
  removeSidebarBackground();
  const wp = globalSettings.sidebarWallpaper;
  if (!wp) return;

  const pane = document.querySelector(SEL.leftPanel);
  if (!pane) { console.warn('[WA Themes] #pane-side not found'); return; }

  const blurPx  = globalSettings.sidebarBlurIntensity || 8;
  const doBlur  = globalSettings.blurSidebar;
  const tintA   = (globalSettings.sidebarTintOpacity ?? 0) / 100;
  const tintCol = globalSettings.sidebarTintColor || '#111b21';

  if (wp.type === 'image') {
    // Apply directly on pane — CSS bg never scrolls with content
    pane.style.setProperty('background-image',    `url(${wp.data})`);
    pane.style.setProperty('background-size',     'cover');
    pane.style.setProperty('background-position', 'center');
    pane.style.setProperty('background-repeat',   'no-repeat');

    // Blur + tint: inject a ::before rule (can't blur inline bg directly)
    const styleEl = document.createElement('style');
    styleEl.id = 'wa-theme-sidebar-style';
    styleEl.textContent = `
      #pane-side { position: relative !important; }
      #pane-side::before {
        content: '';
        position: absolute; inset: 0;
        background: inherit;
        z-index: 0; pointer-events: none;
        ${doBlur ? `filter: blur(${blurPx}px); transform: scale(1.05);` : ''}
        ${tintA > 0 ? `box-shadow: inset 0 0 0 9999px ${hexToRgba(tintCol, tintA)};` : ''}
      }
      #pane-side > *:not(#wa-theme-sidebar-video) {
        position: relative !important; z-index: 1 !important;
      }
    `;
    document.head.appendChild(styleEl);
    sidebarOverlay = styleEl;   // track for cleanup

  } else if (wp.type === 'video') {
    // Sticky trick: the wrapper sticks at top:0 while list scrolls over it.
    // margin-bottom: -height collapses it out of flow so it doesn't push content.
    const h = pane.clientHeight || 500;
    const sticky = document.createElement('div');
    sticky.id = 'wa-theme-sidebar-video';
    sticky.style.cssText = `
      position: sticky; top: 0;
      height: ${h}px; margin-bottom: -${h}px;
      z-index: 0; pointer-events: none; overflow: hidden; flex-shrink: 0;
    `;

    const v = document.createElement('video');
    v.src=wp.data; v.autoplay=true; v.loop=true; v.muted=true; v.playsInline=true;
    v.style.cssText = `
      width:100%; height:100%; object-fit:cover;
      ${doBlur ? `filter:blur(${blurPx}px); transform:scale(1.05);` : ''}
    `;
    sticky.appendChild(v);

    if (tintA > 0) {
      const tint = document.createElement('div');
      tint.style.cssText = `position:absolute;inset:0;pointer-events:none;
        background-color:${hexToRgba(tintCol, tintA)};`;
      sticky.appendChild(tint);
    }

    pane.insertBefore(sticky, pane.firstChild);
    sidebarOverlay = sticky;

    // Lift pane's other children above the video
    const liftStyle = document.createElement('style');
    liftStyle.id = 'wa-theme-sidebar-style';
    liftStyle.textContent = `
      #pane-side > *:not(#wa-theme-sidebar-video) {
        position: relative !important; z-index: 1 !important;
      }
    `;
    document.head.appendChild(liftStyle);
  }

  console.log('[WA Themes] sidebar wallpaper applied, type:', wp.type);
}

function removeSidebarBackground() {
  // Remove sticky video element if present
  document.getElementById('wa-theme-sidebar-video')?.remove();
  // Remove style tag (blur/tint/lift CSS)
  document.getElementById('wa-theme-sidebar-style')?.remove();
  // Remove inline bg from pane if image was applied
  const pane = document.querySelector(SEL.leftPanel);
  if (pane) {
    pane.style.removeProperty('background-image');
    pane.style.removeProperty('background-size');
    pane.style.removeProperty('background-position');
    pane.style.removeProperty('background-repeat');
  }
  sidebarOverlay = null;
  // Clean up any legacy IDs from older versions
  document.getElementById('wa-theme-sidebar-z')?.remove();
  document.getElementById('wa-theme-sidebar-overlay')?.remove();
}

// ---------------------------------------------------------------------------
// CHAT CHANGE DETECTION
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
  const root = document.querySelector('#app') || document.body;
  chatObserver.observe(root, { childList: true, subtree: true, characterData: true });
}

// ---------------------------------------------------------------------------
// THREE-DOT MENU INJECTION
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
// PER-CHAT SETTINGS MODAL (wallpaper + bubble overrides)
// ---------------------------------------------------------------------------
function openChatSettingsModal(chatName) {
  document.getElementById('wa-theme-modal')?.remove();
  if (!chatName) { showToast('No chat open.', 'error'); return; }

  const existing = chatSettings[chatName] || {};
  let pendingWpData = null, pendingWpType = null;

  const modal = document.createElement('div');
  modal.id = 'wa-theme-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100000;
    display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    overflow-y:auto;padding:20px 0;
  `;

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
      <!-- Header -->
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
        ">${(existing.wallpaperType && existing.wallpaperData) ? '' : 'No wallpaper set'}</div>
        <div style="display:flex;gap:9px;margin-bottom:10px;">
          <button id="wa-btn-img" style="flex:1;padding:9px;border-radius:8px;border:1px solid #374d58;
            background:#2a3942;color:#e9edef;cursor:pointer;font-size:12px;">📷 Image</button>
          <button id="wa-btn-vid" style="flex:1;padding:9px;border-radius:8px;border:1px solid #374d58;
            background:#2a3942;color:#e9edef;cursor:pointer;font-size:12px;">🎬 Video</button>
          ${(existing.wallpaperType && existing.wallpaperData) ? `
          <button id="wa-btn-wp-remove" style="padding:9px 13px;border-radius:8px;
            border:1px solid #374d58;background:transparent;color:#8696a0;cursor:pointer;font-size:12px;">✕</button>` : ''}
        </div>
        <input type="file" id="wa-file-img" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">
        <input type="file" id="wa-file-vid" accept="video/mp4,video/webm" style="display:none">
        <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:12px;
                       color:#d1d7db;margin-bottom:4px;">
          <input type="checkbox" id="wa-opt-blur" ${existing.wallpaperBlur?'checked':''} style="accent-color:#00a884;">
          Blur this wallpaper
        </label>
      </div>

      <!-- BUBBLE OVERRIDES -->
      <div class="wa-tm-section">
        <div class="wa-tm-stitle">💬 Bubble Overrides <span style="font-size:10px;color:#8696a0;text-transform:none;font-weight:400;">(leave blank = use global)</span></div>

        <!-- OUT BUBBLE -->
        <div class="wa-tm-bubble-group">
          <div class="wa-tm-bglabel">↑ Your messages</div>
          <div class="wa-tm-row">
            <label>Enable override</label>
            <label class="wa-tm-toggle">
              <input type="checkbox" id="wa-out-override" ${existing.outBubbleColor?'checked':''}>
              <span class="wa-tm-slider"></span>
            </label>
          </div>
          <div id="wa-out-controls" style="${existing.outBubbleColor?'':'opacity:.35;pointer-events:none;'}">
            <div class="wa-tm-row">
              <label>Colour</label>
              <input type="color" id="wa-out-color" value="${existing.outBubbleColor||'#144d37'}"
                style="width:36px;height:26px;border:1px solid #374d58;border-radius:6px;
                       background:#2a3942;cursor:pointer;flex-shrink:0;">
            </div>
            <div class="wa-tm-row">
              <label>Opacity</label>
              <input type="range" id="wa-out-opacity" class="wa-tm-range"
                min="0" max="100" value="${existing.outBubbleOpacity??100}" step="1">
              <span class="wa-tm-rlabel"><span id="wa-out-opval">${existing.outBubbleOpacity??100}</span>%</span>
            </div>
            <div class="wa-tm-row">
              <label>Blur / glass</label>
              <label class="wa-tm-toggle">
                <input type="checkbox" id="wa-out-blur" ${existing.blurOutBubble?'checked':''}>
                <span class="wa-tm-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- IN BUBBLE -->
        <div class="wa-tm-bubble-group">
          <div class="wa-tm-bglabel">↓ Their messages</div>
          <div class="wa-tm-row">
            <label>Enable override</label>
            <label class="wa-tm-toggle">
              <input type="checkbox" id="wa-in-override" ${existing.inBubbleColor?'checked':''}>
              <span class="wa-tm-slider"></span>
            </label>
          </div>
          <div id="wa-in-controls" style="${existing.inBubbleColor?'':'opacity:.35;pointer-events:none;'}">
            <div class="wa-tm-row">
              <label>Colour</label>
              <input type="color" id="wa-in-color" value="${existing.inBubbleColor||'#242626'}"
                style="width:36px;height:26px;border:1px solid #374d58;border-radius:6px;
                       background:#2a3942;cursor:pointer;flex-shrink:0;">
            </div>
            <div class="wa-tm-row">
              <label>Opacity</label>
              <input type="range" id="wa-in-opacity" class="wa-tm-range"
                min="0" max="100" value="${existing.inBubbleOpacity??100}" step="1">
              <span class="wa-tm-rlabel"><span id="wa-in-opval">${existing.inBubbleOpacity??100}</span>%</span>
            </div>
            <div class="wa-tm-row">
              <label>Blur / glass</label>
              <label class="wa-tm-toggle">
                <input type="checkbox" id="wa-in-blur" ${existing.blurInBubble?'checked':''}>
                <span class="wa-tm-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Shared blur intensity for this chat -->
        <div class="wa-tm-row" style="padding-top:6px;border-top:1px solid #2a3942;margin-top:4px;">
          <label>Blur intensity <span style="font-size:10px;color:#8696a0">(this chat)</span></label>
          <input type="range" id="wa-bubble-blur-px" class="wa-tm-range"
            min="2" max="30" value="${existing.bubbleBlurIntensity||8}" step="1">
          <span class="wa-tm-rlabel"><span id="wa-blur-pxval">${existing.bubbleBlurIntensity||8}</span>px</span>
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

  // Pre-fill wallpaper preview
  if (existing.wallpaperType && existing.wallpaperData) {
    renderModalPreview(modal, existing.wallpaperType, existing.wallpaperData);
  }

  // Override toggles enable/disable their control groups
  modal.querySelector('#wa-out-override').addEventListener('change', e => {
    modal.querySelector('#wa-out-controls').style.cssText =
      e.target.checked ? '' : 'opacity:.35;pointer-events:none;';
  });
  modal.querySelector('#wa-in-override').addEventListener('change', e => {
    modal.querySelector('#wa-in-controls').style.cssText =
      e.target.checked ? '' : 'opacity:.35;pointer-events:none;';
  });

  // Live range labels
  modal.querySelector('#wa-out-opacity').addEventListener('input', e =>
    modal.querySelector('#wa-out-opval').textContent = e.target.value);
  modal.querySelector('#wa-in-opacity').addEventListener('input', e =>
    modal.querySelector('#wa-in-opval').textContent = e.target.value);
  modal.querySelector('#wa-bubble-blur-px').addEventListener('input', e =>
    modal.querySelector('#wa-blur-pxval').textContent = e.target.value);

  // File uploads
  modal.querySelector('#wa-btn-img').addEventListener('click', () => modal.querySelector('#wa-file-img').click());
  modal.querySelector('#wa-btn-vid').addEventListener('click', () => modal.querySelector('#wa-file-vid').click());

  modal.querySelector('#wa-file-img').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readFileAsDataURL(f, data => { pendingWpData=data; pendingWpType='image'; renderModalPreview(modal,'image',data); });
  });
  modal.querySelector('#wa-file-vid').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    readFileAsDataURL(f, data => { pendingWpData=data; pendingWpType='video'; renderModalPreview(modal,'video',data); });
  });

  // Remove wallpaper only
  modal.querySelector('#wa-btn-wp-remove')?.addEventListener('click', () => {
    pendingWpData = null; pendingWpType = null;
    modal.querySelector('#wa-modal-preview').innerHTML = 'No wallpaper set';
  });

  // Save
  modal.querySelector('#wa-btn-save').addEventListener('click', async () => {
    const outOverride = modal.querySelector('#wa-out-override').checked;
    const inOverride  = modal.querySelector('#wa-in-override').checked;

    const payload = {
      // Wallpaper — use pending upload, or keep existing, or null
      wallpaperType: pendingWpType  || (pendingWpData === null && !existing.wallpaperData ? null : existing.wallpaperType) || null,
      wallpaperData: pendingWpData  || (pendingWpData === null && !existing.wallpaperData ? null : existing.wallpaperData) || null,
      wallpaperBlur: modal.querySelector('#wa-opt-blur').checked,
      // Bubble overrides — only save if override is enabled
      outBubbleColor:       outOverride ? modal.querySelector('#wa-out-color').value   : null,
      outBubbleOpacity:     outOverride ? parseInt(modal.querySelector('#wa-out-opacity').value) : null,
      blurOutBubble:        outOverride ? modal.querySelector('#wa-out-blur').checked  : null,
      inBubbleColor:        inOverride  ? modal.querySelector('#wa-in-color').value    : null,
      inBubbleOpacity:      inOverride  ? parseInt(modal.querySelector('#wa-in-opacity').value) : null,
      blurInBubble:         inOverride  ? modal.querySelector('#wa-in-blur').checked   : null,
      bubbleBlurIntensity:  parseInt(modal.querySelector('#wa-bubble-blur-px').value),
    };

    // Clean out null-only payload (nothing actually set)
    const hasAnything = payload.wallpaperData || payload.outBubbleColor || payload.inBubbleColor;
    if (!hasAnything) { showToast('Nothing to save — set a wallpaper or bubble override first.', 'error'); return; }

    await persistChatSettings(chatName, payload);
    if (chatName === currentChatName) {
      applyPerChatBackground(chatName);
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
  if (type === 'video') { el.autoplay=true; el.loop=true; el.muted=true; el.playsInline=true; }
  el.src = data;
  el.style.cssText = 'width:100%;height:100%;object-fit:cover;';
  p.appendChild(el);
}

function readFileAsDataURL(file, cb) {
  const r = new FileReader(); r.onload = e => cb(e.target.result); r.readAsDataURL(file);
}

// ---------------------------------------------------------------------------
// TOAST
// ---------------------------------------------------------------------------
function showToast(message, type = 'success') {
  document.getElementById('wa-theme-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'wa-theme-toast';
  const bg = type==='error'?'#ea0038':type==='warn'?'#f0ad00':'#00a884';
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
    loadStorage().then(() => {
      applyGlobalCSS();
      reapplyBubbleColours();
      if (currentChatName) applyPerChatBackground(currentChatName);
      applySidebarBackground();
      console.log('[WA Themes] settings refreshed via message');
    });
    sendResponse({ ok: true }); return true;
  }
  if (msg.type === 'GET_CURRENT_CHAT') {
    sendResponse({ chatName: currentChatName }); return true;
  }
});

// Backup: also watch storage directly — fires even if message passing fails
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.globalSettings && !changes.chatWallpapers) return;
  console.log('[WA Themes] storage changed — reapplying');
  loadStorage().then(() => {
    applyGlobalCSS();
    reapplyBubbleColours();
    if (currentChatName) applyPerChatBackground(currentChatName);
    applySidebarBackground();
  });
});

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------
async function init() {
  try {
    console.log('[WA Themes] init() running...');
    await loadStorage();
    applyGlobalCSS();

    const titleEl = document.querySelector(SEL.chatTitle);
    if (titleEl) {
      currentChatName = titleEl.innerText?.trim() || null;
      if (currentChatName) applyPerChatBackground(currentChatName);
    }

    setupBubbleObserver();
    setupChatObserver();
    setupMenuObserver();
    applySidebarBackground();
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
