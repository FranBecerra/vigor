// Apply only HealthKit usage text and entitlements to the existing native tree.
const { compileModsAsync, withPlugins } = require('@expo/config-plugins');
const config = require('../app.json').expo;
const projectRoot = require('node:path').resolve(__dirname, '..');
compileModsAsync(withPlugins({ ...config, _internal: { projectRoot } }, [
  './plugins/withFreePersonalTeam', './plugins/withWorkoutHealth',
]), { projectRoot, platforms: ['ios'], assertMissingModProviders: true })
  .catch((error) => { console.error(error); process.exitCode = 1; });
