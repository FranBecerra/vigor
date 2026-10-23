const plugin = require('../../../../plugins/withWorkoutHealth');
const personalTeam = require('../../../../plugins/withFreePersonalTeam');
const { withEntitlementsPlist } = require('@expo/config-plugins');

it('enables only workout HealthKit capability and a write-purpose disclosure, preserving widget groups', async () => {
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
  expect(info.modResults.NSHealthShareUsageDescription).toBeUndefined(); expect(info.modResults.NSSupportsLiveActivities).toBe(true);
});
