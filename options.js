// WhatsApp Themes — maintenance options page
(() => {
  'use strict';

  const DB_NAME = 'wa-themes-videos';
  const STORAGE_KEYS = ['globalSettings', 'chatWallpapers'];

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type = '') {
    const box = el('status');
    box.textContent = message;
    box.className = type;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function getStorage(keys = null) {
    return chrome.storage.local.get(keys);
  }

  async function setStorage(data) {
    return chrome.storage.local.set(data);
  }

  async function removeStorage(keys) {
    return chrome.storage.local.remove(keys);
  }

  async function getBytesInUse() {
    return chrome.storage.local.getBytesInUse(null);
  }

  function hasWallpaper(wallpaper) {
    return Boolean(wallpaper && (wallpaper.data || wallpaper.storageKey || wallpaper.idbKey));
  }

  async function refreshStatus() {
    const [bytes, data] = await Promise.all([
      getBytesInUse().catch(() => null),
      getStorage(STORAGE_KEYS),
    ]);

    const globalSettings = data.globalSettings || {};
    const chatWallpapers = data.chatWallpapers || {};

    el('storageBytes').textContent = bytes == null ? 'Unknown' : formatBytes(bytes);
    el('chatCount').textContent = String(Object.keys(chatWallpapers).length);
    el('globalWallpaper').textContent = hasWallpaper(globalSettings.globalWallpaper) ? globalSettings.globalWallpaper.type || 'Set' : 'None';
    el('sidebarWallpaper').textContent = hasWallpaper(globalSettings.sidebarWallpaper) ? globalSettings.sidebarWallpaper.type || 'Set' : 'None';
  }

  async function exportSettings() {
    const data = await getStorage(STORAGE_KEYS);
    const backup = {
      schema: 'wa-themes-settings-backup-v1',
      exportedAt: new Date().toISOString(),
      warning: 'Video blobs stored in IndexedDB are not included in this JSON backup.',
      globalSettings: data.globalSettings || {},
      chatWallpapers: data.chatWallpapers || {},
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wa-themes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus('Settings backup exported.', 'ok');
  }

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  function validateImportPayload(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Backup JSON must be an object.');
    const globalSettings = payload.globalSettings && typeof payload.globalSettings === 'object'
      ? payload.globalSettings
      : {};
    const chatWallpapers = payload.chatWallpapers && typeof payload.chatWallpapers === 'object'
      ? payload.chatWallpapers
      : {};
    return { globalSettings, chatWallpapers };
  }

  async function importSettings(file) {
    const text = await readTextFile(file);
    const parsed = JSON.parse(text);
    const payload = validateImportPayload(parsed);
    await setStorage(payload);
    await refreshStatus();
    setStatus('Settings imported. Refresh WhatsApp Web to apply them.', 'ok');
  }

  async function deleteVideoDatabase() {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onblocked = () => reject(new Error('Video database is open in another tab. Close WhatsApp Web and try again.'));
      req.onerror = () => reject(req.error || new Error('Failed to delete video database.'));
    });
  }

  async function clearThemeSettings() {
    await removeStorage(STORAGE_KEYS);
    await refreshStatus();
    setStatus('Theme settings cleared. Refresh WhatsApp Web to remove applied styles.', 'ok');
  }

  async function factoryReset() {
    await removeStorage(STORAGE_KEYS);
    await deleteVideoDatabase().catch(error => {
      setStatus(`Settings cleared, but video storage was not deleted: ${error.message}`, 'error');
      throw error;
    });
    await refreshStatus();
    setStatus('Factory reset complete. Refresh WhatsApp Web.', 'ok');
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function wireEvents() {
    el('refreshBtn').addEventListener('click', async () => {
      await refreshStatus();
      setStatus('Status refreshed.', 'ok');
    });

    el('exportBtn').addEventListener('click', () => {
      exportSettings().catch(error => setStatus(`Export failed: ${error.message}`, 'error'));
    });

    el('importFile').addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      importSettings(file)
        .catch(error => setStatus(`Import failed: ${error.message}`, 'error'))
        .finally(() => { event.target.value = ''; });
    });

    el('clearThemesBtn').addEventListener('click', () => {
      if (!confirmAction('Clear all theme settings? This cannot be undone unless you exported a backup.')) return;
      clearThemeSettings().catch(error => setStatus(`Clear failed: ${error.message}`, 'error'));
    });

    el('deleteVideosBtn').addEventListener('click', () => {
      if (!confirmAction('Delete locally stored video wallpapers? Image/settings JSON will remain.')) return;
      deleteVideoDatabase()
        .then(refreshStatus)
        .then(() => setStatus('Video storage deleted.', 'ok'))
        .catch(error => setStatus(`Video cleanup failed: ${error.message}`, 'error'));
    });

    el('factoryResetBtn').addEventListener('click', () => {
      if (!confirmAction('Factory reset this extension? This clears settings and video storage.')) return;
      factoryReset().catch(() => {});
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireEvents();
    refreshStatus().catch(error => setStatus(`Status check failed: ${error.message}`, 'error'));
  });
})();
