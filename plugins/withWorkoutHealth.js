const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

module.exports = function withWorkoutHealth(config) {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.healthkit'] = true;
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    mod.modResults.NSHealthUpdateUsageDescription = 'Save your completed strength and cardio workouts to Apple Health, including available cardio distance and heart rate, when you enable workout export.';
    mod.modResults.NSHealthShareUsageDescription = 'Read sleep, resting heart rate and HRV for Bio trends. With separate overnight opt-in, also read sleep-time pulse and available HRV (SDNN/RMSSD). An optional cardio review reads workout dates, activities, durations, distances, sources and available workout heart rate. With workout export on, an iPhone cardio session can also record available distance and sensor heart rate. Observations stay on this device.';
    return mod;
  });
};
