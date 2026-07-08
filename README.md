# WhatsApp Custom Wallpaper

A Chrome/Edge extension that lets you customise WhatsApp Web with:

- 🖼️ Per-chat wallpapers (image or video)
- 🎨 Custom bubble colours for incoming and outgoing messages
- 🔲 Blur and glass effects on backgrounds, sidebars, and bubbles
- 🔤 Custom font family and font size
- 🎨 Header and sidebar tinting
- 🧰 Settings backup, restore, and storage cleanup tools

---

## ⚡ Quick Install (Recommended)

> Just want it working? Do this.

1. Download **`install-whatsapp-wallpaper.bat`** from this repo
2. Double-click it
3. If Windows shows a SmartScreen warning, click **More info → Run anyway**
4. A **folder picker** will open — choose where to install the extension
5. Once done, **`HOW-TO.txt`** opens in Notepad with full instructions, and **Chrome** opens to the extensions page

**Then in Chrome or Edge:**

1. Turn on **Developer mode** (toggle in the top-right of the extensions page)
2. Click **Load unpacked**
3. Select the folder you chose in step 4 above
4. Click the **puzzle piece icon** in your browser toolbar → find this extension → click the **pin icon** to pin it

Then open [WhatsApp Web](https://web.whatsapp.com) and click the extension icon in your toolbar to start customising.

---

## 🛠 Manual Install (Alternative)

1. Download this repo as a ZIP and extract it anywhere, or clone it:

   ```bash
   git clone https://github.com/khanfaizaan432-stack/Whatsapp-Custom-Wallpaper.git
   ```

2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the folder containing `manifest.json`
6. Pin the extension via the puzzle piece icon in the toolbar

---

## 🎛️ How to Use

### Global theme (affects all chats)

1. Open [WhatsApp Web](https://web.whatsapp.com)
2. Click the **extension icon** in your toolbar
3. In the popup:
   - Set bubble colours for outgoing and incoming messages
   - Choose an image or video wallpaper for the main chat background
   - Toggle blur / glass effects on backgrounds and sidebars
   - Change the font family and font size
   - Tint the header and sidebar
4. Click **Apply Changes**

### Per-chat wallpaper (different wallpaper per conversation)

1. Open the specific chat in WhatsApp Web
2. Click the **three dots** (⋮) in the top-right of the chat header
3. Find the per-chat wallpaper section
4. Set your wallpaper and apply

### Maintenance options

The extension also includes a maintenance page for local data management:

1. Open `chrome://extensions` or `edge://extensions`
2. Find **WhatsApp Themes**
3. Click **Details**
4. Click **Extension options**

From there you can:

- view extension storage usage
- export settings to JSON
- import a settings backup
- clear theme settings
- delete locally stored video wallpapers
- factory reset the extension

Video blobs stored in IndexedDB are not included in JSON backups, so keep original video files if you want to reuse them later.

---

## 📁 Project Structure

```text
manifest.json                  — Extension metadata, permissions, content script config
popup.html                     — Popup UI for global and per-chat theme controls
popup.css                      — Popup styling
popup.js                       — Popup logic: settings, wallpaper preview, tab sync
options.html                   — Maintenance UI for backup/import/reset tools
options.js                     — Maintenance logic for storage cleanup and settings export/import
content.js                     — Main WhatsApp Web styling/content script
content-patch.js               — Defensive selector fallback and stability patch
content-repair-trigger.js      — Re-apply trigger when WhatsApp Web re-renders major DOM regions
background.js                  — Minimal service worker for extension lifecycle
icons/                         — Extension icons
scripts/validate-extension.mjs — Manifest/file/syntax validator
PRIVACY.md                     — Local-storage/privacy policy
```

---

## ✅ Developer Validation

This repo has a lightweight validation script so broken extension files are caught before merging.

```bash
npm test
```

The validator checks:

- required extension files exist
- `manifest.json` is valid MV3 JSON
- manifest content scripts, popup, options page, and icons point to real files
- JavaScript files parse without syntax errors
- unexpected extension permissions are not introduced
- README clone instructions point to this repository

GitHub Actions runs the same validation on pull requests and pushes to `main`.

---

## ❗ Troubleshooting

<details>
<summary><strong>I can't find or open the extension popup</strong></summary>

The extension icon needs to be pinned to your toolbar to access the menu.

- Click the puzzle piece icon (🧩) in your browser toolbar
- Find **WhatsApp Custom Wallpaper** and click the pin icon next to it
- The icon will now appear in your toolbar — click it while on WhatsApp Web
</details>

<details>
<summary><strong>Extension won't load</strong></summary>

- Make sure the selected folder contains `manifest.json`
- Confirm Developer mode is enabled in `chrome://extensions`
- Check for error details on the extensions page
- Run `npm test` if you are editing the project locally
</details>

<details>
<summary><strong>Changes aren't showing on WhatsApp Web</strong></summary>

- Make sure you clicked **Apply Changes** in the popup
- Go to `chrome://extensions` and click **Reload** on this extension
- Refresh the WhatsApp Web tab
- Open a chat before using per-chat settings
</details>

<details>
<summary><strong>Extension disappeared after a browser update</strong></summary>

Go to `chrome://extensions`, click **Load unpacked**, and select your installation folder again. Then re-pin it.
</details>

<details>
<summary><strong>Per-chat wallpaper not applying</strong></summary>

- Open the specific chat in WhatsApp Web
- Click the three dots (⋮) at the top-right of the chat
- Find the per-chat wallpaper section and re-apply
</details>

<details>
<summary><strong>Storage is getting huge / videos feel slow</strong></summary>

Open the extension's **Options** page from `chrome://extensions` → **Details** → **Extension options**. Use **Delete video storage** or **Factory reset** to remove locally stored video wallpapers.
</details>

<details>
<summary><strong>WhatsApp Web updated and styling broke</strong></summary>

WhatsApp occasionally changes their page structure, which can break injected styles. Reload the extension at `chrome://extensions` and refresh the WhatsApp Web tab. The extension includes fallback/re-apply scripts, but major WhatsApp DOM changes may still require an update.
</details>

---

## 📋 Permissions Used

| Permission | Why |
|---|---|
| `storage` / `unlimitedStorage` | Saves your theme settings and wallpapers locally in the browser |
| `activeTab` / `tabs` | Communicates with the active WhatsApp Web tab to apply changes |
| `https://web.whatsapp.com/*` | Allows the content script to inject styles into WhatsApp Web |

No data is collected or sent anywhere. Everything is stored locally in your browser. See [PRIVACY.md](PRIVACY.md) for details.

---

## 📝 Notes

- Works with **WhatsApp Web only** — not the desktop app
- Wallpapers are stored locally in browser extension storage / IndexedDB, so no external files are needed
- Large video wallpapers can consume browser storage; remove unused per-chat wallpapers if the browser feels slow
- JSON backups include settings, but not IndexedDB video blobs
- If WhatsApp Web updates and something breaks, reload the extension and refresh WhatsApp Web first
