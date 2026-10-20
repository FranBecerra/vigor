jest.mock('@expo/config-plugins', () => ({ withXcodeProject: (config: unknown, action: (config: unknown) => unknown) => action(config) }));
const plugin = require('../../../../plugins/withWorkoutWidgetEmbedding');
const { orderExtensionEmbedding } = plugin;
const phases = ['Sources', 'Frameworks', 'Resources', 'Bundle React Native code and images', '[CP-User] [RNFB] Core Configuration', 'Embed Foundation Extensions']
  .map((comment, index) => ({ comment, value: String(index) }));
it('embeds before the Firebase/plist script without changing any phase identity or unrelated order', () => {
  const ordered = orderExtensionEmbedding(phases);
  expect(ordered.map((phase: any) => phase.comment)).toEqual(['Sources', 'Frameworks', 'Resources', 'Embed Foundation Extensions', 'Bundle React Native code and images', '[CP-User] [RNFB] Core Configuration']);
  expect(phases.at(-1)!.comment).toBe('Embed Foundation Extensions');
  expect(orderExtensionEmbedding(ordered)).toEqual(ordered);
  const target = { buildPhases: phases };
  plugin({ modResults: { getFirstTarget: () => ({ firstTarget: target }) } });
  expect(target.buildPhases).toEqual(ordered);
});
it('handles missing extensions/resources and empty targets', () => {
  expect(orderExtensionEmbedding([])).toEqual([]);
  expect(orderExtensionEmbedding(phases.slice(0, 3))).toEqual(phases.slice(0, 3));
  expect(orderExtensionEmbedding([phases[3], phases[5]])[0]).toEqual(phases[5]);
});
