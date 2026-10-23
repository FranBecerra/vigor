const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * The Expo Apple Authentication package adds its entitlement whenever it is
 * installed, even when ios.usesAppleSignIn is false. Free Personal Teams do
 * not support this capability, and Vigor does not expose Apple sign-in yet.
 * Register before native feature plugins: entitlement mods execute in reverse
 * registration order, so this guard must execute last. expo-widgets 57.0.26 adds
 * aps-environment even with enablePushNotifications:false. Vigor uses only
 * local notifications and local Live Activities, never APNs.
 * Keep this guard first in the plugin list, including scoped configuration.
 */
module.exports = function withFreePersonalTeam(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['com.apple.developer.applesignin'];
    delete config.modResults['aps-environment'];
    return config;
  });
};
