import { metricTone } from '../BioMetricVisual';
import type { BioHealthMetric } from '@/models/bioHealth';
import type { MetricPosition } from '@/services/bio/metricMonitor';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import fr from '@/i18n/locales/fr.json';
import ja from '@/i18n/locales/ja.json';

it.each([
  ['RESTING_HR', 'WITHIN', 'green'], ['RESTING_HR', 'BELOW', 'blue'], ['RESTING_HR', 'ABOVE', 'amber'],
  ['HRV_SDNN', 'WITHIN', 'green'], ['HRV_SDNN', 'ABOVE', 'blue'], ['HRV_SDNN', 'BELOW', 'amber'],
  ['SLEEP', 'TARGET_MET', 'green'], ['SLEEP', 'TARGET_BELOW', 'amber'],
  [undefined, 'ABOVE', 'amber'], [undefined, 'BELOW', 'amber'],
  ...(['RESTING_HR', 'HRV_SDNN', 'SLEEP'] as const).flatMap(metric =>
    (['STALE', 'MISSING', 'ERROR', 'BUILDING', 'GOAL_MISSING'] as const).map(position => [metric, position, 'neutral'])),
] as [BioHealthMetric | undefined, MetricPosition, string][])('uses %s / %s as %s without calling a directional departure better recovery', (metric, position, tone) => {
  expect(metricTone({ position, days: [] }, metric)).toBe(tone);
});
it('has the same cue/completion translation contract in all four locales', () => {
  for (const dictionary of [es, fr, ja]) expect(Object.keys(dictionary.executionPolish).sort()).toEqual(Object.keys(en.executionPolish).sort());
});
