# Extension Architecture Notes

This project is a Manifest V3 Chrome/Edge extension with a simple no-build setup.

## Current runtime files

- `popup.html` — popup markup and controls.
- `popup.css` — base popup styling.
- `popup.js` — original popup state, upload, save, and tab-sync logic.
- `popup-patch.js` — additive popup hardening and product-polish layer.
- `shared/theme-defaults.js` — shared default values, range limits, and range-label mappings.
- `shared/theme-presets.js` — shared one-click theme preset definitions.
- `content.js` — original WhatsApp Web styling/content logic.
- `content-patch.js` — runtime normalization and selector fallback layer.
- `content-repair-trigger.js` — repair tick trigger when WhatsApp Web re-renders.
- `options.html` / `options.js` — maintenance page for backups, imports, cleanup, and reset.

## Why patch files exist

`popup.js` and `content.js` are large and high-risk to rewrite without browser-based regression testing. The patch files allow targeted upgrades while preserving the original working logic.

## Current modularization status

v1.6.0 begins the modular refactor without introducing a build step:

- Shared constants now live under `shared/`.
- `popup-patch.js` dynamically loads those shared scripts from extension-local URLs.
- `popup-patch.js` still includes safe fallback constants so the popup does not fully break if shared loading fails.
- The validator now checks that shared files exist, parse, and are referenced by `popup-patch.js`.

## Next refactor target

Keep splitting one low-risk slice at a time. Suggested target structure:

```text
src/
  shared/
    theme-defaults.js       # started as shared/theme-defaults.js
    theme-presets.js        # started as shared/theme-presets.js
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
- changelog and release checklist
- shared theme defaults/presets

## Known limitations

- `popup.js` and `content.js` are still large.
- `popup-patch.js` still owns behavior; only constants/presets have moved out so far.
- The live preview is an approximate mock preview, not a full WhatsApp renderer.
- JSON exports do not include IndexedDB video blobs.
- WhatsApp DOM changes can still require selector updates.
