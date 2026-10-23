const { withEntitlementsPlist } = require('@expo/config-plugins');
const personalTeamPlugin = require('../../../../plugins/withFreePersonalTeam');
async function compileEntitlements(config: any, entitlements: Record<string, unknown>) {
  const result = await config.mods.ios.entitlements({ ...config, modResults: entitlements, modRequest: {} });
  return result.modResults;
}

it('removes unsupported remote capabilities while preserving local widget groups', async () => {
  const entitlements = {
    'aps-environment': 'development',
    'com.apple.developer.applesignin': ['Default'],
    'com.apple.security.application-groups': ['group.com.franciscobecerra.vigor'],
    unrelated: true,
  };
  const config = personalTeamPlugin({ name: 'Vigor', slug: 'vigor' });
  const result = await compileEntitlements(config, entitlements);
  expect(result).toEqual({
    'com.apple.security.application-groups': ['group.com.franciscobecerra.vigor'], unrelated: true,
  });
  expect(await compileEntitlements(config, result)).toEqual(result);
  expect(await compileEntitlements(config, {})).toEqual({});
});

it('cleans entitlements after feature plugins using the real Expo mod chain', async () => {
  let config = personalTeamPlugin({ name: 'Vigor', slug: 'vigor' });
  config = withEntitlementsPlist(config, (mod: any) => {
    mod.modResults['aps-environment'] = 'development';
    mod.modResults['com.apple.security.application-groups'] = ['group.com.franciscobecerra.vigor'];
    return mod;
  });
  expect(await compileEntitlements(config, {})).toEqual({
    'com.apple.security.application-groups': ['group.com.franciscobecerra.vigor'],
  });
});

it('registers the guard first so reverse-order entitlement mods finish with it', () => {
  const plugins = require('../../../../app.json').expo.plugins;
  const names = plugins.map((entry: string | [string, unknown]) => Array.isArray(entry) ? entry[0] : entry);
  expect(names[0]).toBe('./plugins/withFreePersonalTeam');
  expect(names.indexOf('expo-notifications')).toBeGreaterThanOrEqual(0);
  expect(names.indexOf('./plugins/withFreePersonalTeam')).toBeLessThan(names.indexOf('expo-notifications'));
  expect(plugins.find((entry: unknown[]) => Array.isArray(entry) && entry[0] === 'expo-widgets')[1].enablePushNotifications).toBe(false);
});
