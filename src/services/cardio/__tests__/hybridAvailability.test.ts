import { MuscleGroup, SetType } from '@/models';
import { toRoutineView } from '@/services/training/routineView';
import { hybridFixture } from '@/test-support/hybridFixture';
import { hybridStrengthSessionCeiling, availabilityHybridSettings, strengthHybridTarget, suggestHybridFrequency, validHybridAvailability, withHybridAvailability, type HybridAvailability } from '../hybridAvailability';
import { buildCardioPreview, hybridLegSets } from '../cardioPreview';
import { prepareHybridBundle, validHybridBundle } from '../hybridAuthoring';
const base: HybridAvailability = { cycleDays: 8, trainingDays: 4, minutesPerSession: 60, allowDoubles: false };
it.each([null, {}, { ...base, cycleDays: 6 }, { ...base, cycleDays: 32 }, { ...base, cycleDays: NaN },
  { ...base, trainingDays: 2 }, { ...base, trainingDays: 9 }, { ...base, minutesPerSession: 0 }, { ...base, minutesPerSession: 181 },
  { ...base, minutesPerSession: 60.5 }, { ...base, allowDoubles: 'yes' }])('rejects malformed or infeasible availability %j', value => {
  expect(validHybridAvailability(value)).toBe(false);
});
it.each([7, 8, 10, 31])('derives independent workout slots in a %i-day cycle without changing legacy storage semantics', cycleDays => {
  const a = { ...base, cycleDays };
  expect(availabilityHybridSettings(a, 'BALANCED')).toEqual({ priority: 'BALANCED', totalMinutesPerCycle: 240, maxSessionMinutes: 60 });
  expect(availabilityHybridSettings({ ...a, allowDoubles: true }, 'CARDIO')).toEqual({ priority: 'CARDIO', totalMinutesPerCycle: 480, maxSessionMinutes: 60 });
  expect(validHybridAvailability({ ...a, trainingDays: 2, allowDoubles: true })).toBe(true);
});
it('preserves frequency and strength dose while applying a session ceiling and invalidating out-of-cycle placements', () => {
  const input = hybridFixture().input, before = JSON.stringify(input);
  input.sessionMinutes = 75; input.sessions = 3; input.strength[1].dayIndex = 7;
  const source = JSON.stringify(input), next = withHybridAvailability(input, { ...base, cycleDays: 7 });
  expect(next.sessionMinutes).toBe(60); expect(next.cardioMinutes).toBe(180); expect(next.sessions).toBe(3);
  expect(next.maxActiveDays).toBe(4); expect(next.allowDoubles).toBe(false); expect(next.availableDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(next.strength[1].dayIndex).toBeUndefined(); expect(next.strength[0]).toBe(input.strength[0]);
  expect(JSON.stringify(input)).toBe(source); expect(before).not.toBe(source);
  input.strength[1].dayIndex = undefined;
  expect(withHybridAvailability(input, base).strength[1].dayIndex).toBeUndefined();
  input.sessionMinutes = 20; expect(withHybridAvailability(input, base).sessionMinutes).toBe(20);
});
it('retains storage ceilings and rejects invalid shared settings rather than inventing capacity', () => {
  const large = { cycleDays: 31, trainingDays: 31, minutesPerSession: 180, allowDoubles: true };
  expect(availabilityHybridSettings(large, 'STRENGTH').totalMinutesPerCycle).toBe(10000);
  expect(withHybridAvailability({ ...hybridFixture().input, sessionMinutes: 180, sessions: 14 }, large).cardioMinutes).toBe(1440);
  expect(() => availabilityHybridSettings({ ...base, trainingDays: 0 }, 'BALANCED')).toThrow('invalidHybridAvailability');
  expect(() => withHybridAvailability(hybridFixture().input, { ...base, minutesPerSession: 0 })).toThrow('invalidHybridAvailability');
});
it('permits only one cardio per day and reports excess requests, retaining the policy across the linked save', () => {
  const f = hybridFixture(), a = { ...base, trainingDays: 2, allowDoubles: true };
  const input = withHybridAvailability({ ...f.input, sessions: 3 }, a), preview = buildCardioPreview(input);
  expect(preview.scheduled).toHaveLength(2); expect(preview.omitted).toHaveLength(1);
  expect(new Set(preview.scheduled.map(s => s.dayIndex)).size).toBe(2);
  const valid = { ...input, sessions: 2, cardioMinutes: 40 };
  const bundle = prepareHybridBundle(f.draft, valid, availabilityHybridSettings(a, 'BALANCED'), f.exercises, f.labels, 1800000000000);
  expect(bundle.cardio.input.doublePolicy).toBe('STRENGTH_CARDIO_ONLY_V1'); expect(validHybridBundle(bundle, 'owner')).toBe(true);
  expect(() => buildCardioPreview({ ...input, doublePolicy: 'unknown' as any })).toThrow('LIMITS');
});

it('gives the competing fourth day to the selected priority and converges when both targets fit', () => {
  for (const a of [base, { ...base, cycleDays: 7 }]) {
    expect(suggestHybridFrequency(a, 'STRENGTH')).toEqual({ strength: 3, cardio: 1 });
    for (const priority of ['CARDIO', 'BALANCED'] as const)
      expect(suggestHybridFrequency(a, priority)).toEqual({ strength: 2, cardio: 2 });
  }
  for (const priority of ['STRENGTH', 'CARDIO', 'BALANCED'] as const)
    expect(suggestHybridFrequency({ ...base, cycleDays: 7, allowDoubles: true }, priority)).toEqual({ strength: 4, cardio: 2 });
  expect(() => suggestHybridFrequency({ ...base, trainingDays: 1 }, 'CARDIO')).toThrow('invalidHybridAvailability');
});
it('keeps every suggested frequency feasible across supported cycle lengths', () => {
  for (let cycleDays = 7; cycleDays <= 31; cycleDays++)
    for (const allowDoubles of [false, true])
      for (let trainingDays = allowDoubles ? 2 : 3; trainingDays <= cycleDays; trainingDays++)
        for (const priority of ['STRENGTH', 'CARDIO', 'BALANCED'] as const) {
          const { strength, cardio } = suggestHybridFrequency({ ...base, cycleDays, trainingDays, allowDoubles }, priority);
          if (strength < 2 || strength > 7 || cardio < 1 || cardio > 14 ||
            (allowDoubles ? Math.max(strength, cardio) : strength + cardio) > trainingDays)
            throw Error(JSON.stringify({ cycleDays, trainingDays, allowDoubles, priority, strength, cardio }));
        }
});
it('counts direct lower-body working sets once, ignoring warmups and excluded exercises', () => {
  const { draft, exercises, labels } = hybridFixture();
  const view = toRoutineView(draft.routine, draft.mesocycle, exercises, labels)!;
  const session = view.microcycles[0].sessions[0], first = session.exercises[0];
  const leg = { ...first, primaryMuscle: MuscleGroup.QUADS, primaryMuscles: [MuscleGroup.GLUTES],
    sets: [{ setType: SetType.WARMUP }, { setType: SetType.NORMAL }] };
  session.exercises = [leg, { ...leg, excludeFromVolume: true }, first];
  expect(hybridLegSets(view).get(view.id + ':' + session.plannedSessionIndex)).toBe(1);
  expect(hybridLegSets({ ...view, microcycles: [] }).size).toBe(0);
});

it('uses experience for the starting proposal even when six days are available', () => {
  const available = { ...base, cycleDays: 7, trainingDays: 6 };
  expect(suggestHybridFrequency(available, 'BALANCED', strengthHybridTarget('BEGINNER' as any))).toEqual({ strength: 2, cardio: 2 });
  expect(suggestHybridFrequency(available, 'BALANCED', strengthHybridTarget('ADVANCED' as any))).toEqual({ strength: 4, cardio: 2 });
  expect(suggestHybridFrequency(available, 'BALANCED', strengthHybridTarget())).toEqual({ strength: 3, cardio: 2 });
});

it('reserves accessible cardio places while allowing a fourth hypertrophy session', () => {
  expect(hybridStrengthSessionCeiling({ ...base, trainingDays: 6 }, 'BALANCED')).toBe(4);
  expect(hybridStrengthSessionCeiling(base, 'STRENGTH')).toBe(3);
  expect(hybridStrengthSessionCeiling(base, 'CARDIO')).toBe(2);
  expect(hybridStrengthSessionCeiling({ ...base, trainingDays: 3 }, 'BALANCED')).toBe(2);
  expect(hybridStrengthSessionCeiling({ ...base, trainingDays: 5, allowDoubles: true }, 'STRENGTH')).toBe(5);
});
