const { selectIPhone, deploy } = require('../deploy-iphone.cjs');
it('offers standalone help and rejects unknown flags without contacting Xcode', () => {
  const { spawnSync } = require('node:child_process'), { resolve } = require('node:path');
  const script = resolve(__dirname, '../deploy-iphone.cjs');
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  expect(help.status).toBe(0); expect(help.stdout).toContain('No Codex');
  const unknown = spawnSync(process.execPath, [script, '--unexpected'], { encoding: 'utf8' });
  expect(unknown.status).toBe(1); expect(unknown.stderr).toContain('Unknown argument');
});
const phone = (patch: any = {}) => ({ identifier: 'phone-id', hardwareProperties: { reality: 'physical', deviceType: 'iPhone', productType: 'iPhone14,5', udid: '00008110-00060D010A09801E' },
  deviceProperties: { bootState: 'booted', developerModeStatus: 'enabled' }, connectionProperties: { pairingState: 'paired' }, ...patch });
const payload = (devices: any[]) => ({ result: { devices } });
it('chooses the physical iPhone 13, not a simulator, Watch, unpaired, sleeping or different model', () => {
  const p = phone();
  expect(selectIPhone(payload([null, {}, phone({ hardwareProperties: { ...p.hardwareProperties, reality: 'simulated' } }),
    phone({ hardwareProperties: { ...p.hardwareProperties, deviceType: 'appleWatch' } }), phone({ connectionProperties: { pairingState: 'unpaired' } }),
    phone({ deviceProperties: { bootState: 'shutdown' } }), phone({ hardwareProperties: { ...p.hardwareProperties, productType: 'iPhone19,2' } }), p])))
    .toBe(p.hardwareProperties.udid);
  expect(selectIPhone(payload([p]), 'phone-id')).toBe(p.hardwareProperties.udid);
  expect(selectIPhone(payload([p]), p.hardwareProperties.udid)).toBe(p.hardwareProperties.udid);
});
it('rejects ambiguity, missing/invalid/disabled devices and invalid JSON shape before building', () => {
  for (const value of [{}, null, payload([]), payload([phone(), phone()]), payload([phone({ hardwareProperties: { reality: 'physical', deviceType: 'iPhone', productType: 'iPhone14,5', udid: 'bad' } })]),
    payload([phone({ deviceProperties: { bootState: 'booted', developerModeStatus: 'disabled' } })])]) expect(() => selectIPhone(value)).toThrow();
  expect(() => selectIPhone(payload([phone()]), 'not-this-phone')).toThrow();
});
function harness(failAt = -1, missingAt = -1) {
  let call = 0, check = 0;
  const run = jest.fn(() => ({ status: call++ === failAt ? 1 : 0, stdout: JSON.stringify(payload([phone()])) }));
  const exists = jest.fn(() => check++ !== missingAt);
  return { run, exists, options: { root: '/test/project with spaces', env: {}, exists, run, log: jest.fn() } };
}
it('incrementally builds current source, verifies signatures, installs in place and launches in order', () => {
  const h = harness(); deploy(h.options);
  expect(h.run.mock.calls.map((c: any[]) => c[0])).toEqual(['xcrun', 'xcodebuild', 'codesign', 'xcrun', 'xcrun']);
  const build = h.run.mock.calls[1] as any; expect(build[1]).toContain('/test/project with spaces/ios/vigor.xcworkspace'); expect(build[1]).toContain('id=00008110-00060D010A09801E');
  expect((h.run.mock.calls[3] as any)[1]).toContain('install');
  expect(JSON.stringify(h.run.mock.calls)).not.toMatch(/uninstall|reset|allowProvisioningUpdates/);
});
it.each([0, 1, 2, 3, 4])('stops at failure %i without attempting later steps or masking a failed launch as an uninstall', failAt => {
  const h = harness(failAt); expect(() => deploy(h.options)).toThrow(failAt === 4 ? 'IS INSTALLED' : 'failed');
  expect(h.run).toHaveBeenCalledTimes(failAt + 1);
});
it.each([0, 1, 2])('stops if a prerequisite or built product is missing (%i)', missing => {
  const h = harness(-1, missing); expect(() => deploy(h.options)).toThrow();
  expect(h.run).toHaveBeenCalledTimes(missing === 2 ? 2 : 0);
});
it('supports an explicit target/cache and stops on tool launch errors or malformed device output', () => {
  const h = harness(); deploy({ ...h.options, env: { VIGOR_DEVICE_UDID: 'phone-id', VIGOR_DERIVED_DATA: '/tmp/custom', VIGOR_SCHEME: 'vigor' } });
  expect((h.run.mock.calls[1] as any)[1]).toContain('/tmp/custom');
  expect(() => deploy({ ...h.options, run: () => ({ status: null, error: Error('missing Xcode') }) })).toThrow('missing Xcode');
  expect(() => deploy({ ...h.options, run: () => ({ status: 0, stdout: 'invalid' }) })).toThrow();
});
