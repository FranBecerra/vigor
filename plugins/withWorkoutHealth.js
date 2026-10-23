const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

module.exports = function withWorkoutHealth(config) {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.healthkit'] = true;
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    mod.modResults.NSHealthUpdateUsageDescription = 'Save the start and end times of your completed strength workouts to Apple Health, only when you enable this option.';
    return mod;
  });
};
