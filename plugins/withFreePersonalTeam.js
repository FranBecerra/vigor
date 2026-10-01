const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * The Expo Apple Authentication package adds its entitlement whenever it is
 * installed, even when ios.usesAppleSignIn is false. Free Personal Teams do
 * not support this capability, and Vigor does not expose Apple sign-in yet.
 */
module.exports = function withFreePersonalTeam(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['com.apple.developer.applesignin'];
    return config;
  });
};
