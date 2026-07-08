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
  'options.html',
  'options.js',
  'content.js',
  'content-patch.js',
  'content-repair-trigger.js',
  'background.js',
  'README.md',
  'PRIVACY.md',
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function readJson(file) {
  const fullPath = path.join(root, file);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`Missing required file: ${file}`);
  }
}

const manifest = readJson('manifest.json');
const packageJson = readJson('package.json');

if (manifest) {
  if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
  if (!manifest.name) fail('manifest.name is required');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) fail('manifest.version must be semver-like, e.g. 1.3.0');

  const scripts = manifest.content_scripts?.flatMap(entry => entry.js || []) || [];
  for (const script of scripts) {
    if (!fs.existsSync(path.join(root, script))) fail(`Manifest references missing content script: ${script}`);
  }

  const popup = manifest.action?.default_popup;
  if (popup && !fs.existsSync(path.join(root, popup))) fail(`Manifest references missing popup: ${popup}`);

  const optionsPage = manifest.options_page;
  if (optionsPage && !fs.existsSync(path.join(root, optionsPage))) fail(`Manifest references missing options page: ${optionsPage}`);

  const serviceWorker = manifest.background?.service_worker;
  if (serviceWorker && !fs.existsSync(path.join(root, serviceWorker))) {
    fail(`Manifest references missing service worker: ${serviceWorker}`);
  }

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

for (const file of ['popup.js', 'options.js', 'content.js', 'content-patch.js', 'content-repair-trigger.js', 'background.js']) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  try {
    new vm.Script(fs.readFileSync(fullPath, 'utf8'), { filename: file });
  } catch (error) {
    fail(`${file} has a JavaScript syntax error: ${error.message}`);
  }
}

const readme = fs.existsSync(path.join(root, 'README.md'))
  ? fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  : '';
if (readme.includes('ApexBlue11/Whatsapp-Custom-Wallpaper')) {
  fail('README still points to the old ApexBlue11 clone URL');
}

if (!process.exitCode) {
  console.log('✅ Extension validation passed');
}
