# Changelog

All notable changes to this extension are tracked here.

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
