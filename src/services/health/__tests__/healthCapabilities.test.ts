const plugin = require('../../../../plugins/withWorkoutHealth');
const personalTeam = require('../../../../plugins/withFreePersonalTeam');
const { withEntitlementsPlist } = require('@expo/config-plugins');

it('retains workout writes and separately discloses optional local Bio reads, preserving widget groups', async () => {
  const config = plugin(personalTeam({ name: 'Vigor', slug: 'vigor' }));
  const entitlementConfig = withEntitlementsPlist(config, (mod: any) => {
    mod.modResults['aps-environment'] = 'development'; return mod;
  });
  const result = await entitlementConfig.mods.ios.entitlements({ ...entitlementConfig,
    modResults: { 'com.apple.security.application-groups': ['group.com.franciscobecerra.vigor'] }, modRequest: {} });
  expect(result.modResults).toEqual({ 'com.apple.developer.healthkit': true,
    'com.apple.security.application-groups': ['group.com.franciscobecerra.vigor'] });
  const info = await config.mods.ios.infoPlist({ ...config, modResults: { NSSupportsLiveActivities: true }, modRequest: {} });
  expect(info.modResults.NSHealthUpdateUsageDescription).toMatch(/start and end times/);
  expect(info.modResults.NSHealthShareUsageDescription).toMatch(/sleep, resting heart rate/);
  expect(info.modResults.NSHealthShareUsageDescription).toMatch(/separate overnight opt-in/);
  expect(info.modResults.NSHealthShareUsageDescription).toMatch(/SDNN\/RMSSD/);
  expect(info.modResults.NSHealthShareUsageDescription).toMatch(/optional cardio review reads workout dates, activities, durations, distances and sources/);
  expect(info.modResults.NSHealthShareUsageDescription).toMatch(/stay on this device/); expect(info.modResults.NSSupportsLiveActivities).toBe(true);
});
