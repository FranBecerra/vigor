/** Synthetic CPU guard only. No athlete reads, writes, permissions or network. */
import { performance } from 'node:perf_hooks';
import { saveCardioProposal } from '../src/services/cardio/savedCardioPlan';
import { createCardioBlock, improveCardioDates, type DatedStrength } from '../src/services/cardio/cardioBlock';
import { shiftCalendarDate } from '../src/services/training/trainingCalendar';
import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '../src/test-support/cardioFixture';
import { withCardioProgression } from '../src/services/cardio/cardioProgression';
import { reviewHybridCapacity } from '../src/services/cardio/hybridCapacity';
import { saveSportDraft } from '../src/services/cardio/sportActivities';
import { suggestHybridRhythm } from '../src/services/cardio/hybridRhythm';
import { vigorPlanningHistory } from '../src/services/cardio/planningHistory';
import { reviewCardioHealth } from '../src/services/cardio/cardioHealthReview';
import { planningHistoryFixture } from '../src/test-support/planningHistoryFixture';
import { buildCardioPreview } from '../src/services/cardio/cardioPreview';

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

const sports = Array.from({ length: 52 }, (_, i) => saveSportDraft(`class-${i}`, 'owner', {
  sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'PLAN', effort: null,
  startAt: Date.parse(`${shiftCalendarDate(large.startDate, i * 4)}T23:30:00Z`), durationMinutes: 90, timeZone: 'Europe/Madrid',
}, now));
const progressive = withCardioProgression(balancedLarge), measured: number[] = [];
for (let i = 0; i < 13; i++) {
  const started = performance.now();
  reviewHybridCapacity(progressive, { priority: 'BALANCED', totalMinutesPerCycle: 10000, maxSessionMinutes: 180 },
    sports, dense.map(s => ({ ...s, estimatedMinutes: 90 })));
  if (i >= 3) measured.push(performance.now() - started);
}
measured.sort((a, b) => a - b);
const p95 = measured[Math.ceil(measured.length * .95) - 1], budget = 50;
console.log(JSON.stringify({ workload: 'shared capacity 248 days / 52 classes / 112 cardio / 248 strength', p95Ms: Number(p95.toFixed(2)), budgetMs: budget, passed: p95 <= budget }));
if (p95 > budget) process.exitCode = 1;

const timerTemplate = planningHistoryFixture(now)[0];
const timerHistory = Array.from({ length: 1000 }, (_, i) => {
  const startedAt = now - (i + 1) * 3600000, finishedAt = startedAt + 60000;
  return { ...timerTemplate, id: `synthetic-history-${i}`, startedAt, finishedAt, updatedAt: finishedAt, actualSeconds: 60, elapsedMs: 60000 };
});
const historySamples: number[] = [];
for (let i = 0; i < 13; i++) {
  const started = performance.now();
  const reviewed = reviewCardioHealth(vigorPlanningHistory(timerHistory, 'owner', now), now);
  if (reviewed.countedCount !== 1000) throw Error('incompleteSyntheticHistory');
  if (i >= 3) historySamples.push(performance.now() - started);
}
historySamples.sort((a, b) => a - b);
const historyP95 = historySamples[Math.ceil(historySamples.length * .95) - 1];
console.log(JSON.stringify({ workload: 'adapt and review 1000 owned timer records', p95Ms: Number(historyP95.toFixed(2)), budgetMs: 50, passed: historyP95 <= 50 }));
if (historyP95 > 50) process.exitCode = 1;

const spacingSamples: number[] = [];
for (let i = 0; i < 13; i++) {
  const started = performance.now();
  buildCardioPreview({ placementPolicy: 'BALANCED_V2', spacingPolicy: 'SPREAD_EASY_V1', cycleDays: 31,
    availableDays: Array.from({ length: 31 }, (_, day) => day), sessions: 14, cardioMinutes: 560, sessionMinutes: 40,
    maxActiveDays: 31, allowDoubles: false, strength: [], modalities: ['CYCLING'],
    profile: { schemaVersion: 1, modalities: { CYCLING: { status: 'REGULAR', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 40 } } } });
  if (i >= 3) spacingSamples.push(performance.now() - started);
}
spacingSamples.sort((a, b) => a - b);
const spacingP95 = spacingSamples[Math.ceil(spacingSamples.length * .95) - 1];
console.log(JSON.stringify({ workload: 'spread 14 easy workouts / 31 days', p95Ms: Number(spacingP95.toFixed(2)), budgetMs: 50, passed: spacingP95 <= 50 }));
if (spacingP95 > 50) process.exitCode = 1;

// No-wait yields isolate CPU cost; interaction/cancellation behavior has separate tests.
void (async () => {
  for (const days of [8, 31]) for (const spread of [false, true]) {
    const samples: number[] = [];
    for (let i = 0; i < 13; i++) {
      const started = performance.now();
      await suggestHybridRhythm({ placementPolicy: 'BALANCED_V2', ...(spread ? { spacingPolicy: 'SPREAD_EASY_V1' as const } : {}), modalities: ['RUNNING'],
        profile: { schemaVersion: 1, modalities: {} }, cycleDays: days,
        availableDays: Array.from({ length: days }, (_, day) => day), sessions: 2,
        cardioMinutes: 40, sessionMinutes: 20, maxActiveDays: 6, allowDoubles: false,
        strength: [0, 1, 2, 3].map(day => ({ id: String(day), name: 'Synthetic session', dayIndex: day,
          estimatedMinutes: 45, lowerBodyDemand: day === 1 ? 'HIGH' : 'LOW' })),
      }, { yieldControl: async () => undefined });
      if (i >= 3) samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * .95) - 1], budget = 50;
    console.log(JSON.stringify({ workload: `joint relative-day rhythm / ${days} days / ${spread ? 'spread easy' : 'legacy'}`, p95Ms: Number(p95.toFixed(2)), budgetMs: budget, passed: p95 <= budget }));
    if (p95 > budget) process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Complete strength candidate preparation/review, independent of athlete data.
async function benchmarkJointStructures() {
  const { hybridFixture } = await import('../src/test-support/hybridFixture');
  const { hybridTemplates } = await import('../src/services/cardio/hybridTemplates');
  const { planDoseFirstMesocycle } = await import('../src/services/training/mesocyclePlanner');
  const { ExperienceLevel, SplitStructure } = await import('../src/models');
  const { TrainingGoal } = await import('../src/services/training/volumePlan');
  const f = hybridFixture();
  const input = { level:ExperienceLevel.INTERMEDIATE,goal:TrainingGoal.HYPERTROPHY,split:SplitStructure.AUTO,
    catalogue:[...f.exercises.values()],seed:42,capacity:{sessionsPerMicrocycle:4,minutesPerSession:75} };
  const plan = planDoseFirstMesocycle(input), samples:number[] = [];
  for (let i=0;i<13;i++) {
    const started = performance.now(); hybridTemplates(input,plan);
    if (i>=3) samples.push(performance.now()-started);
  }
  samples.sort((a,b)=>a-b);
  const p95 = samples[Math.ceil(samples.length*.95)-1], budget = 100;
  console.log(JSON.stringify({workload:'joint strength template comparison',p95Ms:Number(p95.toFixed(2)),budgetMs:budget,passed:p95<=budget}));
  if (p95>budget) process.exitCode=1;
}
void benchmarkJointStructures();
