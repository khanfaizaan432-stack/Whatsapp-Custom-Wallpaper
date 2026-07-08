# Changelog

All notable changes to this extension are tracked here.

## 1.9.0

### Added

- `popup-theme-library.js` for a local user theme library.
- Save current theme, apply saved themes, delete saved themes, and import/export theme library JSON.
- Storage cleanup action for unused IndexedDB video blobs.
- Richer preset-card swatches for built-in theme presets.
- Break-risk review document for the current patch-based architecture.

### Changed

- `popup-wallpaper-controls.js` now dynamically loads the theme library layer.
- Validator now checks theme-library script presence, storage cleanup markers, and preset-card styling markers.

## 1.8.0

### Added

- `popup-wallpaper-controls.js` with wallpaper fit, position, zoom, dim, brightness, contrast, and saturation controls.
- `content-wallpaper-controls.js` to apply wallpaper controls to the forced chat wallpaper overlay.
- Wallpaper controls preview swatch in the popup.

### Changed

- Manifest now loads `content-wallpaper-controls.js`.
- Popup now loads `popup-wallpaper-controls.js`.
- Validator now checks wallpaper-control popup/content scripts and message hooks.

## 1.7.0

### Added

- `popup-layout.js` helper for popup usability.
- Sticky bottom Apply / Reset action bar.
- Floating Apply button for applying changes without scrolling.
- Compact mode toggle for reducing popup height.
- Section-level collapse buttons.
- Layout toolbar with Jump to Apply, Top, Expand all, and Collapse advanced controls.

### Changed

- Popup now loads `popup-layout.js` after diagnostics.
- Validator now checks popup layout wiring and key layout behavior markers.

## 1.6.2

### Added

- Popup diagnostics panel with content-script connection status.
- Force wallpaper reapply button in the popup.
- Refresh diagnostics button.
- Copy diagnostics JSON button.
- `content-diagnostics.js` endpoint for runtime status reporting.

### Changed

- Manifest now loads `content-diagnostics.js` after the existing content scripts.
- Validator now checks diagnostics files, popup wiring, manifest wiring, and diagnostics message hooks.

## 1.6.1

### Fixed

- Added a forced chat wallpaper fallback layer in `content-patch.js` for WhatsApp Web DOM changes where the popup preview updates but the actual chat background stays black or hidden.
- Re-applies wallpaper fallback when either global settings or per-chat wallpaper settings change.
- Adds a `FORCE_WA_THEME_WALLPAPER` message hook for manual recovery/debugging.

## 1.6.0

### Added

- Shared theme module files:
  - `shared/theme-defaults.js`
  - `shared/theme-presets.js`
- Validator coverage for shared theme modules.
- Validator checks that `popup-patch.js` loads and consumes `WAThemeShared`.

### Changed

- Refactored popup polish constants out of `popup-patch.js` into shared no-build classic scripts.
- `popup-patch.js` now dynamically loads shared defaults/presets and falls back safely if shared loading fails.
- Debug summary now reports whether shared modules loaded and how many presets are available.

## 1.5.0

### Added

- Stronger extension validation for popup/options script wiring.
- Validation guard against accidental temporary/debug files being committed.
- Release checklist for safer manual extension testing.
- Changelog discipline so each version bump is documented.

### Changed

- Strengthened project quality gates before future refactors.
- Documented the current v1.5.0 hardening layer as the baseline before modular code splitting.

## 1.4.0

### Added

- Popup polish layer with premium visual styling.
- Quick theme presets: AMOLED, Glass Blur, Neon Green, Midnight Purple, Sakura, and Minimal Grey.
- Live mock chat preview for bubble/header styling.
- Maintenance shortcut from the popup.
- Open WhatsApp Web shortcut from the popup.
- Copy-debug helper for troubleshooting.
- Unsaved/saved feedback and storage warnings.

## 1.3.0

### Added

- Extension options page for maintenance.
- Storage usage status.
- Settings export/import.
- Theme clearing.
- Video IndexedDB cleanup.
- Factory reset.

## 1.2.0

### Added

- Runtime storage normalization in the content patch.
- Numeric clamping for common theme settings.
- Package/manifest version validation.

## 1.1.1

### Added

- `package.json` validation entrypoint.
- GitHub Actions validation workflow.
- Privacy policy.
- Improved README documentation.

## 1.1.0

### Added

- Runtime content stability patch.
- WhatsApp Web fallback selectors.
- Re-apply behavior when WhatsApp Web re-renders.

## 1.0.0

### Initial baseline

- WhatsApp Web theme popup.
- Global and per-chat wallpaper controls.
- Bubble color and opacity controls.
- Sidebar/header styling controls.
