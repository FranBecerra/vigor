import { MuscleGroup, SetType } from '@/models';
import {
  averageTargetRIR,
  clampRIR,
  maxVolume,
  sessionMicrocycleMetrics,
  type MicrocyclePrescription,
} from '@/services/training/sessionProgression';
import type { PlannedExercise } from '@/services/training/sessionSummary';

function exercise(rir: number, count: number): PlannedExercise {
  return {
    exerciseId: `e-${rir}-${count}`,
    primaryMuscle: MuscleGroup.CHEST,
    secondaryMuscles: [],
    sets: Array.from({ length: count }, () => ({ setType: SetType.NORMAL })),
    restSeconds: 120,
    targetRIR: rir,
  };
}

function micro(
  id: string,
  sessions: { exercises: PlannedExercise[] }[],
  overrides: Partial<MicrocyclePrescription<{ exercises: PlannedExercise[] }>> = {},
): MicrocyclePrescription<{ exercises: PlannedExercise[] }> {
  return {
    id,
    number: 1,
    sessions,
    isDeload: false,
    isProjected: false,
    volumeAdjustmentSets: 0,
    intensityAdjustmentRIR: 0,
    ...overrides,
  };
}

describe('averageTargetRIR', () => {
  it('pondera el RIR por el número de series de trabajo', () => {
    expect(averageTargetRIR([exercise(1, 1), exercise(3, 3)])).toBe(2.5);
  });

  it('devuelve 0 sin series de trabajo', () => {
    expect(averageTargetRIR([])).toBe(0);
  });

  it('ignora calentamientos', () => {
    const planned = { ...exercise(3, 1), sets: [{ setType: SetType.WARMUP }] };
    expect(averageTargetRIR([planned])).toBe(0);
  });
});

describe('clampRIR', () => {
  it('limita y redondea a un decimal', () => {
    expect(clampRIR(2.56)).toBe(2.6);
    expect(clampRIR(-1)).toBe(0);
    expect(clampRIR(6)).toBe(5);
  });

  it('trata NaN como 0', () => {
    expect(clampRIR(Number.NaN)).toBe(0);
  });
});

describe('sessionMicrocycleMetrics', () => {
  it('resume volumen e intensidad por sesión, no por ejercicio individual', () => {
    const metrics = sessionMicrocycleMetrics([
      micro('m1', [{ exercises: [exercise(3, 3), exercise(1, 1)] }]),
      micro('m2', [{ exercises: [exercise(3, 3), exercise(1, 1)] }], {
        number: 2,
        volumeAdjustmentSets: 2,
        intensityAdjustmentRIR: -0.5,
        isProjected: true,
      }),
    ], 0);
    expect(metrics).toEqual([
      { id: 'm1', number: 1, isDeload: false, isProjected: false, volumeSets: 4, averageRIR: 2.5 },
      { id: 'm2', number: 2, isDeload: false, isProjected: true, volumeSets: 6, averageRIR: 2 },
    ]);
  });

  it('emite cero para una sesión ausente sin inventar datos', () => {
    const metrics = sessionMicrocycleMetrics([micro('m1', [])], 1);
    expect(metrics[0].volumeSets).toBe(0);
    expect(metrics[0].averageRIR).toBe(0);
  });

  it('no permite volumen negativo por una descarga', () => {
    const metrics = sessionMicrocycleMetrics([
      micro('dl', [{ exercises: [exercise(2, 2)] }], { volumeAdjustmentSets: -20, isDeload: true }),
    ], 0);
    expect(metrics[0].volumeSets).toBe(0);
    expect(metrics[0].isDeload).toBe(true);
  });
});

describe('maxVolume', () => {
  it('devuelve el máximo y usa 1 como mínimo seguro', () => {
    expect(maxVolume([])).toBe(1);
    expect(maxVolume([{ id: 'x', number: 1, isDeload: false, isProjected: false, volumeSets: 7, averageRIR: 2 }])).toBe(7);
  });
});
