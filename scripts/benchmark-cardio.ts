/** Synthetic CPU guard only. No athlete reads, writes, permissions or network. */
import { performance } from 'node:perf_hooks';
import { saveCardioProposal } from '../src/services/cardio/savedCardioPlan';
import { createCardioBlock, improveCardioDates, type DatedStrength } from '../src/services/cardio/cardioBlock';
import { shiftCalendarDate } from '../src/services/training/trainingCalendar';
import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '../src/test-support/cardioFixture';
import { withCardioProgression } from '../src/services/cardio/cardioProgression';

const large = createCardioBlock('large', saveCardioProposal('p', 'owner', 'Synthetic large block', {
  modalities: ['RUNNING'], profile: { schemaVersion: 1, modalities: {} }, cycleDays: 31,
  availableDays: Array.from({ length: 31 }, (_, i) => i), sessions: 14, cardioMinutes: 1000,
  sessionMinutes: 30, maxActiveDays: 31, allowDoubles: false, strength: [],
}, null, now), '2026-10-29', 8, 'Europe/Madrid', now);
const dense: DatedStrength[] = Array.from({ length: 248 }, (_, i) => ({ id: String(i), date: shiftCalendarDate(large.startDate, i), demand: 'HIGH' }));
const balancedLarge = createCardioBlock('balanced-large', saveCardioProposal('balanced-p', 'owner', 'Synthetic balanced block', {
  ...large.proposal.input, placementPolicy: 'BALANCED_V2',
}, null, now), large.startDate, large.cycles, large.timeZone, now);
for (const [name, block, context, budget] of [
  ['ordinary eight-day cycle', cardioFixture(), [{ id: 'lower', date: '2026-10-29', demand: 'HIGH' }], 50],
  ['maximal dense 248-day horizon', large, dense, 350],
  ['balanced v2 dense 248-day horizon', balancedLarge, dense.map(s => ({ ...s, estimatedMinutes: 90 })), 350],
  ['reviewed progression dense 248-day horizon', withCardioProgression(balancedLarge), dense, 350],
] as const) {
  const samples: number[] = [];
  for (let i = 0; i < 13; i++) {
    const started = performance.now(); improveCardioDates(block, [], context, [], now + 1);
    if (i >= 3) samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b); const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
  console.log(JSON.stringify({ workload: name, p95Ms: Number(p95.toFixed(2)), budgetMs: budget, passed: p95 <= budget }));
  if (p95 > budget) process.exitCode = 1;
}
