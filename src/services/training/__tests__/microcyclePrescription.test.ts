import { SetType, type PlannedSession } from '@/models';
import {
  LOAD_INCREMENT_KG,
  STRENGTH_RIR_RAMP,
  TOP_SINGLE_RIR,
  loadForTarget,
  strengthRIR,
  strengthRestSeconds,
} from '@/services/training/exercisePrescription';
import { ExerciseProfile } from '@/models';
import {
  DEFAULT_PROJECTED_MICROCYCLES,
  DELOAD_RIR_INCREASE,
  isDeloadMicrocycle,
  prescriptionForMicrocycle,
  reloadForRIR,
} from '@/services/training/microcyclePrescription';
import { MAX_RIR } from '@/services/training/setIntensity';
import { TrainingGoal } from '@/services/training/volumePlan';

const strengthSession: PlannedSession = {
  index: 0,
  focus: 'LOWER',
  estimatedWorkMinutes: 60,
  exercises: [
    {
      exerciseId: 'sentadilla-libre',
      order: 0,
      isEdited: false,
      restSeconds: 240,
      strengthRole: 'MAIN',
      sets: [
        { setType: SetType.TOP_SINGLE, targetRepsMin: 1, targetReps: 1, targetRIR: TOP_SINGLE_RIR, targetWeightKg: 140 },
        { setType: SetType.NORMAL, targetRepsMin: 3, targetReps: 5, targetRIR: 3, targetWeightKg: 117.5 },
        { setType: SetType.NORMAL, targetRepsMin: 3, targetReps: 5, targetRIR: 3, targetWeightKg: 117.5 },
        { setType: SetType.NORMAL, targetRepsMin: 3, targetReps: 5, targetRIR: 3, targetWeightKg: 117.5 },
      ],
    },
    {
      exerciseId: 'plancha',
      order: 1,
      isEdited: false,
      restSeconds: 90,
      strengthRole: 'ACCESSORY',
      sets: [
        { setType: SetType.NORMAL, targetRepsMin: 6, targetReps: 10, targetRIR: 2 },
        { setType: SetType.NORMAL, targetRepsMin: 6, targetReps: 10, targetRIR: 2 },
        { setType: SetType.NORMAL, targetRepsMin: 6, targetReps: 10, targetRIR: 2 },
      ],
    },
    {
      exerciseId: 'custom',
      order: 2,
      isEdited: true,
      sets: [{ setType: SetType.NORMAL, targetReps: 8, targetRIR: 2 }],
    },
  ],
};

describe('strength parameters', () => {
  it('ramps RIR 3 → 1 over five accumulation microcycles, RPE 7 to 9', () => {
    expect([0, 1, 2, 3, 4].map((index) => strengthRIR('MAIN', index, 5))).toEqual([3, 3, 2, 2, 1]);
    expect([0, 1, 2, 3, 4].map((index) => strengthRIR('ACCESSORY', index, 5))).toEqual([2, 2, 2, 1, 1]);
  });

  it('clamps outside the accumulation and handles a one-microcycle block', () => {
    expect(strengthRIR('VARIANT', 9, 5)).toBe(STRENGTH_RIR_RAMP.VARIANT.end);
    expect(strengthRIR('COMPLEMENTARY', -1, 5)).toBe(STRENGTH_RIR_RAMP.COMPLEMENTARY.start);
    expect(strengthRIR('MAIN', 0, 1)).toBe(STRENGTH_RIR_RAMP.MAIN.start);
  });

  it('rests by role', () => {
    expect(strengthRestSeconds('MAIN', ExerciseProfile.COMPOUND_PRIMARY)).toBe(240);
    expect(strengthRestSeconds('VARIANT', ExerciseProfile.COMPOUND_PRIMARY)).toBe(240);
    expect(strengthRestSeconds('COMPLEMENTARY', ExerciseProfile.COMPOUND_PRIMARY)).toBe(180);
    expect(strengthRestSeconds('ACCESSORY', ExerciseProfile.COMPOUND_SECONDARY)).toBe(120);
    expect(strengthRestSeconds('ACCESSORY', ExerciseProfile.ISOLATION)).toBe(90);
  });

  it('derives loads by Epley over reps + RIR, rounded down to a plate', () => {
    // 5 reps at RIR 3 is an 8RM effort: 150 / (1 + 8/30) = 118.4 → 117.5.
    expect(loadForTarget(150, 5, 3)).toBe(117.5);
    // The top single at RPE 8 lands near 91 % of the e1RM.
    expect(loadForTarget(150, 1, TOP_SINGLE_RIR)).toBe(135);
    expect(loadForTarget(150, 5, 3) % LOAD_INCREMENT_KG).toBe(0);
    expect(loadForTarget(0, 5, 3)).toBe(0);
  });
});

