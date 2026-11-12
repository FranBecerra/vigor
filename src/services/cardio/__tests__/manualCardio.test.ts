import { buildCardioPreview, cardioPreviewIssue, strengthPlacements, type CardioPreviewInput } from '../cardioPreview';
import { createCardioBlock } from '../cardioBlock';
import { withCardioProgression } from '../cardioProgression';
import { advanceManualCardioPhase, cardioPhase, startCardioWorkout, transitionCardioWorkout, validCardioWorkout } from '../cardioWorkout';
import { manualScheduledMinutes, validManualSession, type ManualCardioSession } from '../manualCardio';
import { saveCardioProposal, validSavedCardioPlan } from '../savedCardioPlan';
import { prepareHybridBundle, validHybridBundle } from '../hybridAuthoring';
import { toRoutineView } from '@/services/training/routineView';
import { hybridFixture } from '@/test-support/hybridFixture';

const now = 1800000000000;
const run: ManualCardioSession = { modality: 'RUNNING', dayIndex: 2, phases: {
  WARMUP: { durationSeconds: 300 }, MAIN: { distanceMetres: 5000, paceSecondsPerKm: { fast: 345, slow: 375 }, heartRateZone: 2 },
} };
const input = (manualSessions: ManualCardioSession[] = [run]): CardioPreviewInput => ({
  manualSessions, modalities: ['RUNNING'], profile: { schemaVersion: 1, modalities: {} },
  placementPolicy: 'BALANCED_V2', doublePolicy: 'STRENGTH_CARDIO_ONLY_V1', cycleDays: 7, availableDays: [0, 1, 2, 3, 4, 5, 6],
  sessions: manualSessions.length, maxActiveDays: 5, sessionMinutes: 60, cardioMinutes: 120, allowDoubles: false, strength: [],
});
it('saves the authored day and phase targets and estimates calendar time at the slow end of the range', () => {
  expect(manualScheduledMinutes(run)).toBe(37);
  const saved = saveCardioProposal('manual', 'owner', 'Run', input(), null, now);
  expect(saved.policy).toBe('CARDIO_MANUAL_V1');
  expect(saved.preview.scheduled[0]).toMatchObject({ dayIndex: 2, durationMinutes: 37, stimulus: 'MANUAL' });
  expect(saved.preview.prescriptions[0]).toMatchObject({ policy: 'MANUAL_PHASES_V1', segments: [
    { phase: 'WARMUP', targets: { durationSeconds: 300 } }, { phase: 'MAIN', targets: run.phases.MAIN },
  ] });
  const derived = buildCardioPreview(input()).prescriptions[0];
  if (derived.policy !== 'MANUAL_PHASES_V1') throw Error('Expected a manual prescription');
  derived.segments[1].targets.paceSecondsPerKm!.fast = 600;
  expect(run.phases.MAIN?.paceSecondsPerKm?.fast).toBe(345);
  expect(validSavedCardioPlan(JSON.parse(JSON.stringify(saved)), 'owner')).toBe(true);
  expect(validSavedCardioPlan(saved, 'someone-else')).toBe(false);
  expect(validSavedCardioPlan({ ...saved, preview: { ...saved.preview, usedMinutes: 1 } }, 'owner')).toBe(false);
});
it.each([
  { phases: {} }, { phases: { MAIN: { paceSecondsPerKm: { fast: 380, slow: 350 } } } },
  { phases: { MAIN: { heartRateZone: 6 } } }, { phases: { MAIN: { distanceMetres: -1 } } },
  { phases: { MAIN: { durationSeconds: NaN } } }, { modality: 'MACHINE' }, { dayIndex: 7 },
  { phases: { MAIN: { durationSeconds: 36000 }, COOLDOWN: { heartRateZone: 1 }, WARMUP: { durationSeconds: 60 } } },
])('rejects invalid manual targets or incompatible modalities: %j', patch => {
  expect(validManualSession({ ...run, ...patch }, 7)).toBe(false);
});
it('allows a standalone untimed phase and blocks duplicate days and over-budget sessions', () => {
  const untimed: ManualCardioSession = { ...run, phases: { MAIN: { heartRateZone: 2 } } };
  expect(buildCardioPreview(input([untimed])).prescriptions[0].durationSeconds).toBe(0);
  expect(cardioPreviewIssue(input([run, untimed]))).toBe('MANUAL_SESSIONS');
  expect(cardioPreviewIssue({ ...input(), sessionMinutes: 30 })).toBe('MANUAL_SESSIONS');
  expect(cardioPreviewIssue({ ...input(), availableDays: [0, 1] })).toBe('MANUAL_SESSIONS');
});
it('requires known calendar time and valid double-session settings for a linked hybrid', () => {
  const f = hybridFixture(), view = toRoutineView(f.draft.routine, f.draft.mesocycle, f.exercises, f.labels)!;
  const strength = strengthPlacements(view, true).sessions;
  const day = [0, 1, 2, 3, 4, 5, 6].find(d => !strength.some(s => s.dayIndex === d))!;
  const untimed = { ...run, dayIndex: day, phases: { MAIN: { heartRateZone: 2 } } };
  expect(cardioPreviewIssue({ ...input([untimed]), strength })).toBe('MANUAL_SESSIONS');
  const authored = { ...input([{ ...untimed, estimatedMinutes: 30 }]), strength };
  const bundle = prepareHybridBundle(f.draft, authored, { priority: 'BALANCED', totalMinutesPerCycle: 240, maxSessionMinutes: 120 }, f.exercises, f.labels, now);
  expect(validHybridBundle(bundle, 'owner')).toBe(true);
  expect(bundle.cardio.preview.scheduled[0].dayIndex).toBe(day);
  const collision = { ...authored, manualSessions: [{ ...run, dayIndex: strength[0].dayIndex! }] };
  expect(cardioPreviewIssue(collision)).toBe('MANUAL_SESSIONS');
  expect(cardioPreviewIssue({ ...collision, allowDoubles: true })).toBeNull();
});
it('resumes manual phase state and does not confuse distance estimates with timed targets', () => {
  const proposal = saveCardioProposal('manual', 'owner', 'Run', input(), null, now);
  const block = withCardioProgression(createCardioBlock('block', proposal, '2027-01-15', 2, 'UTC', now));
  expect(block.progression).toBeUndefined();
  const workout = startCardioWorkout(block, block.slots[0].id, now, 'workout');
  expect(cardioPhase(workout, now + 120_000)).toMatchObject({ phase: 'WARMUP', remaining: 180 });
  const advanced = advanceManualCardioPhase(workout, now + 300_000);
  const paused = transitionCardioWorkout(advanced, 'PAUSE', now + 400_000);
  expect(() => advanceManualCardioPhase(paused, now + 450_000)).toThrow();
  const resumed = transitionCardioWorkout(JSON.parse(JSON.stringify(paused)), 'RESUME', now + 600_000);
  expect(cardioPhase(resumed, now + 650_000)).toMatchObject({ phase: 'MAIN', remaining: null, targets: run.phases.MAIN });
  expect(validCardioWorkout({ ...resumed, manualPhase: { index: 10, startedAtElapsedMs: 0 } }, 'owner')).toBe(false);
  const done = advanceManualCardioPhase(resumed, now + 800_000);
  expect(cardioPhase(done, now + 800_000).phase).toBe('READY');
  expect(transitionCardioWorkout(done, 'FINISH', now + 810_000, 612, 5).actualSeconds).toBe(612);
});
