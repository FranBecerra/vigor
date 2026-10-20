// Apply only the official widget plugin to the existing native project.
// Deliberately avoid prebuild --clean and unrelated Firebase/signing regeneration.
const { compileModsAsync, withPlugins } = require('@expo/config-plugins');
const config = require('../app.json').expo;
const projectRoot = require('node:path').resolve(__dirname, '..');
const nativeProject = require('xcode').project(require('node:path').join(projectRoot, 'ios/vigor.xcodeproj/project.pbxproj'));
nativeProject.parseSync();
const configured = Object.values(nativeProject.pbxNativeTargetSection()).some((target) => target?.name === 'ExpoWidgetsTarget');
const widgetConfig = config.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-widgets')[1];
const selectedPlugins = configured ? [] : [['expo-widgets', widgetConfig]];
selectedPlugins.push('./plugins/withWorkoutWidgetEmbedding');
compileModsAsync(withPlugins({ ...config, _internal: { projectRoot } }, selectedPlugins), {
  projectRoot, platforms: ['ios'], assertMissingModProviders: true,
}).catch((error) => { console.error(error); process.exitCode = 1; });