describe('prescriptionForMicrocycle', () => {
  const horizon = DEFAULT_PROJECTED_MICROCYCLES;

  it('knows the deload is the last microcycle of a horizon longer than one', () => {
    expect(isDeloadMicrocycle(5, 6)).toBe(true);
    expect(isDeloadMicrocycle(4, 6)).toBe(false);
    expect(isDeloadMicrocycle(0, 1)).toBe(false);
  });

  it('applies the strength ramp by role and re-derives loads', () => {
    const [session] = prescriptionForMicrocycle([strengthSession], TrainingGoal.STRENGTH, 4, horizon);
    const squat = session.exercises[0];
    expect(squat.sets[0]).toEqual(strengthSession.exercises[0].sets[0]);
    squat.sets.slice(1).forEach((set) => {
      expect(set.targetRIR).toBe(1);
      expect(set.targetWeightKg).toBe(reloadForRIR(117.5, 5, 3, 1));
    });
    expect(squat.sets[1].targetWeightKg!).toBeGreaterThan(117.5);
    expect(session.exercises[1].sets.every((set) => set.targetRIR === 1)).toBe(true);
    expect(session.exercises[1].sets[0].targetWeightKg).toBeUndefined();
    expect(session.exercises[2]).toBe(strengthSession.exercises[2]);
  });

  it('keeps only explicitly edited RIR sets fixed while other strength sets ramp', () => {
    const customized: PlannedSession = { ...strengthSession, exercises: [
      { ...strengthSession.exercises[0], manualRIRBySet: { 2: 2 } },
      ...strengthSession.exercises.slice(1),
    ] };
    const [projected] = prescriptionForMicrocycle([customized], TrainingGoal.STRENGTH, 4, horizon);
    expect(projected.exercises[0].sets.map((set) => set.targetRIR)).toEqual([2, 1, 2, 1]);
    expect(projected.exercises[0].sets[2].targetWeightKg).toBe(reloadForRIR(117.5, 5, 3, 2));
  });

  it('leaves the first strength microcycle as stored', () => {
    const [session] = prescriptionForMicrocycle([strengthSession], TrainingGoal.STRENGTH, 0, horizon);
    expect(session.exercises[0].sets).toEqual(strengthSession.exercises[0].sets);
  });

  it('progresses hypertrophy effort over accumulation while preserving set order', () => {
    const hypertrophy: PlannedSession = {
      ...strengthSession,
      exercises: [{
        exerciseId: 'curl', order: 0, isEdited: false,
        sets: [3, 3, 2, 1].map((targetRIR) => ({
          setType: SetType.NORMAL, targetReps: 12, targetRIR,
        })),
      }],
    };
    const rir = [0, 1, 2, 3, 4].map((index) =>
      prescriptionForMicrocycle([hypertrophy], TrainingGoal.HYPERTROPHY, index, horizon)
        [0].exercises[0].sets.map((set) => set.targetRIR));
    expect(rir).toEqual([
      [3, 3, 2, 1],
      [3, 2, 2, 1],
      [2, 2, 2, 1],
      [2, 2, 1, 1],
      [2, 2, 1, 0],
    ]);
    expect(hypertrophy.exercises[0].sets.map((set) => set.targetRIR)).toEqual([3, 3, 2, 1]);
  });

  it('does not spend hypertrophy progression on a manually fixed RIR set', () => {
    const custom: PlannedSession = { index: 0, focus: 'UPPER', estimatedWorkMinutes: 20,
      exercises: [{ exerciseId: 'curl', order: 0, isEdited: true, manualRIRBySet: { 1: 2 },
        sets: [3, 2, 2, 1].map((targetRIR) => ({ setType: SetType.NORMAL,
          targetReps: 12, targetRIR })) }] };
    const [projected] = prescriptionForMicrocycle([custom], TrainingGoal.HYPERTROPHY, 4, 6);
    expect(projected.exercises[0].sets.map((set) => set.targetRIR)).toEqual([2, 2, 1, 0]);
  });

  it('confines RIR above three to the first exposure of demanding compounds', () => {
    const base: PlannedSession = {
      index: 0, focus: 'LOWER', estimatedWorkMinutes: 30,
      exercises: [{ exerciseId: 'squat', order: 0, isEdited: false,
        sets: [4, 4, 3, 2].map((targetRIR) => ({
          setType: SetType.NORMAL, targetReps: 8, targetRIR,
        })) }],
    };
    expect(prescriptionForMicrocycle([base], TrainingGoal.HYPERTROPHY, 0, 6)
      [0].exercises[0].sets[0].targetRIR).toBe(4);
    expect(prescriptionForMicrocycle([base], TrainingGoal.HYPERTROPHY, 1, 6)
      [0].exercises[0].sets.every((set) => set.targetRIR <= 3)).toBe(true);
  });

  it('deloads: no heavy single, about half the sets, more reserve, 10 % lighter', () => {
    const [session] = prescriptionForMicrocycle([strengthSession], TrainingGoal.STRENGTH, horizon - 1, horizon);
    const squat = session.exercises[0];
    expect(squat.sets.some((set) => set.setType === SetType.TOP_SINGLE)).toBe(false);
    expect(squat.sets).toHaveLength(2);
    expect(squat.sets[0].targetRIR).toBe(3 + DELOAD_RIR_INCREASE);
    expect(squat.sets[0].targetWeightKg).toBe(105);
    expect(session.exercises[1].sets).toHaveLength(2);
    expect(session.exercises[2].sets).toHaveLength(1);
    expect(session.estimatedWorkMinutes).toBeCloseTo((60 * 5) / 8);
  });

  it('caps the deload reserve and keeps an empty session at zero minutes', () => {
    const empty: PlannedSession = { index: 1, focus: 'UPPER', estimatedWorkMinutes: 0, exercises: [] };
    const heavyReserve: PlannedSession = {
      ...empty,
      estimatedWorkMinutes: 10,
      exercises: [{ exerciseId: 'x', order: 0, isEdited: false, sets: [{ setType: SetType.NORMAL, targetReps: 8, targetRIR: 4 }] }],
    };
    const [deloadedEmpty, deloaded] = prescriptionForMicrocycle([empty, heavyReserve], TrainingGoal.HYPERTROPHY, 1, 2);
    expect(deloadedEmpty.estimatedWorkMinutes).toBe(0);
    expect(deloaded.exercises[0].sets[0].targetRIR).toBe(MAX_RIR);
  });

  it('never makes a load negative', () => {
    expect(reloadForRIR(0, 5, 3, 1)).toBe(0);
  });
});
