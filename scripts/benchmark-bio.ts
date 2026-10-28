/** Synthetic CPU workloads only: no Health permissions, account reads or writes. */
import { performance } from 'node:perf_hooks';
import { buildHealthTrends } from '../src/services/bio/healthTrends';
import { bioExposureRows, bioPerformanceSeries } from '../src/services/bio/observations';
import { reviewVolumeResponse } from '../src/services/bio/volumeResponse';
import { buildBioCycles, createMicrocycleReview } from '../src/services/bio/microcycleReview';
import { EXERCISE_CATALOGUE } from '../src/services/training/exerciseCatalogue';
import { SetType, type Mesocycle, type WorkoutSession } from '../src/models';
import { BIO_HEALTH_METRICS, type BioHealthRead } from '../src/models/bioHealth';
import { BIO_NIGHT_METRICS, type BioNightRead } from '../src/models/bioNight';
import { buildNightObservations } from '../src/services/bio/nightObservations';
import { buildReadinessIndex } from '../src/services/bio/readinessIndex';
import { readinessFixture } from '../src/test-support/readinessFixture';
import { sessionContextFixture } from '../src/test-support/sessionContextFixture';
import { buildBioSessionContext } from '../src/services/bio/sessionContext';
import { buildMetricMonitor, metricChartSlots } from '../src/services/bio/metricMonitor';
import { metricMonitorFixture } from '../src/test-support/metricMonitorFixture';

const now = new Date(2026, 9, 26, 10).getTime();
const night = { version: 1, metrics: Object.fromEntries(BIO_NIGHT_METRICS.map((metric) => [metric, {
  error: false, truncated: false, samples: Array.from({ length: metric === 'SLEEP' ? 69 : metric === 'HEART_RATE' ? 50000 : 2500 }, (_, index) => {
    const day = index % 69, end = new Date(2026, 9, 26 - day, 7).getTime(), start = end - 8 * 3600000;
    const at = start + (Math.floor(index / 69) % 480) * 60000;
    return { id: `${metric}:${index}`, metric, sourceId: 'synthetic-watch', sourceName: 'Synthetic Watch', manuallyEntered: false,
      start: metric === 'SLEEP' ? start : at, end: metric === 'SLEEP' ? end : at, value: metric === 'SLEEP' ? 480 : 50,
      ...(metric === 'SLEEP' ? { sleepState: 'ASLEEP' } : {}) };
  }),
}])) } as BioNightRead;
const health = Object.fromEntries(BIO_HEALTH_METRICS.map((metric) => [metric, { error: false, truncated: false,
  samples: Array.from({ length: 20000 }, (_, index) => {
    const end = now - (index % 40) * 86400000 - Math.floor(index / 40) * 10000;
    return { id: `${metric}:${index}`, metric, start: end - 30000, end, value: metric === 'SLEEP' ? 0.5 : 50,
      sourceId: 'synthetic-watch', sourceName: 'Synthetic Watch', manuallyEntered: false };
  }) }])) as unknown as BioHealthRead;
const catalogue = new Map(EXERCISE_CATALOGUE.slice(0, 6).map((exercise) => [exercise.id, exercise]));
const history: WorkoutSession[] = Array.from({ length: 120 }, (_, index) => ({ id: `synthetic:${index}`, userId: 'synthetic',
  mesocycleId: 'synthetic-plan', microcycleId: `m${Math.floor(index / 3)}`, microcycleIndex: Math.floor(index / 3), plannedSessionIndex: 0,
  performedAt: now - (121 - index) * 86400000, completedAt: now - (121 - index) * 86400000 + 3600000,
  exercises: [...catalogue.values()].map((exercise, order) => ({ id: exercise.id, exerciseId: exercise.id,
    exerciseSnapshot: exercise, order, isSwap: false, sets: Array.from({ length: 3 }, (_, set) => ({ id: `${index}:${order}:${set}`,
      setType: SetType.NORMAL, targetWeight: 40, targetReps: 10, targetRIR: 2, isAutoFilled: false,
      actualWeight: 40 + index, actualReps: 10, actualRIR: 2, actualRIRSource: 'ATHLETE', completionState: 'DONE' })) })) }));
const plan: Mesocycle = { id: 'synthetic-plan', userId: 'synthetic', status: 'ACTIVE', targetVolumePerGroup: {}, currentMicrocycleIndex: 39,
  sessionsPerMicrocycle: 1, startedAt: 1, updatedAt: 1, prescriptionMode: 'MANUAL', plannedSessions: [{ index: 0, focus: 'FULL_BODY', estimatedWorkMinutes: 60,
    exercises: [...catalogue.values()].map((exercise, order) => ({ exerciseId: exercise.id, order, isEdited: false,
      sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 }] })) }] };
const reviews = buildBioCycles('synthetic', [plan], history, now).filter((cycle) => cycle.closed).map((cycle) => createMicrocycleReview('synthetic', cycle,
  { recovery: 'USUAL', discomfort: 'NONE', sustainability: 'YES', unrecoveredMuscles: [] }, 'SUBMITTED', undefined, now));
const workloads: [string, () => unknown, number][] = [
  ['Overnight matching · 55,069 samples / 69 sleep episodes', () => buildNightObservations(night, now), 100],
  ['Health aggregation · 60,000 samples', () => buildHealthTrends(health, now), 100],
  ['Evolution · 120 workouts / 2,160 sets', () => { bioExposureRows('synthetic', history, catalogue, now, 'MICROCYCLE'); return bioPerformanceSeries('synthetic', history, catalogue, now); }, 50],
  ['Dose review · 40 observed microcycles', () => reviewVolumeResponse('synthetic', plan, history, reviews, catalogue, now), 50],
];
const monitorFixture = metricMonitorFixture(now);
workloads.push(['Metric cards + trend slots · three same-source histories', () => monitorFixture.map((trend) => metricChartSlots(buildMetricMonitor(trend, 495, now))), 5]);
const indexObservations = readinessFixture(69, now);
if (buildReadinessIndex(indexObservations, 480, now).score !== 100) throw Error('Synthetic readiness benchmark must exercise the complete calculation');
workloads.push(['Readiness index · 69 qualified nights / two HRV methods', () => buildReadinessIndex(indexObservations, 480, now), 10]);
const sessionFixture = sessionContextFixture();
const sessionInput = { ...sessionFixture, now, history, reviews,
  readiness: buildReadinessIndex(indexObservations, 480, now),
  plans: [{ ...plan, routineId: sessionFixture.routines[0].id, currentMicrocycleIndex: 40, projectedMicrocycles: 42 }], catalogue };
if (buildBioSessionContext(sessionInput).status !== 'AVAILABLE') throw Error('Synthetic session benchmark must resolve the complete context');
workloads.push(['Session context · 120 workouts / 40 microcycles', () => buildBioSessionContext(sessionInput), 20]);
for (const [name, action, budget] of workloads) {
  for (let warmup = 0; warmup < 5; warmup++) action();
  const samples = Array.from({ length: 30 }, () => { const start = performance.now(); action(); return performance.now() - start; }).sort((a, b) => a - b);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
  console.log(`${name}: p95 ${p95.toFixed(1)} ms / ${budget} ms budget`);
  if (p95 > budget) process.exitCode = 1;
}
