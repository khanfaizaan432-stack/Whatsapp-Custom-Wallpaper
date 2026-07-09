# Changelog

All notable changes to this extension are tracked here.

## 1.7.2

### Fixed

- Strengthened `content-sidebar-fallback.js` so sidebar image/video wallpaper does not depend on `#side`-only selectors.
- Sidebar fallback now detects the actual left-panel root by screen position and dimensions.
- Adds separate background and tint layers so image wallpaper is not hidden behind the tint/fog layer.
- Makes the detected sidebar root and its chat-list descendants transparent so the background image can show through.

## 1.7.1

### Fixed

- Added `content-sidebar-fallback.js` for Opera/Chromium WhatsApp Web side-panel styling when the existing sidebar selectors fail.
- Side-panel fallback now targets `#side`, chat-list containers, navigation/header areas, and chat-list cards.
- Supports sidebar image/video wallpaper, solid fallback colour, tint/fog, blur, nav strip colour, chatlist header colour, and chat-card colour.

### Changed

- Manifest now loads `content-sidebar-fallback.js` after the diagnostics content script.
- Validator now checks sidebar fallback presence, manifest wiring, syntax, and key fallback markers.

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
