// =============================================================================
// WhatsApp Themes — popup-patch.js v1.1.0
// Popup hardening loaded after popup.js.
// =============================================================================
(() => {
  'use strict';

  const MAX_IMAGE_MB = 8;
  const MAX_VIDEO_MB = 200;
  const STATUS_ID = 'wa-popup-health-status';

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
  }

  function ensureStatusBox() {
    let box = byId(STATUS_ID);
    if (box) return box;
    box = document.createElement('div');
    box.id = STATUS_ID;
    box.style.cssText = [
      'margin:8px 12px 0',
      'padding:8px 10px',
      'border-radius:8px',
      'background:#172027',
      'border:1px solid #2a3942',
      'color:#8696a0',
      'font-size:11px',
      'line-height:1.35',
      'display:none',
    ].join(';');
    const header = document.querySelector('.wa-header');
    header?.insertAdjacentElement('afterend', box);
    return box;
  }

  function showStatus(message, type = 'info') {
    const box = ensureStatusBox();
    box.textContent = message;
    box.style.display = 'block';
    box.style.color = type === 'error' ? '#ffb4c2' : type === 'ok' ? '#b7f7d2' : '#d1d7db';
    box.style.borderColor = type === 'error' ? '#ea0038' : type === 'ok' ? '#00a884' : '#2a3942';
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
      box.style.display = 'none';
    }, type === 'error' ? 4200 : 2400);
  }

  function clampRangeControl(id, min, max, fallback) {
    const el = byId(id);
    if (!el) return;
    const apply = () => {
      const raw = Number(el.value);
      const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
      if (String(value) !== String(el.value)) el.value = value;
    };
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
    apply();
  }

  function wireRangeLabels() {
    const controls = [
      ['outBubbleOpacity', 'outOpacityVal'],
      ['inBubbleOpacity', 'inOpacityVal'],
      ['blurIntensity', 'blurVal'],
      ['sidebarTintOpacity', 'sidebarTintVal'],
      ['sidebarBlurIntensity', 'sidebarBlurVal'],
      ['chatCardOpacity', 'chatCardOpacityVal'],
      ['chatCardBlurIntensity', 'chatCardBlurIntensityVal'],
      ['navStripOpacity', 'navStripOpacityVal'],
      ['navStripBlur', 'navStripBlurVal'],
      ['fontSize', 'fontSizeVal'],
      ['convHeaderOpacity', 'convHeaderOpacityVal'],
      ['convHeaderBlur', 'convHeaderBlurVal'],
      ['chatlistHeaderOpacity', 'chatlistHeaderOpacityVal'],
      ['chatlistHeaderBlur', 'chatlistHeaderBlurVal'],
    ];
    for (const [inputId, labelId] of controls) {
      const input = byId(inputId);
      if (!input) continue;
      const update = () => setText(labelId, input.value);
      input.addEventListener('input', update);
      input.addEventListener('change', update);
      update();
    }
  }

  function validateFileInput(inputId, type) {
    const input = byId(inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const isImage = type === 'image';
      const maxMb = isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB;
      const okMime = isImage ? file.type.startsWith('image/') : file.type.startsWith('video/');
      if (!okMime) {
        input.value = '';
        showStatus(`Unsupported ${type} file type.`, 'error');
        return;
      }
      if (file.size > maxMb * 1024 * 1024) {
        input.value = '';
        showStatus(`${type === 'image' ? 'Image' : 'Video'} is too large. Limit: ${maxMb} MB.`, 'error');
        return;
      }
      showStatus(`${file.name} selected. Click Apply Changes to save.`, 'ok');
    }, true);
  }

  async function checkActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url?.startsWith('https://web.whatsapp.com/')) {
        showStatus('Open WhatsApp Web, then use this popup. Changes are saved but live preview needs that tab.', 'error');
        return;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_CHAT_FALLBACK' });
      } catch (_) {
        showStatus('Reload WhatsApp Web once after installing/updating the extension.', 'error');
      }
    } catch (_) {
      showStatus('Could not inspect the active tab.', 'error');
    }
  }

  function wireApplyFeedback() {
    const btn = byId('applyBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      setTimeout(checkActiveTab, 150);
    });
  }

  function wireStorageWarning() {
    chrome.storage.local.getBytesInUse(null, bytes => {
      if (chrome.runtime.lastError) return;
      const mb = bytes / (1024 * 1024);
      if (mb > 300) {
        showStatus(`Extension storage is using about ${mb.toFixed(0)} MB. Remove unused video wallpapers if things feel slow.`, 'error');
      }
    });
  }

  function init() {
    wireRangeLabels();
    clampRangeControl('outBubbleOpacity', 0, 100, 100);
    clampRangeControl('inBubbleOpacity', 0, 100, 100);
    clampRangeControl('blurIntensity', 2, 30, 8);
    clampRangeControl('fontSize', 10, 22, 14);
    clampRangeControl('convHeaderOpacity', 0, 100, 100);
    clampRangeControl('convHeaderBlur', 0, 30, 0);
    clampRangeControl('chatlistHeaderOpacity', 0, 100, 100);
    clampRangeControl('chatlistHeaderBlur', 0, 30, 0);
    clampRangeControl('sidebarTintOpacity', 0, 100, 0);
    clampRangeControl('sidebarBlurIntensity', 2, 30, 8);
    clampRangeControl('chatCardOpacity', 0, 100, 100);
    clampRangeControl('chatCardBlurIntensity', 2, 20, 4);
    clampRangeControl('navStripOpacity', 0, 100, 100);
    clampRangeControl('navStripBlur', 0, 30, 0);

    validateFileInput('wa-global-file-img', 'image');
    validateFileInput('wa-sidebar-file-img', 'image');
    validateFileInput('wa-global-file-vid', 'video');
    validateFileInput('wa-sidebar-file-vid', 'video');
    wireApplyFeedback();
    wireStorageWarning();
    checkActiveTab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
