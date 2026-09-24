import {
  rirPrescription,
  targetRIR,
  fatigueAutoFill,
} from '@/services/training/rirAutoregulation';
import { ExerciseProfile } from '@/models';

describe('rirPrescription / targetRIR', () => {
  test('axiales (PRIMARY): inicio 3, tope rutinario 2', () => {
    const p = rirPrescription(ExerciseProfile.COMPOUND_PRIMARY);
    expect(p.start).toBe(3);
    expect(p.routineFloor).toBe(2);
    expect(targetRIR(ExerciseProfile.COMPOUND_PRIMARY)).toBe(2);
  });

  test('axiales alcanzan RIR 0 solo en serie final pre-deload', () => {
    expect(targetRIR(ExerciseProfile.COMPOUND_PRIMARY, true)).toBe(0);
  });

  test('máquinas (SECONDARY): inicio 2, rutina hasta 1', () => {
    expect(rirPrescription(ExerciseProfile.COMPOUND_SECONDARY).start).toBe(2);
    expect(targetRIR(ExerciseProfile.COMPOUND_SECONDARY)).toBe(1);
  });

  test('aislamiento: rutina hasta el fallo (0)', () => {
    expect(targetRIR(ExerciseProfile.ISOLATION)).toBe(0);
  });
});

describe('fatigueAutoFill', () => {
  const planned = { plannedWeight: 100, plannedReps: 8 };

  test('cumple reps → sin ajuste', () => {
    const r = fatigueAutoFill({ ...planned, achievedReps: 8 });
    expect(r.isDownAdjusted).toBe(false);
    expect(r.suggestedWeight).toBe(100);
    expect(r.suggestedReps).toBe(8);
  });

  test('supera reps → sin ajuste', () => {
    expect(fatigueAutoFill({ ...planned, achievedReps: 10 }).isDownAdjusted).toBe(false);
  });

  test('por debajo → baja carga 5% redondeada a 0.5kg', () => {
    const r = fatigueAutoFill({ ...planned, achievedReps: 5 });
    expect(r.isDownAdjusted).toBe(true);
    expect(r.suggestedWeight).toBe(95); // 100*0.95
    expect(r.suggestedReps).toBe(8);
  });

  test('redondeo a 0.5kg', () => {
    // 82.5 * 0.95 = 78.375 → round(*2)/2 = 78.5
    const r = fatigueAutoFill({ plannedWeight: 82.5, plannedReps: 6, achievedReps: 4 });
    expect(r.suggestedWeight).toBe(78.5);
  });

  test('achievedReps = 0 → ajusta a la baja', () => {
    expect(fatigueAutoFill({ ...planned, achievedReps: 0 }).isDownAdjusted).toBe(true);
  });

  test.each([0, -10, NaN])('plannedWeight inválido (%p) lanza', (w) => {
    expect(() => fatigueAutoFill({ plannedWeight: w as number, plannedReps: 8, achievedReps: 5 })).toThrow();
  });

  test.each([0, 1.5, NaN])('plannedReps inválidas (%p) lanzan', (r) => {
    expect(() => fatigueAutoFill({ plannedWeight: 100, plannedReps: r as number, achievedReps: 5 })).toThrow();
  });

  test.each([-1, 1.5, NaN])('achievedReps inválidas (%p) lanzan', (a) => {
    expect(() => fatigueAutoFill({ plannedWeight: 100, plannedReps: 8, achievedReps: a as number })).toThrow();
  });
});
