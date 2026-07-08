# Release Checklist

Use this before merging or publishing a new unpacked-extension version.

## Static checks

- [ ] `npm test` passes locally.
- [ ] `manifest.json` version matches `package.json` version.
- [ ] `CHANGELOG.md` has an entry for the new version.
- [ ] No temporary/debug files are present in the repository root.
- [ ] `popup.html` loads `popup.js` and `popup-patch.js`.
- [ ] `options.html` loads `options.js`.

## Browser smoke test

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked** and select the repo folder.
4. Confirm the extension loads with no manifest errors.
5. Pin the extension.
6. Open `https://web.whatsapp.com/`.
7. Open the extension popup.

## Popup checks

- [ ] Popup opens without console errors.
- [ ] Quick polish panel is visible.
- [ ] Theme presets update controls and preview.
- [ ] Live preview updates when colors/sliders change.
- [ ] Apply button shows save feedback.
- [ ] Maintenance button opens the options page.
- [ ] Open WhatsApp Web button opens WhatsApp Web.
- [ ] Copy debug creates a JSON summary.

## Theme application checks

- [ ] Outgoing bubble color changes after applying.
- [ ] Incoming bubble color changes after applying.
- [ ] Header color/opacity changes after applying.
- [ ] Sidebar/card settings change after applying.
- [ ] Image wallpaper applies.
- [ ] Video wallpaper applies.
- [ ] Refreshing WhatsApp Web keeps settings.

## Per-chat checks

- [ ] Current chat is detected.
- [ ] Per-chat wallpaper can be set.
- [ ] Per-chat override beats global wallpaper.
- [ ] Per-chat settings survive refresh.

## Maintenance checks

- [ ] Options page opens from extension details.
- [ ] Storage metrics render.
- [ ] Export downloads JSON.
- [ ] Import accepts exported JSON.
- [ ] Clear theme settings works.
- [ ] Delete video storage works.
- [ ] Factory reset clears settings and video storage.

## Rollback plan

If a release breaks the popup or WhatsApp Web styling:

1. Revert the latest merge commit.
2. Reload the unpacked extension.
3. Refresh WhatsApp Web.
4. Re-test the previous version from the changelog.
