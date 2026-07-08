# Extension Architecture Notes

This project is currently a Manifest V3 Chrome/Edge extension with a simple no-build setup.

## Current runtime files

- `popup.html` — popup markup and controls.
- `popup.css` — base popup styling.
- `popup.js` — original popup state, upload, save, and tab-sync logic.
- `popup-patch.js` — additive popup hardening and product-polish layer.
- `content.js` — original WhatsApp Web styling/content logic.
- `content-patch.js` — runtime normalization and selector fallback layer.
- `content-repair-trigger.js` — repair tick trigger when WhatsApp Web re-renders.
- `options.html` / `options.js` — maintenance page for backups, imports, cleanup, and reset.

## Why patch files exist

`popup.js` and `content.js` are large and high-risk to rewrite without browser-based regression testing. The patch files allow targeted upgrades while preserving the original working logic.

## Next refactor target

When browser testing is available, split the code into smaller modules and load them explicitly from the manifest / popup page.

Suggested structure:

```text
src/
  shared/
    theme-defaults.js
    theme-presets.js
    storage.js
    media-limits.js
  popup/
    dom.js
    preview.js
    presets.js
    feedback.js
    uploads.js
    init.js
  content/
    selectors.js
    current-chat.js
    wallpapers.js
    bubbles.js
    sidebar.js
    repair.js
    init.js
```

## Refactor rules

1. Keep the extension no-build unless there is a strong reason to bundle.
2. Move constants first, behavior second.
3. Refactor one surface at a time: popup first, then content script.
4. Keep `npm test` passing after every step.
5. Browser-test after each file split:
   - extension loads unpacked
   - popup opens
   - global settings save
   - per-chat settings save
   - image wallpaper works
   - video wallpaper works
   - maintenance page opens
   - export/import works

## Product-quality goals already added

- validation and CI
- privacy policy
- runtime normalization
- options/maintenance page
- popup presets
- live preview
- save/unsaved feedback
- debug summary copy
- storage warning

## Known limitations

- `popup.js` and `content.js` are still large.
- The live preview is an approximate mock preview, not a full WhatsApp renderer.
- JSON exports do not include IndexedDB video blobs.
- WhatsApp DOM changes can still require selector updates.
