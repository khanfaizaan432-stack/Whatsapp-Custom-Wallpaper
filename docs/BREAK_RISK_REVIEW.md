# Break-Risk Review

This review documents likely break points after the v1.9.0 quality/QoL upgrades.

## Highest-risk areas

### 1. Popup script layering

The popup now loads several additive scripts:

- `popup.js`
- `popup-patch.js`
- `popup-diagnostics.js`
- `popup-layout.js`
- `popup-wallpaper-controls.js`
- dynamically loaded `popup-theme-library.js`

Risk: load-order assumptions can break if a later script expects a DOM node created by an earlier script that has not run yet.

Mitigation already present:

- Additive scripts guard against duplicate loading.
- Most scripts wait for `DOMContentLoaded` or check document state.
- The validator checks that the core popup scripts are present and parse.

Manual check needed:

- Open popup after extension reload.
- Confirm polish, diagnostics, layout, wallpaper controls, and theme library all appear.

### 2. Forced wallpaper overlay

The wallpaper fallback relies on `#main` and a forced overlay:

- `#wa-theme-force-bg-overlay`
- `#wa-theme-force-bg-style`

Risk: WhatsApp Web may change its DOM or add stacking contexts that hide the overlay.

Mitigation already present:

- Diagnostics panel reports overlay mounted status.
- Force wallpaper button can manually reapply.
- Content fallback listens to storage and DOM changes.

Manual check needed:

- Set an image wallpaper.
- Click Apply.
- Confirm Diagnostics says overlay is mounted.
- Use Force wallpaper if the image does not appear.

### 3. Wallpaper filter controls

Fit, position, zoom, dim, brightness, contrast, and saturation are applied to the forced overlay/video.

Risk: if the original wallpaper layer from `content.js` wins over the forced overlay, controls may appear saved but not visible.

Mitigation already present:

- `content-wallpaper-controls.js` targets `#wa-theme-force-bg-overlay` directly.
- Storage changes trigger reapplication.

Manual check needed:

- Change dim to 50% and brightness to 70%.
- Confirm the chat wallpaper visibly changes.

### 4. Video storage cleanup

`popup-theme-library.js` can clean unused IndexedDB video blobs.

Risk: if referenced video keys are stored under an unexpected field name, cleanup could remove a still-used video.

Mitigation already present:

- Cleanup preserves known references from `globalSettings`, `sidebarWallpaper`, and `chatWallpapers`.

Manual check needed before using aggressively:

- Export settings first.
- Test with one global video and one per-chat video.
- Run cleanup.
- Confirm active videos still work after refresh.

### 5. Patch-based architecture

The project still uses patch layers rather than a fully modular source tree.

Risk: future features can become order-dependent or hard to reason about.

Mitigation already present:

- Shared theme defaults/presets extracted to `shared/`.
- Architecture docs describe next modular split.
- Validator catches missing files and script syntax errors.

Recommended next step:

- Do a real v2.0.0 refactor only after local browser testing is available.
- Keep current patch files as compatibility shims until modules are proven.

## Reload checklist after v1.9.0

1. Open `chrome://extensions`.
2. Click **Reload** on WhatsApp Themes.
3. Refresh WhatsApp Web.
4. Open the popup.
5. Confirm these panels appear:
   - Quick polish
   - Diagnostics
   - Layout
   - Wallpaper Controls
   - Theme Library
6. Apply a preset.
7. Save it to the theme library.
8. Apply wallpaper controls.
9. Confirm diagnostics reports the forced overlay.
10. Export the theme library JSON.

## Known limitations

- I did not run a real browser session from the connector environment.
- Static validation can catch syntax/wiring issues, but not visual layout or WhatsApp DOM behavior.
- The extension still needs local unpacked-extension smoke testing after each major change.
