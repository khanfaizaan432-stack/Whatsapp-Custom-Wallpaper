// =============================================================================
// WhatsApp Themes — content-repair-trigger.js v1.1.0
//
// Small companion script for content-patch.js. The original content.js already
// watches changes to `globalSettings` and `chatWallpapers`; this script nudges
// `globalSettings.__repairTick` when WhatsApp Web re-renders large DOM regions so
// the existing reapply path runs again.
// =============================================================================
(() => {
  'use strict';

  const REPAIR_DEBOUNCE_MS = 500;
  let timer = null;

  function scheduleRepairTick(reason) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const { globalSettings = {} } = await chrome.storage.local.get('globalSettings');
        await chrome.storage.local.set({
          globalSettings: {
            ...globalSettings,
            __repairTick: Date.now(),
            __repairReason: reason,
          },
        });
      } catch (err) {
        console.warn('[WA Themes repair trigger] failed:', err);
      }
    }, REPAIR_DEBOUNCE_MS);
  }

  function nodeLooksRelevant(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node;
    return Boolean(
      el.matches?.('#main,#side,#pane-side,[data-testid="conversation-panel-body"],[data-testid="chatlist-header"]') ||
      el.querySelector?.('#main,#side,#pane-side,[data-testid="conversation-panel-body"],[data-testid="chatlist-header"]')
    );
  }

  const root = document.querySelector('#app') || document.body;
  if (root) {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (nodeLooksRelevant(node)) {
            scheduleRepairTick('large-dom-rerender');
            return;
          }
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRepairTick('tab-visible');
  });
  window.addEventListener('focus', () => scheduleRepairTick('window-focus'));
  scheduleRepairTick('extension-loaded');
})();
