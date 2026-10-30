#!/usr/bin/env node
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

/** Inspect exact device records, never mistake a simulator or Watch for a phone. */
function selectIPhone(payload, requested) {
  if (!Array.isArray(payload?.result?.devices)) throw Error('Xcode returned an invalid device list.');
  const phones = payload.result.devices.filter(d => d?.hardwareProperties?.reality === 'physical'
    && d.hardwareProperties?.deviceType === 'iPhone' && d.connectionProperties?.pairingState === 'paired'
    && d.deviceProperties?.bootState === 'booted');
  const candidates = phones.filter(d => requested ? [d.identifier, d.hardwareProperties.udid].includes(requested)
    : d.hardwareProperties.productType === 'iPhone14,5');
  if (candidates.length !== 1) throw Error(candidates.length ? 'More than one iPhone 13 found. Set VIGOR_DEVICE_UDID to choose one.'
    : 'No matching physical iPhone found. Connect and unlock your iPhone 13, enable Developer Mode and trust this Mac.');
  if (candidates[0].deviceProperties.developerModeStatus === 'disabled') throw Error('Enable Developer Mode on your iPhone before installing. No settings were changed.');
  const udid = candidates[0].hardwareProperties.udid;
  if (typeof udid !== 'string' || !/^[0-9a-f-]{16,}$/i.test(udid)) throw Error('Xcode returned an invalid physical device identifier.');
  return udid;
}

function deploy({ root = path.resolve(__dirname, '..'), env = process.env,
  exists = fs.existsSync, run = (command, args, capture = false) => spawnSync(command, args,
    { cwd: root, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' }), log = console.log } = {}) {
  const checked = (command, args, capture) => {
    const result = run(command, args, capture);
    if (result.error || result.status !== 0) throw Error(`${command} failed. ${result.error?.message ?? 'See output above.'}`);
    return result.stdout;
  };
  const workspace = path.join(root, 'ios/vigor.xcworkspace');
  if (!exists(workspace) || !exists(path.join(root, 'node_modules'))) throw Error('Missing workspace or dependencies. Open this project and run npm ci first.');
  log('Finding your physical iPhone 13…');
  const payload = JSON.parse(checked('xcrun', ['devicectl', 'list', 'devices', '--json-output', '-', '--timeout', '45'], true));
  const device = selectIPhone(payload, env.VIGOR_DEVICE_UDID);
  const derived = path.resolve(root, env.VIGOR_DERIVED_DATA || 'ios/build');
  log('Building the latest source incrementally. Xcode reuses unchanged native files; JavaScript is refreshed.');
  checked('xcodebuild', ['-workspace', workspace, '-scheme', env.VIGOR_SCHEME || 'vigor', '-configuration', 'Release',
    '-sdk', 'iphoneos', '-destination', `id=${device}`, '-derivedDataPath', derived, 'build']);
  const app = path.join(derived, 'Build/Products/Release-iphoneos/vigor.app');
  if (!exists(app)) throw Error('The build did not produce vigor.app. Nothing was installed.');
  checked('codesign', ['--verify', '--deep', '--strict', app]);
  log('Installing over the existing Vigor app. No uninstall or data reset.');
  checked('xcrun', ['devicectl', 'device', 'install', 'app', '--device', device, app, '--timeout', '120']);
  log('Installed successfully. Opening Vigor…');
  try { checked('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', device, 'com.franciscobecerra.vigor', '--timeout', '60']); }
  catch { throw Error('Vigor IS INSTALLED, but could not open. Unlock your iPhone and open Vigor manually. No need to reinstall.'); }
  log('Vigor is installed and launched on your iPhone.');
}

module.exports = { selectIPhone, deploy };
if (require.main === module) {
  if (process.argv.includes('--help')) console.log('Connect and unlock your iPhone 13, then run scripts/deploy-iphone.sh. Optional: VIGOR_DEVICE_UDID, VIGOR_DERIVED_DATA, VIGOR_SCHEME. No Codex or subscription required.');
  else if (process.argv.length > 2) { console.error('Unknown argument. Use --help for usage.'); process.exitCode = 1; }
  else { try { deploy(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
}
