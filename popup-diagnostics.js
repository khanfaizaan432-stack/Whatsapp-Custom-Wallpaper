// =============================================================================
// WhatsApp Themes — popup-diagnostics.js v1.6.2
// Adds user-visible connection, diagnostics, and force-reapply controls.
// =============================================================================
(() => {
  'use strict';

  const PANEL_ID = 'wa-diagnostics-panel';

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function setState(message, type = 'info') {
    const el = byId('waDiagState');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
  }

  async function getWhatsAppTab() {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.url?.startsWith('https://web.whatsapp.com/')) return active;

    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    return tabs[0] || null;
  }

  function sendToTab(tabId, message) {
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, message, response => {
        const error = chrome.runtime.lastError;
        if (error) {
          resolve({ ok: false, error: error.message });
          return;
        }
        resolve(response || { ok: false, error: 'No response from content script' });
      });
    });
  }

  function formatWallpaper(summary) {
    if (!summary) return 'None';
    const source = summary.type || 'set';
    const storage = summary.hasStorageKey ? 'storage' : summary.hasData ? 'inline' : 'missing data';
    return `${source} / ${storage}`;
  }

  function renderDiagnostics(diag) {
    setText('waDiagConnected', diag.ok ? 'Yes' : 'No');
    setText('waDiagChat', diag.currentChatName || 'No chat detected');
    setText('waDiagMain', diag.mainFound ? `Yes (${diag.mainSelector || 'unknown'})` : 'No');
    setText('waDiagGlobalWallpaper', formatWallpaper(diag.globalWallpaper));
    setText('waDiagPerChatWallpaper', diag.perChatWallpaper?.wallpaperType ? `${diag.perChatWallpaper.wallpaperType}` : 'None');
    setText('waDiagOverlay', diag.forcedOverlayMounted ? 'Mounted' : diag.originalOverlayMounted ? 'Original only' : 'Not mounted');
    setText('waDiagStyles', [
      diag.forcedStyleMounted ? 'force-bg' : null,
      diag.globalStyleMounted ? 'global' : null,
      diag.sidebarOverlayMounted ? 'sidebar' : null,
    ].filter(Boolean).join(', ') || 'None');
    setText('waDiagVersion', diag.extensionVersion || 'Unknown');
  }

  async function refreshDiagnostics({ quiet = false } = {}) {
    const tab = await getWhatsAppTab();
    if (!tab) {
      setState('WhatsApp Web tab not found.', 'error');
      renderDiagnostics({ ok: false });
      return null;
    }

    const diag = await sendToTab(tab.id, { type: 'GET_WA_THEME_DIAGNOSTICS' });
    if (!diag?.ok) {
      setState(`Content script not responding: ${diag?.error || 'unknown error'}`, 'error');
      renderDiagnostics({ ok: false });
      return null;
    }

    renderDiagnostics(diag);
    if (!quiet) setState('Diagnostics refreshed.', 'ok');
    return { tab, diag };
  }

  async function forceReapplyWallpaper() {
    const tab = await getWhatsAppTab();
    if (!tab) {
      setState('WhatsApp Web tab not found. Open WhatsApp Web first.', 'error');
      return;
    }

    setState('Forcing wallpaper reapply…', 'info');
    const response = await sendToTab(tab.id, { type: 'FORCE_WA_THEME_WALLPAPER' });
    if (!response?.ok) {
      setState(`Force reapply failed: ${response?.error || 'unknown error'}`, 'error');
      return;
    }

    await refreshDiagnostics({ quiet: true });
    setState(`Wallpaper reapply requested${response.chatName ? ` for ${response.chatName}` : ''}.`, 'ok');
  }

  async function copyDiagnostics() {
    const result = await refreshDiagnostics({ quiet: true });
    if (!result?.diag) return;
    await navigator.clipboard.writeText(JSON.stringify(result.diag, null, 2));
    setState('Diagnostics copied as JSON.', 'ok');
  }

  function injectStyles() {
    if (byId('wa-diagnostics-styles')) return;
    const style = document.createElement('style');
    style.id = 'wa-diagnostics-styles';
    style.textContent = `
      #${PANEL_ID} {
        margin: 10px;
        border: 1px solid rgba(134,150,160,.16);
        border-radius: 14px;
        background: rgba(17,27,33,.78);
        box-shadow: 0 14px 34px rgba(0,0,0,.22);
        overflow: hidden;
      }
      .wa-diag-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:11px 12px 8px;
      }
      .wa-diag-title {
        color:#d1f5ea;
        font-size:12px;
        font-weight:800;
        letter-spacing:.35px;
        text-transform:uppercase;
      }
      #waDiagState {
        color:#8696a0;
        font-size:10px;
        border:1px solid rgba(134,150,160,.18);
        border-radius:999px;
        padding:4px 7px;
        max-width:150px;
        overflow:hidden;
        white-space:nowrap;
        text-overflow:ellipsis;
      }
      #waDiagState[data-type="ok"] { color:#b7f7d2; border-color:rgba(0,168,132,.42); }
      #waDiagState[data-type="error"] { color:#ffb4c2; border-color:rgba(234,0,56,.48); }
      .wa-diag-grid {
        display:grid;
        grid-template-columns: 1fr 1.2fr;
        gap:0;
        padding:0 12px 10px;
        font-size:11px;
      }
      .wa-diag-grid span {
        padding:5px 0;
        border-bottom:1px solid rgba(134,150,160,.12);
        color:#8696a0;
      }
      .wa-diag-grid strong {
        padding:5px 0;
        border-bottom:1px solid rgba(134,150,160,.12);
        color:#e9edef;
        font-weight:650;
        overflow:hidden;
        white-space:nowrap;
        text-overflow:ellipsis;
      }
      .wa-diag-actions {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        padding:0 12px 12px;
      }
      .wa-diag-btn {
        border:1px solid #2a3942;
        border-radius:9px;
        background:#1f2c33;
        color:#e9edef;
        font-size:11px;
        font-weight:750;
        padding:7px 9px;
        cursor:pointer;
      }
      .wa-diag-btn.primary { background:#00a884; border-color:#00a884; color:#fff; }
      .wa-diag-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
    `;
    document.head.appendChild(style);
  }

  function buildPanel() {
    if (byId(PANEL_ID)) return;
    const target = byId('wa-polish-panel') || document.querySelector('#tab-theme section') || byId('tab-theme');
    if (!target) return;

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="wa-diag-head">
        <div>
          <div class="wa-diag-title">Diagnostics</div>
          <div style="font-size:10.5px;color:#8696a0;margin-top:2px;">Check content connection and force wallpaper repair.</div>
        </div>
        <div id="waDiagState">Idle</div>
      </div>
      <div class="wa-diag-grid">
        <span>Connected</span><strong id="waDiagConnected">—</strong>
        <span>Current chat</span><strong id="waDiagChat">—</strong>
        <span>Main panel</span><strong id="waDiagMain">—</strong>
        <span>Global wallpaper</span><strong id="waDiagGlobalWallpaper">—</strong>
        <span>Per-chat wallpaper</span><strong id="waDiagPerChatWallpaper">—</strong>
        <span>Overlay</span><strong id="waDiagOverlay">—</strong>
        <span>Styles</span><strong id="waDiagStyles">—</strong>
        <span>Version</span><strong id="waDiagVersion">—</strong>
      </div>
      <div class="wa-diag-actions">
        <button type="button" class="wa-diag-btn primary" id="waForceWallpaperBtn">Force wallpaper</button>
        <button type="button" class="wa-diag-btn" id="waRefreshDiagBtn">Refresh status</button>
        <button type="button" class="wa-diag-btn" id="waCopyDiagBtn">Copy diagnostics</button>
      </div>
    `;

    target.insertAdjacentElement('afterend', panel);

    byId('waForceWallpaperBtn')?.addEventListener('click', forceReapplyWallpaper);
    byId('waRefreshDiagBtn')?.addEventListener('click', () => refreshDiagnostics());
    byId('waCopyDiagBtn')?.addEventListener('click', copyDiagnostics);
  }

  function init() {
    injectStyles();
    buildPanel();
    setTimeout(() => refreshDiagnostics({ quiet: true }), 450);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
