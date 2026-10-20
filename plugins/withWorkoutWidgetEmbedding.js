const { withXcodeProject } = require('@expo/config-plugins');

/** Embed extensions before scripts that consume/mutate the containing Info.plist. */
function orderExtensionEmbedding(phases) {
  const embedded = phases.filter((phase) => phase.comment === 'Embed Foundation Extensions');
  if (!embedded.length) return [...phases];
  const remaining = phases.filter((phase) => phase.comment !== 'Embed Foundation Extensions');
  const resources = remaining.findIndex((phase) => phase.comment === 'Resources');
  remaining.splice(resources < 0 ? 0 : resources + 1, 0, ...embedded);
  return remaining;
}

module.exports = function withWorkoutWidgetEmbedding(config) {
  return withXcodeProject(config, (config) => {
    const target = config.modResults.getFirstTarget().firstTarget;
    target.buildPhases = orderExtensionEmbedding(target.buildPhases);
    return config;
  });
};
module.exports.orderExtensionEmbedding = orderExtensionEmbedding;
