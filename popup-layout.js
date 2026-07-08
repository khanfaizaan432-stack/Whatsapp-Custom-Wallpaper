// =============================================================================
// WhatsApp Themes — popup-layout.js v1.7.0
// Sticky actions, compact mode, and collapsible sections for popup usability.
// =============================================================================
(() => {
  'use strict';

  const LAYOUT_ID = 'wa-popup-layout-helper';
  const PANEL_ID = 'wa-layout-toolbar';
  const STORAGE_KEY = 'waPopupLayoutMode';
  const ADVANCED_TITLES = [
    'font',
    'conversation header',
    'side panel',
    'nav strip',
    'chatlist header',
    'chat cards',
  ];

  if (window[LAYOUT_ID]) return;
  window[LAYOUT_ID] = true;

  function byId(id) {
    return document.getElementById(id);
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function normalizeTitle(text) {
    return String(text || '').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim().toLowerCase();
  }

  function getSectionTitle(section) {
    return normalizeTitle(qs('.section-title', section)?.textContent || '');
  }

  function isAdvancedSection(section) {
    const title = getSectionTitle(section);
    return ADVANCED_TITLES.some(part => title.includes(part));
  }

  function injectStyles() {
    if (byId('wa-layout-styles')) return;
    const style = document.createElement('style');
    style.id = 'wa-layout-styles';
    style.textContent = `
      body {
        padding-bottom: 84px !important;
        scroll-behavior: smooth;
      }
      #${PANEL_ID} {
        margin: 10px;
        border: 1px solid rgba(0,168,132,.22);
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(0,168,132,.12), rgba(17,27,33,.84));
        box-shadow: 0 12px 34px rgba(0,0,0,.2);
        overflow: hidden;
      }
      .wa-layout-top {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:10px 12px 8px;
      }
      .wa-layout-title {
        color:#d1f5ea;
        font-size:12px;
        font-weight:800;
        letter-spacing:.35px;
        text-transform:uppercase;
      }
      .wa-layout-subtitle {
        margin-top:2px;
        color:#8696a0;
        font-size:10.5px;
        line-height:1.25;
      }
      .wa-layout-actions {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        padding:0 12px 12px;
      }
      .wa-layout-btn {
        border:1px solid #2a3942;
        border-radius:9px;
        background:#1f2c33;
        color:#e9edef;
        font-size:11px;
        font-weight:750;
        padding:7px 9px;
        cursor:pointer;
        transition: transform .16s ease, filter .16s ease;
      }
      .wa-layout-btn.primary { background:#00a884; border-color:#00a884; color:#fff; }
      .wa-layout-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
      .wa-layout-toggle {
        display:inline-flex;
        align-items:center;
        gap:6px;
        color:#d1d7db;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
      }
      .wa-layout-toggle input { accent-color:#00a884; }
      section[data-wa-collapsible="1"] {
        transition: opacity .18s ease, max-height .22s ease, transform .18s ease;
      }
      section[data-wa-collapsible="1"] > .section-title {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }
      .wa-section-collapse-btn {
        border:1px solid rgba(134,150,160,.22);
        border-radius:999px;
        background:rgba(17,27,33,.7);
        color:#d1d7db;
        font-size:10px;
        font-weight:800;
        padding:4px 7px;
        cursor:pointer;
      }
      section[data-wa-collapsed="1"] {
        max-height: 52px !important;
        overflow: hidden !important;
        opacity: .92;
      }
      section[data-wa-collapsed="1"] > :not(.section-title) {
        display: none !important;
      }
      body.wa-compact-mode section[data-wa-advanced="1"] {
        max-height: 52px !important;
        overflow:hidden !important;
      }
      body.wa-compact-mode section[data-wa-advanced="1"] > :not(.section-title) {
        display:none !important;
      }
      body.wa-compact-mode .wa-preview {
        transform: scale(.96);
        transform-origin: top center;
        margin-bottom: 4px !important;
      }
      body.wa-compact-mode .hint-text {
        display:none !important;
      }
      .action-area {
        position: sticky !important;
        bottom: 0 !important;
        z-index: 999 !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1.3fr) minmax(0, .9fr) !important;
        gap: 8px !important;
        padding: 10px !important;
        margin: 0 !important;
        border-top: 1px solid rgba(0,168,132,.25) !important;
        background: rgba(17,27,33,.94) !important;
        backdrop-filter: blur(16px) saturate(1.3) !important;
        -webkit-backdrop-filter: blur(16px) saturate(1.3) !important;
        box-shadow: 0 -16px 34px rgba(0,0,0,.35) !important;
      }
      .action-area .apply-btn,
      .action-area .reset-all-btn {
        min-height: 42px !important;
        border-radius: 12px !important;
      }
      #waFloatingApply {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 9999;
        border: 1px solid rgba(0,168,132,.45);
        border-radius: 999px;
        background: #00a884;
        color: white;
        font-size: 12px;
        font-weight: 850;
        padding: 10px 13px;
        box-shadow: 0 12px 32px rgba(0,0,0,.35);
        cursor: pointer;
      }
      #waFloatingApply:hover { filter:brightness(1.08); transform:translateY(-1px); }
    `;
    document.head.appendChild(style);
  }

  async function getLayoutMode() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return data[STORAGE_KEY] || { compact: false, collapsed: {} };
    } catch (_) {
      return { compact: false, collapsed: {} };
    }
  }

  async function setLayoutMode(patch) {
    const current = await getLayoutMode();
    const next = { ...current, ...patch, collapsed: { ...(current.collapsed || {}), ...(patch.collapsed || {}) } };
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  }

  function sectionKey(section, index) {
    return `${index}:${getSectionTitle(section) || 'section'}`;
  }

  async function applyLayoutMode() {
    const mode = await getLayoutMode();
    document.body.classList.toggle('wa-compact-mode', Boolean(mode.compact));
    const compactToggle = byId('waCompactToggle');
    if (compactToggle) compactToggle.checked = Boolean(mode.compact);

    qsa('#tab-theme section[data-wa-collapsible="1"]').forEach((section, index) => {
      const key = section.dataset.waSectionKey || sectionKey(section, index);
      const collapsed = Boolean(mode.collapsed?.[key]);
      section.dataset.waCollapsed = collapsed ? '1' : '0';
      const btn = qs('.wa-section-collapse-btn', section);
      if (btn) btn.textContent = collapsed || document.body.classList.contains('wa-compact-mode') && section.dataset.waAdvanced === '1' ? 'Show' : 'Hide';
    });
  }

  function buildToolbar() {
    if (byId(PANEL_ID)) return;
    const tab = byId('tab-theme');
    if (!tab) return;

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="wa-layout-top">
        <div>
          <div class="wa-layout-title">Layout</div>
          <div class="wa-layout-subtitle">Compact mode and sticky controls for less scrolling.</div>
        </div>
        <label class="wa-layout-toggle" title="Collapse advanced sections by default">
          <input type="checkbox" id="waCompactToggle">
          Compact
        </label>
      </div>
      <div class="wa-layout-actions">
        <button type="button" class="wa-layout-btn primary" id="waJumpApplyBtn">Jump to Apply</button>
        <button type="button" class="wa-layout-btn" id="waExpandAllBtn">Expand all</button>
        <button type="button" class="wa-layout-btn" id="waCollapseAdvancedBtn">Collapse advanced</button>
        <button type="button" class="wa-layout-btn" id="waTopBtn">Top</button>
      </div>
    `;

    const firstUseful = byId('wa-polish-panel') || byId('wa-diagnostics-panel') || qs('#tab-theme section');
    if (firstUseful) firstUseful.insertAdjacentElement('beforebegin', panel);
    else tab.insertAdjacentElement('afterbegin', panel);

    byId('waCompactToggle')?.addEventListener('change', async event => {
      await setLayoutMode({ compact: Boolean(event.target.checked) });
      await applyLayoutMode();
    });
    byId('waJumpApplyBtn')?.addEventListener('click', () => qs('.action-area')?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    byId('waTopBtn')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    byId('waExpandAllBtn')?.addEventListener('click', async () => {
      const collapsed = {};
      qsa('#tab-theme section[data-wa-collapsible="1"]').forEach(section => { collapsed[section.dataset.waSectionKey] = false; });
      await setLayoutMode({ compact: false, collapsed });
      await applyLayoutMode();
    });
    byId('waCollapseAdvancedBtn')?.addEventListener('click', async () => {
      const collapsed = {};
      qsa('#tab-theme section[data-wa-advanced="1"]').forEach(section => { collapsed[section.dataset.waSectionKey] = true; });
      await setLayoutMode({ compact: false, collapsed });
      await applyLayoutMode();
    });
  }

  function enhanceSections() {
    qsa('#tab-theme section').forEach((section, index) => {
      if (section.id === PANEL_ID || section.id === 'wa-polish-panel' || section.id === 'wa-diagnostics-panel') return;
      if (section.dataset.waCollapsible === '1') return;

      section.dataset.waCollapsible = '1';
      section.dataset.waSectionKey = sectionKey(section, index);
      if (isAdvancedSection(section)) section.dataset.waAdvanced = '1';

      const title = qs('.section-title', section);
      if (!title) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wa-section-collapse-btn';
      btn.textContent = 'Hide';
      btn.addEventListener('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        const key = section.dataset.waSectionKey;
        const mode = await getLayoutMode();
        const nextValue = !(mode.collapsed?.[key]);
        await setLayoutMode({ collapsed: { [key]: nextValue } });
        await applyLayoutMode();
      });
      title.appendChild(btn);
    });
  }

  function buildFloatingApply() {
    if (byId('waFloatingApply')) return;
    const apply = byId('applyBtn');
    if (!apply) return;
    const btn = document.createElement('button');
    btn.id = 'waFloatingApply';
    btn.type = 'button';
    btn.textContent = 'Apply ✓';
    btn.title = 'Apply changes without scrolling';
    btn.addEventListener('click', () => apply.click());
    document.body.appendChild(btn);
  }

  function observeLatePanels() {
    const target = byId('tab-theme') || document.body;
    if (!target) return;
    let timer = null;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        buildToolbar();
        enhanceSections();
        applyLayoutMode();
      }, 150);
    }).observe(target, { childList: true, subtree: true });
  }

  async function init() {
    injectStyles();
    buildToolbar();
    enhanceSections();
    buildFloatingApply();
    observeLatePanels();
    await applyLayoutMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
