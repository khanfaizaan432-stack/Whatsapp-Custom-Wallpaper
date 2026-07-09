import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const requiredFiles = [
  'manifest.json',
  'package.json',
  'popup.html',
  'popup.css',
  'popup.js',
  'popup-patch.js',
  'popup-diagnostics.js',
  'popup-layout.js',
  'options.html',
  'options.js',
  'content.js',
  'content-patch.js',
  'content-repair-trigger.js',
  'content-diagnostics.js',
  'content-sidebar-fallback.js',
  'background.js',
  'README.md',
  'PRIVACY.md',
  'CHANGELOG.md',
  'docs/ARCHITECTURE.md',
  'docs/RELEASE_CHECKLIST.md',
  'shared/theme-defaults.js',
  'shared/theme-presets.js',
];

const forbiddenRootFiles = [
  '__dummy__.txt',
  'branch-check-placeholder.txt',
  'PLEASE_IGNORE_TEMP',
  'not-branch-command.txt',
  'create_branch',
  'branch-probe.txt',
  '.tmp',
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing required file: ${file}`);
}

for (const file of forbiddenRootFiles) {
  if (fs.existsSync(path.join(root, file))) fail(`Temporary/debug file must not be committed: ${file}`);
}

const manifest = readJson('manifest.json');
const packageJson = readJson('package.json');

if (manifest) {
  if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
  if (!manifest.name) fail('manifest.name is required');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) fail('manifest.version must be semver-like, e.g. 1.7.2');

  const scripts = manifest.content_scripts?.flatMap(entry => entry.js || []) || [];
  for (const script of scripts) {
    if (!fs.existsSync(path.join(root, script))) fail(`Manifest references missing content script: ${script}`);
  }
  if (!scripts.includes('content-diagnostics.js')) fail('manifest.json must load content-diagnostics.js');
  if (!scripts.includes('content-sidebar-fallback.js')) fail('manifest.json must load content-sidebar-fallback.js');

  const popup = manifest.action?.default_popup;
  if (popup && !fs.existsSync(path.join(root, popup))) fail(`Manifest references missing popup: ${popup}`);

  const optionsPage = manifest.options_page;
  if (optionsPage && !fs.existsSync(path.join(root, optionsPage))) fail(`Manifest references missing options page: ${optionsPage}`);

  const serviceWorker = manifest.background?.service_worker;
  if (serviceWorker && !fs.existsSync(path.join(root, serviceWorker))) fail(`Manifest references missing service worker: ${serviceWorker}`);

  for (const [size, iconPath] of Object.entries(manifest.icons || {})) {
    if (!fs.existsSync(path.join(root, iconPath))) fail(`Manifest icon ${size} missing: ${iconPath}`);
  }

  const allowedPermissions = new Set(['storage', 'unlimitedStorage', 'activeTab', 'tabs']);
  for (const permission of manifest.permissions || []) {
    if (!allowedPermissions.has(permission)) fail(`Unexpected permission: ${permission}`);
  }
}

if (manifest && packageJson && manifest.version !== packageJson.version) {
  fail(`manifest.json version (${manifest.version}) must match package.json version (${packageJson.version})`);
}

for (const file of [
  'popup.js',
  'popup-patch.js',
  'popup-diagnostics.js',
  'popup-layout.js',
  'options.js',
  'content.js',
  'content-patch.js',
  'content-repair-trigger.js',
  'content-diagnostics.js',
  'content-sidebar-fallback.js',
  'background.js',
  'shared/theme-defaults.js',
  'shared/theme-presets.js',
]) {
  if (!fs.existsSync(path.join(root, file))) continue;
  try {
    new vm.Script(read(file), { filename: file });
  } catch (error) {
    fail(`${file} has a JavaScript syntax error: ${error.message}`);
  }
}

const popupHtml = fs.existsSync(path.join(root, 'popup.html')) ? read('popup.html') : '';
for (const script of ['popup.js', 'popup-patch.js', 'popup-diagnostics.js', 'popup-layout.js']) {
  if (!popupHtml.includes(`src="${script}"`)) fail(`popup.html must load ${script}`);
}

const popupPatch = fs.existsSync(path.join(root, 'popup-patch.js')) ? read('popup-patch.js') : '';
for (const sharedScript of ['shared/theme-defaults.js', 'shared/theme-presets.js']) {
  if (!popupPatch.includes(sharedScript)) fail(`popup-patch.js must load ${sharedScript}`);
}
if (!popupPatch.includes('WAThemeShared')) fail('popup-patch.js must consume WAThemeShared shared constants');

const popupDiagnostics = fs.existsSync(path.join(root, 'popup-diagnostics.js')) ? read('popup-diagnostics.js') : '';
for (const hook of ['GET_WA_THEME_DIAGNOSTICS', 'FORCE_WA_THEME_WALLPAPER']) {
  if (!popupDiagnostics.includes(hook)) fail(`popup-diagnostics.js must use ${hook}`);
}

const popupLayout = fs.existsSync(path.join(root, 'popup-layout.js')) ? read('popup-layout.js') : '';
for (const expected of ['wa-compact-mode', 'waFloatingApply', 'wa-section-collapse-btn', 'action-area']) {
  if (!popupLayout.includes(expected)) fail(`popup-layout.js must implement ${expected}`);
}

const contentDiagnostics = fs.existsSync(path.join(root, 'content-diagnostics.js')) ? read('content-diagnostics.js') : '';
if (!contentDiagnostics.includes('GET_WA_THEME_DIAGNOSTICS')) fail('content-diagnostics.js must handle GET_WA_THEME_DIAGNOSTICS');

const sidebarFallback = fs.existsSync(path.join(root, 'content-sidebar-fallback.js')) ? read('content-sidebar-fallback.js') : '';
for (const expected of ['FORCE_WA_THEME_SIDEBAR', 'wa-theme-sidebar-fallback-overlay', 'wa-theme-sidebar-fallback-tint', 'sidebarWallpaper', 'rectLooksLikeSidebar']) {
  if (!sidebarFallback.includes(expected)) fail(`content-sidebar-fallback.js must implement ${expected}`);
}

const optionsHtml = fs.existsSync(path.join(root, 'options.html')) ? read('options.html') : '';
if (!optionsHtml.includes('src="options.js"')) fail('options.html must load options.js');

const readme = fs.existsSync(path.join(root, 'README.md')) ? read('README.md') : '';
if (readme.includes('ApexBlue11/Whatsapp-Custom-Wallpaper')) fail('README still points to the old ApexBlue11 clone URL');
if (!readme.includes('Extension options')) fail('README should document the maintenance/options page');

const changelog = fs.existsSync(path.join(root, 'CHANGELOG.md')) ? read('CHANGELOG.md') : '';
if (manifest?.version && !changelog.includes(`## ${manifest.version}`)) {
  fail(`CHANGELOG.md must include an entry for ${manifest.version}`);
}

if (!process.exitCode) console.log('✅ Extension validation passed');
