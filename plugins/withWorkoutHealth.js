const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

module.exports = function withWorkoutHealth(config) {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.healthkit'] = true;
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    mod.modResults.NSHealthUpdateUsageDescription = 'Save the start and end times of your completed strength workouts to Apple Health, only when you enable this option.';
    mod.modResults.NSHealthShareUsageDescription = 'Read sleep, resting heart rate and HRV for Bio trends. With separate overnight opt-in, also read sleep-time pulse and available HRV (SDNN/RMSSD). An optional cardio review reads workout dates, activities, durations, distances and sources. Observations stay on this device.';
    return mod;
  });
};
